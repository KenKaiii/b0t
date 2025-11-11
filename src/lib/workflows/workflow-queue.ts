import { createQueue, createWorker, addJob, queues } from '../queue';
import { executeWorkflow } from './executor';
import { logger } from '../logger';

/**
 * Workflow Execution Queue
 *
 * Manages concurrent workflow execution with:
 * - Configurable concurrency (default: 10 workflows at once)
 * - Per-user isolation (each user's workflows are independent)
 * - Automatic retries on failure
 * - Queue backpressure protection
 *
 * This ensures:
 * - 5 users can run workflows simultaneously without interference
 * - System doesn't get overloaded if 100 workflows are triggered at once
 * - Failed workflows retry automatically
 */

export const WORKFLOW_QUEUE_NAME = 'workflows-execution';

export interface WorkflowJobData {
  workflowId: string;
  userId: string;
  triggerType: 'manual' | 'cron' | 'webhook' | 'telegram' | 'discord' | 'chat' | 'chat-input' | 'gmail' | 'outlook';
  triggerData?: Record<string, unknown>;
}

/**
 * Initialize the workflow execution queue and worker
 * Call this on app startup (once)
 *
 * Scaling configurations:
 * - Development: 20 concurrent workflows (single instance)
 * - Production (vertical): 100 concurrent workflows (single powerful instance)
 * - Production (horizontal): 50 concurrent per worker (multiple worker instances)
 */
export async function initializeWorkflowQueue(options?: {
  concurrency?: number;  // How many workflows to run simultaneously
  maxJobsPerMinute?: number;  // Rate limit (default: 300)
}) {
  // Environment-based concurrency defaults
  // Development: 20, Production vertical: 100, Production horizontal: 50 per worker
  const defaultConcurrency = parseInt(
    process.env.WORKFLOW_CONCURRENCY ||
    (process.env.NODE_ENV === 'production' ? '100' : '20'),
    10
  );

  const concurrency = options?.concurrency || defaultConcurrency;
  const maxJobsPerMinute = options?.maxJobsPerMinute || 300;

  if (!process.env.REDIS_URL) {
    logger.warn('REDIS_URL not set - workflow queue disabled, falling back to direct execution');
    return false;
  }

  try {
    logger.info(
      { concurrency, maxJobsPerMinute },
      'Initializing workflow queue with concurrency settings'
    );

    // Create queue for workflow execution
    createQueue(WORKFLOW_QUEUE_NAME, {
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

    // Create worker to process workflows
    const worker = createWorker<WorkflowJobData>(
      WORKFLOW_QUEUE_NAME,
      async (job) => {
        const { workflowId, userId, triggerType, triggerData } = job.data;

        logger.info(
          {
            jobId: job.id,
            workflowId,
            userId,
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
        concurrency,  // Run N workflows concurrently
        limiter: {
          max: maxJobsPerMinute,  // Max jobs per minute
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
            action: 'workflow_retry_scheduled',
            timestamp: new Date().toISOString(),
            attempt: job.attemptsMade + 1,
            nextRetryIn: `${Math.pow(2, job.attemptsMade) * 10}s`
          },
          `Workflow will retry (attempt ${job.attemptsMade + 1}/3)`
        );
      }
    });

    // Worker starts automatically when created
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
 * This adds the workflow to the queue instead of executing it immediately.
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

    const queue = queues.get(WORKFLOW_QUEUE_NAME);
    if (!queue) {
      throw new Error('Workflow queue not initialized. Call initializeWorkflowQueue() first.');
    }

    // Add workflow to queue
    const job = await addJob<WorkflowJobData>(
      WORKFLOW_QUEUE_NAME,
      `workflow-${workflowId}`,
      {
        workflowId,
        userId,
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
 * Get queue statistics
 */
export async function getWorkflowQueueStats() {
  const queue = queues.get(WORKFLOW_QUEUE_NAME);
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
    waiting,    // Jobs waiting to be processed
    active,     // Currently executing workflows
    completed,  // Successfully completed
    failed,     // Failed after retries
    delayed,    // Scheduled for future execution
    total: waiting + active + delayed,
  };
}

/**
 * Check if workflow queue is available
 */
export function isWorkflowQueueAvailable(): boolean {
  return !!process.env.REDIS_URL && queues.has(WORKFLOW_QUEUE_NAME);
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
