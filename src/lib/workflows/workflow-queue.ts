import { createQueue, createWorker, addJob, queues } from '../queue';
import { executeWorkflow } from './executor';
import { logger } from '../logger';

/**
 * Workflow Execution Queue
 *
 * Manages concurrent workflow execution with:
 * - Per-organization queue partitioning (prevents noisy neighbor problem)
 * - Configurable concurrency per organization
 * - Automatic retries on failure
 * - Queue backpressure protection
 *
 * This ensures:
 * - Each organization has isolated resource pool
 * - One org's heavy load doesn't impact others
 * - Failed workflows retry automatically
 * - Admin workflows have dedicated queue
 */

export const WORKFLOW_QUEUE_NAME = 'workflows-execution';
export const WORKFLOW_QUEUE_PREFIX = 'workflows-execution:';

export interface WorkflowJobData {
  workflowId: string;
  userId: string;
  organizationId: string | null;  // null = admin workflows
  triggerType: 'manual' | 'cron' | 'webhook' | 'telegram' | 'discord' | 'chat' | 'chat-input' | 'gmail' | 'outlook';
  triggerData?: Record<string, unknown>;
}

/**
 * Get queue name for a specific organization
 * Admin workflows (organizationId = null) use 'workflows-execution:admin'
 * Org workflows use 'workflows-execution:{orgId}'
 */
export function getQueueNameForOrg(organizationId: string | null): string {
  if (!organizationId) {
    return `${WORKFLOW_QUEUE_PREFIX}admin`;
  }
  return `${WORKFLOW_QUEUE_PREFIX}${organizationId}`;
}

// Track initialized queues and workers per org
const initializedQueues = new Set<string>();

// Store queue initialization options globally
let globalQueueOptions: {
  concurrency: number;
  maxJobsPerMinute: number;
} = {
  concurrency: 20,
  maxJobsPerMinute: 300,
};

/**
 * Initialize the workflow execution queue system
 * Call this on app startup (once)
 *
 * This sets up the per-org queue partitioning system.
 * Queues are created on-demand when workflows are queued.
 *
 * Scaling configurations:
 * - Development: 20 concurrent workflows per org (single instance)
 * - Production (vertical): 100 concurrent workflows per org (single powerful instance)
 * - Production (horizontal): 50 concurrent per org per worker (multiple worker instances)
 */
export async function initializeWorkflowQueue(options?: {
  concurrency?: number;  // How many workflows to run simultaneously PER ORG
  maxJobsPerMinute?: number;  // Rate limit PER ORG (default: 300)
}) {
  // Environment-based concurrency defaults
  // Development: 20, Production vertical: 100, Production horizontal: 50 per worker
  const defaultConcurrency = parseInt(
    process.env.WORKFLOW_CONCURRENCY ||
    (process.env.NODE_ENV === 'production' ? '100' : '20'),
    10
  );

  globalQueueOptions = {
    concurrency: options?.concurrency || defaultConcurrency,
    maxJobsPerMinute: options?.maxJobsPerMinute || 300,
  };

  if (!process.env.REDIS_URL) {
    logger.warn('REDIS_URL not set - workflow queue disabled, falling back to direct execution');
    return false;
  }

  try {
    // Log concurrency settings with optimization status
    if (process.env.NODE_ENV === 'development') {
      console.log(
        `🔄 Workflow queue ready (per-org concurrency: ${globalQueueOptions.concurrency}, ` +
        `rate: ${globalQueueOptions.maxJobsPerMinute}/min per org)`
      );
    } else {
      logger.info(
        globalQueueOptions,
        'Initializing per-org workflow queue system'
      );
    }

    // Always log optimization status
    logger.info({
      ...globalQueueOptions,
      environment: process.env.NODE_ENV || 'development',
      optimization: 'PER_ORG_QUEUE_PARTITIONING',
      overridden: !!options?.concurrency
    }, `✅ Per-org workflow queue: ${globalQueueOptions.concurrency} parallel workflows per org`);

    return true;
  } catch (error) {
    // Provide detailed error logging
    logger.error(
      {
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : error
      },
      'Failed to initialize workflow queue system'
    );
    return false;
  }
}

/**
 * Initialize queue and worker for a specific organization
 * Called on-demand when first workflow is queued for an org
 */
async function initializeQueueForOrg(organizationId: string | null): Promise<boolean> {
  const queueName = getQueueNameForOrg(organizationId);

  // Skip if already initialized
  if (initializedQueues.has(queueName)) {
    return true;
  }

  try {
    logger.info(
      { queueName, organizationId: organizationId || 'admin' },
      'Initializing queue for organization'
    );

    // Create queue for this organization
    createQueue(queueName, {
      defaultJobOptions: {
        attempts: 3,  // Retry failed workflows 3 times
        backoff: {
          type: 'exponential',
          delay: 10000,  // Start with 10s delay between retries
        },
        removeOnComplete: {
          age: 86400,  // Keep completed jobs for 24 hours
          count: 1000,
        },
        removeOnFail: {
          age: 604800,  // Keep failed jobs for 7 days
          count: 5000,
        },
      },
    });

    // Create worker to process workflows for this organization
    const worker = createWorker<WorkflowJobData>(
      queueName,
      async (job) => {
        const { workflowId, userId, organizationId, triggerType, triggerData } = job.data;

        logger.info(
          {
            jobId: job.id,
            workflowId,
            userId,
            organizationId: organizationId || 'admin',
            triggerType,
            attempt: job.attemptsMade + 1,
            action: 'workflow_execution_started',
            timestamp: new Date().toISOString()
          },
          'Executing workflow from queue'
        );

        try {
          // Execute the workflow
          const result = await executeWorkflow(workflowId, userId, triggerType, triggerData);

          if (!result.success) {
            throw new Error(
              `Workflow execution failed: ${result.error} ${result.errorStep ? `(step: ${result.errorStep})` : ''}`
            );
          }

          logger.info(
            {
              jobId: job.id,
              workflowId,
              userId,
              organizationId: organizationId || 'admin',
              action: 'workflow_execution_completed',
              timestamp: new Date().toISOString(),
              metadata: { triggerType, duration: Date.now() - job.timestamp }
            },
            'Workflow executed successfully from queue'
          );

          return result;
        } catch (error) {
          logger.error(
            {
              jobId: job.id,
              workflowId,
              userId,
              organizationId: organizationId || 'admin',
              action: 'workflow_execution_failed',
              timestamp: new Date().toISOString(),
              attempt: job.attemptsMade + 1,
              maxAttempts: 3,
              error: error instanceof Error ? { message: error.message, stack: error.stack, name: error.name } : error,
              metadata: { triggerType }
            },
            `Workflow execution failed (attempt ${job.attemptsMade + 1}/3)`
          );
          throw error;
        }
      },
      {
        concurrency: globalQueueOptions.concurrency,  // Run N workflows concurrently per org
        limiter: {
          max: globalQueueOptions.maxJobsPerMinute,  // Max jobs per minute per org
          duration: 60000,
        },
      }
    );

    // Log retry attempts
    worker.on('failed', (job) => {
      if (job && job.attemptsMade < 3) {
        logger.info(
          {
            jobId: job.id,
            workflowId: job.data.workflowId,
            userId: job.data.userId,
            organizationId: job.data.organizationId || 'admin',
            action: 'workflow_retry_scheduled',
            timestamp: new Date().toISOString(),
            attempt: job.attemptsMade + 1,
            nextRetryIn: `${Math.pow(2, job.attemptsMade) * 10}s`
          },
          `Workflow will retry (attempt ${job.attemptsMade + 1}/3)`
        );
      }
    });

    // Mark as initialized
    initializedQueues.add(queueName);

    logger.info(
      { queueName, organizationId: organizationId || 'admin' },
      'Queue and worker initialized for organization'
    );

    return true;
  } catch (error) {
    // Provide detailed error logging
    logger.error(
      {
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : error
      },
      'Failed to initialize workflow queue'
    );
    return false;
  }
}

/**
 * Queue a workflow for execution
 *
 * This adds the workflow to the per-org queue instead of executing it immediately.
 * The worker will pick it up and execute it based on concurrency settings.
 */
export async function queueWorkflowExecution(
  workflowId: string,
  userId: string,
  triggerType: WorkflowJobData['triggerType'],
  triggerData?: Record<string, unknown>,
  options?: {
    priority?: number;  // Lower number = higher priority (default: 5)
    delay?: number;     // Delay execution by N milliseconds
    organizationId?: string | null;  // Optional: provide if already known to avoid DB query
  }
): Promise<{ jobId: string; queued: boolean }> {
  try {
    // If Redis not configured, fall back to direct execution
    if (!process.env.REDIS_URL) {
      logger.info(
        {
          workflowId,
          userId,
          action: 'workflow_direct_execution',
          timestamp: new Date().toISOString(),
          metadata: { triggerType, reason: 'redis_not_configured' }
        },
        'No Redis - executing workflow directly (not queued)'
      );

      // Execute immediately without queue
      await executeWorkflow(workflowId, userId, triggerType, triggerData);

      return { jobId: 'direct-execution', queued: false };
    }

    // Get organizationId if not provided
    let organizationId = options?.organizationId;
    if (organizationId === undefined) {
      // Import db and workflowsTable here to avoid circular dependency
      const { db } = await import('../db');
      const { workflowsTable } = await import('../schema');
      const { eq } = await import('drizzle-orm');

      const workflow = await db
        .select({ organizationId: workflowsTable.organizationId })
        .from(workflowsTable)
        .where(eq(workflowsTable.id, workflowId))
        .limit(1);

      if (!workflow || workflow.length === 0) {
        throw new Error(`Workflow ${workflowId} not found`);
      }

      organizationId = workflow[0].organizationId;
    }

    // Initialize queue for this organization if needed
    await initializeQueueForOrg(organizationId);

    // Get the queue name for this organization
    const queueName = getQueueNameForOrg(organizationId);
    const queue = queues.get(queueName);

    if (!queue) {
      throw new Error(`Workflow queue not initialized for organization: ${organizationId || 'admin'}`);
    }

    // Add workflow to org-specific queue
    const job = await addJob<WorkflowJobData>(
      queueName,
      `workflow-${workflowId}`,
      {
        workflowId,
        userId,
        organizationId,
        triggerType,
        triggerData,
      },
      {
        priority: options?.priority || 5,
        delay: options?.delay,
      }
    );

    logger.info(
      {
        jobId: job.id,
        workflowId,
        userId,
        organizationId: organizationId || 'admin',
        queueName,
        action: 'workflow_queued',
        timestamp: new Date().toISOString(),
        metadata: {
          triggerType,
          priority: options?.priority || 5,
          delay: options?.delay || 0
        }
      },
      'Workflow queued for execution successfully'
    );

    return { jobId: job.id || 'unknown', queued: true };
  } catch (error) {
    logger.error(
      {
        workflowId,
        userId,
        action: 'workflow_queue_failed',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? { message: error.message, stack: error.stack, name: error.name } : error,
        metadata: { triggerType }
      },
      'Failed to queue workflow for execution'
    );
    throw error;
  }
}

/**
 * Get queue statistics for a specific organization
 * If no organizationId provided, returns aggregated stats across all queues
 */
export async function getWorkflowQueueStats(organizationId?: string | null) {
  if (organizationId !== undefined) {
    // Get stats for specific org
    const queueName = getQueueNameForOrg(organizationId);
    const queue = queues.get(queueName);
    if (!queue) {
      return null;
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return {
      organizationId: organizationId || 'admin',
      waiting,    // Jobs waiting to be processed
      active,     // Currently executing workflows
      completed,  // Successfully completed
      failed,     // Failed after retries
      delayed,    // Scheduled for future execution
      total: waiting + active + delayed,
    };
  }

  // Aggregate stats across all workflow queues
  const allQueues = Array.from(queues.entries()).filter(([name]) =>
    name.startsWith(WORKFLOW_QUEUE_PREFIX)
  );

  if (allQueues.length === 0) {
    return null;
  }

  let totalWaiting = 0;
  let totalActive = 0;
  let totalCompleted = 0;
  let totalFailed = 0;
  let totalDelayed = 0;

  const perOrgStats: Array<{
    organizationId: string;
    waiting: number;
    active: number;
  }> = [];

  for (const [queueName, queue] of allQueues) {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    totalWaiting += waiting;
    totalActive += active;
    totalCompleted += completed;
    totalFailed += failed;
    totalDelayed += delayed;

    // Extract org ID from queue name
    const orgId = queueName.replace(WORKFLOW_QUEUE_PREFIX, '');
    perOrgStats.push({
      organizationId: orgId,
      waiting,
      active,
    });
  }

  return {
    waiting: totalWaiting,
    active: totalActive,
    completed: totalCompleted,
    failed: totalFailed,
    delayed: totalDelayed,
    total: totalWaiting + totalActive + totalDelayed,
    perOrg: perOrgStats,
  };
}

/**
 * Check if workflow queue system is available
 */
export function isWorkflowQueueAvailable(): boolean {
  return !!process.env.REDIS_URL;
}

/**
 * Example usage:
 *
 * // On app startup (in src/app/layout.tsx or similar):
 * await initializeWorkflowQueue({
 *   concurrency: 10,  // Run 10 workflows at once
 *   maxJobsPerMinute: 100
 * });
 *
 * // In API route when user triggers workflow:
 * const { jobId } = await queueWorkflowExecution(
 *   workflowId,
 *   userId,
 *   'manual'
 * );
 *
 * // Check queue health:
 * const stats = await getWorkflowQueueStats();
 * console.log(`Active workflows: ${stats?.active}, Queued: ${stats?.waiting}`);
 */
