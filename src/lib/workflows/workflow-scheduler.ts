import cron, { ScheduledTask } from 'node-cron';
import { db } from '@/lib/db';
import { workflowsTable } from '@/lib/schema';
import { sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { queueWorkflowExecution, isWorkflowQueueAvailable } from './workflow-queue';
import { executeWorkflow } from './executor';
import { emailTriggerPoller } from './email-triggers';

/**
 * Workflow Scheduler
 *
 * Manages cron-scheduled workflow execution.
 * Scans database for workflows with cron triggers and schedules them.
 *
 * Features:
 * - Uses queue system if Redis available (concurrency control)
 * - Falls back to direct execution if no Redis
 * - Automatically picks up new workflows
 * - Handles workflow updates/deletions
 */

interface ScheduledWorkflow {
  workflowId: string;
  userId: string;
  cronPattern: string;
  task: ScheduledTask;
}

class WorkflowScheduler {
  private scheduledWorkflows: Map<string, ScheduledWorkflow> = new Map();
  private isInitialized = false;

  /**
   * Initialize scheduler - scan database and schedule all active cron workflows
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn('Workflow scheduler already initialized');
      return;
    }

    try {
      await this.syncWorkflows();

      // Initialize email trigger polling
      await emailTriggerPoller.initialize();

      this.isInitialized = true;
      if (this.scheduledWorkflows.size > 0) {
        logger.info(
          { scheduledCount: this.scheduledWorkflows.size },
          'Workflow scheduler initialized with cron workflows'
        );
      }
    } catch (error) {
      logger.error({ error }, 'Failed to initialize workflow scheduler');
      throw error;
    }
  }

  /**
   * Sync workflows from database
   * Scans for active workflows with cron triggers and schedules them
   */
  async syncWorkflows() {
    try {
      // Get all active workflows with cron triggers
      const activeWorkflows = await db
        .select({
          id: workflowsTable.id,
          name: workflowsTable.name,
          userId: workflowsTable.userId,
          trigger: workflowsTable.trigger,
          status: workflowsTable.status,
        })
        .from(workflowsTable)
        .where(
          sql`
            ${workflowsTable.status} = 'active' AND
            ${workflowsTable.trigger}->>'type' = 'cron'
          `
        );

      // Remove workflows that no longer exist or are inactive
      for (const [workflowId] of this.scheduledWorkflows) {
        const stillExists = activeWorkflows.some((w) => w.id === workflowId);
        if (!stillExists) {
          this.unscheduleWorkflow(workflowId);
        }
      }

      // Schedule new/updated workflows
      for (const workflow of activeWorkflows) {
        const trigger = workflow.trigger as {
          type: string;
          config: { schedule?: string };
        };

        const cronPattern = trigger.config.schedule;
        if (!cronPattern) {
          logger.warn(
            { workflowId: workflow.id },
            'Workflow has cron trigger but no schedule'
          );
          continue;
        }

        // Check if already scheduled with same pattern
        const existing = this.scheduledWorkflows.get(workflow.id);
        if (existing && existing.cronPattern === cronPattern) {
          continue; // Already scheduled correctly
        }

        // Unschedule if pattern changed
        if (existing) {
          this.unscheduleWorkflow(workflow.id);
        }

        // Schedule the workflow
        await this.scheduleWorkflow(
          workflow.id,
          workflow.userId,
          cronPattern,
          workflow.name
        );
      }

      // Only log if there are scheduled workflows
      if (this.scheduledWorkflows.size > 0) {
        logger.info(
          { scheduled: this.scheduledWorkflows.size },
          'Workflow sync completed'
        );
      }
    } catch (error) {
      logger.error({ error }, 'Failed to sync workflows');
      throw error;
    }
  }

  /**
   * Schedule a single workflow
   */
  private async scheduleWorkflow(
    workflowId: string,
    userId: string,
    cronPattern: string,
    workflowName?: string
  ) {
    if (!cron.validate(cronPattern)) {
      logger.error(
        { workflowId, cronPattern },
        'Invalid cron pattern'
      );
      return;
    }

    logger.info(
      { workflowId, cronPattern, workflowName },
      'Scheduling workflow'
    );

    const task = cron.schedule(
      cronPattern,
      async () => {
        logger.info(
          { workflowId, userId, workflowName },
          'Executing scheduled workflow'
        );

        try {
          // Use queue if available, otherwise execute directly
          if (isWorkflowQueueAvailable()) {
            await queueWorkflowExecution(workflowId, userId, 'cron', {
              scheduledAt: new Date().toISOString(),
            });
            logger.info(
              { workflowId },
              'Workflow queued via cron trigger'
            );
          } else {
            // Direct execution fallback
            const result = await executeWorkflow(
              workflowId,
              userId,
              'cron',
              { scheduledAt: new Date().toISOString() }
            );

            if (result.success) {
              logger.info(
                { workflowId },
                'Scheduled workflow completed successfully'
              );
            } else {
              logger.error(
                { workflowId, error: result.error },
                'Scheduled workflow failed'
              );
            }
          }
        } catch (error) {
          logger.error(
            { workflowId, error },
            'Error executing scheduled workflow'
          );
        }
      }
    );

    // Start the task
    task.start();

    this.scheduledWorkflows.set(workflowId, {
      workflowId,
      userId,
      cronPattern,
      task,
    });

    logger.info(
      { workflowId, cronPattern, workflowName },
      'Workflow scheduled successfully'
    );
  }

  /**
   * Unschedule a workflow
   */
  private unscheduleWorkflow(workflowId: string) {
    const scheduled = this.scheduledWorkflows.get(workflowId);
    if (!scheduled) {
      return;
    }

    scheduled.task.stop();
    this.scheduledWorkflows.delete(workflowId);

    logger.info({ workflowId }, 'Workflow unscheduled');
  }

  /**
   * Manually trigger a re-sync (useful after workflow updates)
   */
  async refresh() {
    logger.info('Refreshing workflow schedules');
    await this.syncWorkflows();
  }

  /**
   * Stop all scheduled workflows
   */
  stop() {
    logger.info('Stopping workflow scheduler');

    for (const [workflowId] of this.scheduledWorkflows) {
      this.unscheduleWorkflow(workflowId);
    }

    // Stop email trigger polling
    emailTriggerPoller.stop();

    this.isInitialized = false;
    logger.info('Workflow scheduler stopped');
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      scheduledWorkflows: this.scheduledWorkflows.size,
      workflows: Array.from(this.scheduledWorkflows.values()).map((w) => ({
        workflowId: w.workflowId,
        userId: w.userId,
        cronPattern: w.cronPattern,
      })),
    };
  }
}

// Singleton instance
export const workflowScheduler = new WorkflowScheduler();

/**
 * Example usage:
 *
 * // On app startup (in instrumentation.ts or similar):
 * await workflowScheduler.initialize();
 *
 * // When a user updates a workflow trigger:
 * await workflowScheduler.refresh();
 *
 * // Get scheduler status:
 * const status = workflowScheduler.getStatus();
 * console.log(`Scheduled workflows: ${status.scheduledWorkflows}`);
 *
 * // Graceful shutdown:
 * process.on('SIGTERM', () => workflowScheduler.stop());
 */
