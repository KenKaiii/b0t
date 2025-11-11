import { db } from '@/lib/db';
import { workflowsTable } from '@/lib/schema';
import { sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { queueWorkflowExecution, isWorkflowQueueAvailable } from './workflow-queue';
import { executeWorkflow } from './executor';
import * as gmailModule from '@/modules/communication/gmail';
import * as outlookModule from '@/modules/communication/outlook';

/**
 * Email Triggers System
 *
 * Polls Gmail/Outlook for new emails matching workflow trigger filters.
 * When a matching email is found, executes the workflow with email data.
 *
 * Features:
 * - Separate pollers for Gmail and Outlook
 * - Configurable poll interval (default 60s)
 * - Deduplication (tracks last-checked timestamp)
 * - Queue-based execution for scalability
 * - Error handling and retry logic
 *
 * Trigger Config Example:
 * {
 *   "type": "gmail",
 *   "config": {
 *     "filters": {
 *       "label": "inbox",
 *       "isUnread": true,
 *       "hasNoLabels": true
 *     },
 *     "pollInterval": 60
 *   }
 * }
 */

interface EmailTriggerWorkflow {
  id: string;
  userId: string;
  name: string;
  trigger: {
    type: 'gmail' | 'outlook';
    config: {
      filters?: Record<string, unknown>;
      pollInterval?: number;
    };
  };
  lastChecked?: Date;
}

interface PollerState {
  workflows: Map<string, EmailTriggerWorkflow>;
  intervalId?: NodeJS.Timeout;
  isPolling: boolean;
}

class EmailTriggerPoller {
  private gmailState: PollerState = {
    workflows: new Map(),
    isPolling: false,
  };

  private outlookState: PollerState = {
    workflows: new Map(),
    isPolling: false,
  };

  private defaultPollInterval = 60000; // 60 seconds
  private processedEmailIds: Set<string> = new Set();
  private maxProcessedEmailsTracked = 10000;

  /**
   * Initialize email trigger polling
   */
  async initialize() {
    try {
      await this.loadWorkflows();

      if (this.gmailState.workflows.size > 0) {
        this.startGmailPolling();
        logger.info(
          { count: this.gmailState.workflows.size },
          'Gmail trigger polling initialized'
        );
      }

      if (this.outlookState.workflows.size > 0) {
        this.startOutlookPolling();
        logger.info(
          { count: this.outlookState.workflows.size },
          'Outlook trigger polling initialized'
        );
      }
    } catch (error) {
      logger.error({ error }, 'Failed to initialize email triggers');
      throw error;
    }
  }

  /**
   * Load all active workflows with email triggers
   */
  private async loadWorkflows() {
    // Load Gmail workflows
    const gmailWorkflows = await db
      .select({
        id: workflowsTable.id,
        name: workflowsTable.name,
        userId: workflowsTable.userId,
        trigger: workflowsTable.trigger,
      })
      .from(workflowsTable)
      .where(
        sql`
          ${workflowsTable.status} = 'active' AND
          ${workflowsTable.trigger}->>'type' = 'gmail'
        `
      );

    for (const wf of gmailWorkflows) {
      this.gmailState.workflows.set(wf.id, {
        id: wf.id,
        userId: wf.userId,
        name: wf.name,
        trigger: wf.trigger as unknown as EmailTriggerWorkflow['trigger'],
      });
    }

    // Load Outlook workflows
    const outlookWorkflows = await db
      .select({
        id: workflowsTable.id,
        name: workflowsTable.name,
        userId: workflowsTable.userId,
        trigger: workflowsTable.trigger,
      })
      .from(workflowsTable)
      .where(
        sql`
          ${workflowsTable.status} = 'active' AND
          ${workflowsTable.trigger}->>'type' = 'outlook'
        `
      );

    for (const wf of outlookWorkflows) {
      this.outlookState.workflows.set(wf.id, {
        id: wf.id,
        userId: wf.userId,
        name: wf.name,
        trigger: wf.trigger as unknown as EmailTriggerWorkflow['trigger'],
      });
    }
  }

  /**
   * Start Gmail polling loop
   */
  private startGmailPolling() {
    if (this.gmailState.isPolling) {
      logger.warn('Gmail polling already running');
      return;
    }

    this.gmailState.isPolling = true;

    // Poll immediately on start
    this.pollGmail().catch((error) => {
      logger.error({ error }, 'Gmail poll error on startup');
    });

    // Then poll on interval
    this.gmailState.intervalId = setInterval(() => {
      this.pollGmail().catch((error) => {
        logger.error({ error }, 'Gmail poll error');
      });
    }, this.defaultPollInterval);

    logger.info({ interval: this.defaultPollInterval }, 'Gmail polling started');
  }

  /**
   * Start Outlook polling loop
   */
  private startOutlookPolling() {
    if (this.outlookState.isPolling) {
      logger.warn('Outlook polling already running');
      return;
    }

    this.outlookState.isPolling = true;

    // Poll immediately on start
    this.pollOutlook().catch((error) => {
      logger.error({ error }, 'Outlook poll error on startup');
    });

    // Then poll on interval
    this.outlookState.intervalId = setInterval(() => {
      this.pollOutlook().catch((error) => {
        logger.error({ error }, 'Outlook poll error');
      });
    }, this.defaultPollInterval);

    logger.info({ interval: this.defaultPollInterval }, 'Outlook polling started');
  }

  /**
   * Poll Gmail for new emails
   */
  private async pollGmail() {
    const workflows = Array.from(this.gmailState.workflows.values());

    logger.debug({ workflowCount: workflows.length }, 'Polling Gmail');

    for (const workflow of workflows) {
      try {
        const filters = (workflow.trigger.config.filters || {}) as {
          label?: string;
          isUnread?: boolean;
          hasNoLabels?: boolean;
          from?: string;
          to?: string;
          subject?: string;
          after?: string;
          before?: string;
        };

        // Fetch recent emails (last 5 minutes worth)
        const emails = await gmailModule.fetchEmails({
          userId: workflow.userId,
          filters,
          limit: 10,
          includeBody: true,
        });

        // Filter out already processed emails
        const newEmails = emails.filter((email) => {
          const emailKey = `gmail:${workflow.id}:${email.id}`;
          if (this.processedEmailIds.has(emailKey)) {
            return false;
          }
          this.processedEmailIds.add(emailKey);
          return true;
        });

        // Trim processed emails set if too large
        if (this.processedEmailIds.size > this.maxProcessedEmailsTracked) {
          const entries = Array.from(this.processedEmailIds);
          this.processedEmailIds = new Set(entries.slice(-5000));
        }

        if (newEmails.length > 0) {
          logger.info(
            { workflowId: workflow.id, emailCount: newEmails.length },
            'New Gmail emails found'
          );

          // Execute workflow for each new email
          for (const email of newEmails) {
            await this.executeEmailWorkflow(workflow, email);
          }
        }
      } catch (error) {
        logger.error(
          { workflowId: workflow.id, error },
          'Error polling Gmail for workflow'
        );
      }
    }
  }

  /**
   * Poll Outlook for new emails
   */
  private async pollOutlook() {
    const workflows = Array.from(this.outlookState.workflows.values());

    logger.debug({ workflowCount: workflows.length }, 'Polling Outlook');

    for (const workflow of workflows) {
      try {
        const filters = (workflow.trigger.config.filters || {}) as {
          folder?: string;
          isUnread?: boolean;
          hasNoCategories?: boolean;
          from?: string;
          to?: string;
          subject?: string;
          importance?: 'low' | 'normal' | 'high';
        };

        // Fetch recent emails
        const emails = await outlookModule.fetchEmails({
          userId: workflow.userId,
          filters,
          limit: 10,
          includeBody: true,
        });

        // Filter out already processed emails
        const newEmails = emails.filter((email) => {
          const emailKey = `outlook:${workflow.id}:${email.id}`;
          if (this.processedEmailIds.has(emailKey)) {
            return false;
          }
          this.processedEmailIds.add(emailKey);
          return true;
        });

        // Trim processed emails set if too large
        if (this.processedEmailIds.size > this.maxProcessedEmailsTracked) {
          const entries = Array.from(this.processedEmailIds);
          this.processedEmailIds = new Set(entries.slice(-5000));
        }

        if (newEmails.length > 0) {
          logger.info(
            { workflowId: workflow.id, emailCount: newEmails.length },
            'New Outlook emails found'
          );

          // Execute workflow for each new email
          for (const email of newEmails) {
            await this.executeEmailWorkflow(workflow, email);
          }
        }
      } catch (error) {
        logger.error(
          { workflowId: workflow.id, error },
          'Error polling Outlook for workflow'
        );
      }
    }
  }

  /**
   * Execute workflow with email trigger data
   */
  private async executeEmailWorkflow(
    workflow: EmailTriggerWorkflow,
    email: {
      id: string;
      from: string;
      to: string;
      subject: string;
      snippet: string;
      body?: { text?: string; html?: string };
      [key: string]: unknown;
    }
  ) {
    const triggerData = {
      email: {
        ...email,
        emailId: email.id, // Add unique property to avoid duplication
      },
      userId: workflow.userId,
    };

    logger.info(
      {
        workflowId: workflow.id,
        workflowName: workflow.name,
        emailId: email.id,
        from: email.from,
        subject: email.subject,
      },
      'Executing workflow for email'
    );

    try {
      // Use queue if available, otherwise execute directly
      if (await isWorkflowQueueAvailable()) {
        await queueWorkflowExecution(
          workflow.id,
          workflow.userId,
          workflow.trigger.type,
          triggerData
        );
        logger.info({ workflowId: workflow.id, emailId: email.id }, 'Workflow queued');
      } else {
        await executeWorkflow(
          workflow.id,
          workflow.userId,
          workflow.trigger.type,
          triggerData
        );
        logger.info({ workflowId: workflow.id, emailId: email.id }, 'Workflow executed');
      }
    } catch (error) {
      logger.error(
        { workflowId: workflow.id, emailId: email.id, error },
        'Failed to execute workflow for email'
      );
    }
  }

  /**
   * Reload workflows (called when workflows are added/updated)
   */
  async reload() {
    logger.info('Reloading email trigger workflows');

    // Clear existing
    this.gmailState.workflows.clear();
    this.outlookState.workflows.clear();

    // Reload from database
    await this.loadWorkflows();

    // Restart polling if needed
    if (this.gmailState.workflows.size > 0 && !this.gmailState.isPolling) {
      this.startGmailPolling();
    }

    if (this.outlookState.workflows.size > 0 && !this.outlookState.isPolling) {
      this.startOutlookPolling();
    }

    logger.info(
      {
        gmailWorkflows: this.gmailState.workflows.size,
        outlookWorkflows: this.outlookState.workflows.size,
      },
      'Email triggers reloaded'
    );
  }

  /**
   * Stop all polling
   */
  stop() {
    if (this.gmailState.intervalId) {
      clearInterval(this.gmailState.intervalId);
      this.gmailState.isPolling = false;
      logger.info('Gmail polling stopped');
    }

    if (this.outlookState.intervalId) {
      clearInterval(this.outlookState.intervalId);
      this.outlookState.isPolling = false;
      logger.info('Outlook polling stopped');
    }
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      gmail: {
        isPolling: this.gmailState.isPolling,
        workflowCount: this.gmailState.workflows.size,
      },
      outlook: {
        isPolling: this.outlookState.isPolling,
        workflowCount: this.outlookState.workflows.size,
      },
      processedEmailsTracked: this.processedEmailIds.size,
    };
  }
}

// Singleton instance
export const emailTriggerPoller = new EmailTriggerPoller();
