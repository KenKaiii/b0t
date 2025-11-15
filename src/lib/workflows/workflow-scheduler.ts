import cron, { ScheduledTask } from 'node-cron';
import { db } from '@/lib/db';
import { workflowsTable } from '@/lib/schema';
import { sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { queueWorkflowExecution, isWorkflowQueueAvailable } from './workflow-queue';
import { executeWorkflow } from './executor';
import { emailTriggerPoller } from './email-triggers';
import { getRedisConnection } from '../redis-lock';

/**
 * Workflow Scheduler
 *
 * Manages cron-scheduled workflow execution.
 * Scans database for workflows with cron triggers and schedules them.
 *
 * Features:
 * - Distributed locking with Redis (prevents duplicate scheduling across workers)
 * - Uses queue system if Redis available (concurrency control)
 * - Falls back to direct execution if no Redis
 * - Automatically picks up new workflows
 * - Handles workflow updates/deletions
 */

interface ScheduledWorkflow {
  workflowId: string;
  userId: string;
  organizationId: string | null;
  cronPattern: string;
  task: ScheduledTask;
}

class WorkflowScheduler {
  private scheduledWorkflows: Map<string, ScheduledWorkflow> = new Map();
  private isInitialized = false;
  private isSchedulerLeader = false;
  private leaderCheckInterval: NodeJS.Timeout | null = null;
  private readonly LEADER_LOCK_KEY = 'workflow-scheduler:leader';
  private readonly LEADER_LOCK_TTL = 30; // 30 seconds
  private readonly LEADER_CHECK_INTERVAL = 20000; // Check every 20 seconds

  /**
   * Initialize scheduler - scan database and schedule all active cron workflows
   * Uses distributed locking to ensure only ONE worker schedules cron jobs
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn('Workflow scheduler already initialized');
      return;
    }

    try {
      // Try to become the scheduler leader
      await this.tryBecomeLeader();

      // If we're the leader, schedule workflows
      if (this.isSchedulerLeader) {
        await this.syncWorkflows();

        // Initialize email trigger polling (only leader does this)
        await emailTriggerPoller.initialize();
      } else {
        logger.info('Not scheduler leader - skipping cron scheduling (another worker is handling it)');
      }

      // Start leader election loop to handle leader failures
      this.startLeaderElection();

      this.isInitialized = true;
      if (this.scheduledWorkflows.size > 0) {
        logger.info(
          { scheduledCount: this.scheduledWorkflows.size, isLeader: this.isSchedulerLeader },
          'Workflow scheduler initialized with cron workflows'
        );
      }
    } catch (error) {
      logger.error({ error }, 'Failed to initialize workflow scheduler');
    }
  }

  /**
   * Try to acquire leader lock using Redis
   * Returns true if successfully became leader
   */
  private async tryBecomeLeader(): Promise<boolean> {
    try {
      const redis = getRedisConnection();
      if (!redis) {
        // No Redis - single instance mode, always be leader
        logger.info('No Redis configured - running as scheduler leader (single instance mode)');
        this.isSchedulerLeader = true;
        return true;
      }

      // Try to acquire lock with NX (only set if not exists) and EX (expiration)
      const result = await redis.set(
        this.LEADER_LOCK_KEY,
        `${process.pid}-${Date.now()}`,
        'EX',
        this.LEADER_LOCK_TTL,
        'NX'
      );

      if (result === 'OK') {
        this.isSchedulerLeader = true;
        logger.info(
          { pid: process.pid, ttl: this.LEADER_LOCK_TTL },
          'Acquired scheduler leader lock'
        );
        return true;
      } else {
        this.isSchedulerLeader = false;
        logger.info('Another worker is the scheduler leader');
        return false;
      }
    } catch (error) {
      logger.error({ error }, 'Failed to acquire leader lock - falling back to leader mode');
      // On error, assume leader role to prevent total failure
      this.isSchedulerLeader = true;
      return true;
    }
  }

  /**
   * Renew leader lock to maintain leadership
   */
  private async renewLeaderLock(): Promise<boolean> {
    try {
      const redis = getRedisConnection();
      if (!redis) {
        return true; // No Redis, always leader
      }

      // Extend the lock expiration
      const result = await redis.expire(this.LEADER_LOCK_KEY, this.LEADER_LOCK_TTL);

      if (result === 1) {
        return true;
      } else {
        // Lock expired, try to reacquire
        logger.warn('Leader lock expired, attempting to reacquire');
        return await this.tryBecomeLeader();
      }
    } catch (error) {
      logger.error({ error }, 'Failed to renew leader lock');
      return false;
    }
  }

  /**
   * Start periodic leader election check
   * - If leader: Renew lock
   * - If not leader: Try to become leader if current leader fails
   */
  private startLeaderElection() {
    if (this.leaderCheckInterval) {
      clearInterval(this.leaderCheckInterval);
    }

    this.leaderCheckInterval = setInterval(async () => {
      try {
        if (this.isSchedulerLeader) {
          // Renew our leadership
          const renewed = await this.renewLeaderLock();
          if (!renewed) {
            logger.error('Lost scheduler leadership - unscheduling all workflows');
            this.isSchedulerLeader = false;
            // Unschedule all workflows since we're no longer leader
            for (const [workflowId] of this.scheduledWorkflows) {
              this.unscheduleWorkflow(workflowId);
            }
          }
        } else {
          // Try to become leader (in case current leader died)
          const becameLeader = await this.tryBecomeLeader();
          if (becameLeader) {
            logger.info('Became new scheduler leader - syncing workflows');
            await this.syncWorkflows();
          }
        }
      } catch (error) {
        logger.error({ error }, 'Error in leader election check');
      }
    }, this.LEADER_CHECK_INTERVAL);
  }

  /**
   * Release leader lock when stopping
   */
  private async releaseLeaderLock() {
    if (!this.isSchedulerLeader) {
      return;
    }

    try {
      const redis = getRedisConnection();
      if (redis) {
        await redis.del(this.LEADER_LOCK_KEY);
        logger.info('Released scheduler leader lock');
      }
    } catch (error) {
      logger.error({ error }, 'Failed to release leader lock');
    }
  }

  /**
   * Sync workflows from database
   * Scans for active workflows with cron triggers and schedules them
   * Only the scheduler leader should call this
   */
  async syncWorkflows() {
    if (!this.isSchedulerLeader) {
      logger.warn('Attempted to sync workflows but not scheduler leader');
      return;
    }

    try {
      // Get all active workflows with cron triggers
      const activeWorkflows = await db
        .select({
          id: workflowsTable.id,
          name: workflowsTable.name,
          userId: workflowsTable.userId,
          organizationId: workflowsTable.organizationId,
          trigger: workflowsTable.trigger,
          status: workflowsTable.status,
        })
        .from(workflowsTable)
        .where(
          sql`
            ${workflowsTable.status} = 'active' AND
            ${workflowsTable.trigger}::jsonb->>'type' = 'cron'
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
          workflow.organizationId,
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
      // Only log error, don't throw (handled by caller)
      logger.error({ error }, 'Failed to sync workflows');
    }
  }

  /**
   * Schedule a single workflow
   */
  private async scheduleWorkflow(
    workflowId: string,
    userId: string,
    organizationId: string | null,
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
            await queueWorkflowExecution(
              workflowId,
              userId,
              'cron',
              { scheduledAt: new Date().toISOString() },
              { organizationId }  // Pass organizationId to avoid DB query
            );
            logger.info(
              { workflowId, organizationId: organizationId || 'admin' },
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
      organizationId,
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
   * Stop all scheduled workflows and release leader lock
   */
  async stop() {
    logger.info('Stopping workflow scheduler');

    // Stop leader election loop
    if (this.leaderCheckInterval) {
      clearInterval(this.leaderCheckInterval);
      this.leaderCheckInterval = null;
    }

    // Unschedule all workflows
    for (const [workflowId] of this.scheduledWorkflows) {
      this.unscheduleWorkflow(workflowId);
    }

    // Stop email trigger polling
    emailTriggerPoller.stop();

    // Release leader lock
    await this.releaseLeaderLock();

    this.isSchedulerLeader = false;
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
