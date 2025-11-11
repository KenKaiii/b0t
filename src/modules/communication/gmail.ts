import { google } from 'googleapis';
import { getValidOAuthToken } from '@/lib/oauth-token-manager';
import { logger } from '@/lib/logger';

/**
 * Gmail Module
 *
 * Provides Gmail email management functionality using Google APIs.
 * Supports fetching, updating labels, moving, and marking emails.
 *
 * Required OAuth Scopes:
 * - https://www.googleapis.com/auth/gmail.readonly (for read operations)
 * - https://www.googleapis.com/auth/gmail.modify (for update operations)
 * - https://www.googleapis.com/auth/gmail.labels (for label management)
 *
 * Authentication:
 * - Uses OAuth 2.0 via google credential system
 * - Automatic token refresh via oauth-token-manager
 */

interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    body?: { data?: string };
    parts?: Array<{
      mimeType: string;
      body?: { data?: string };
    }>;
  };
  internalDate: string;
}

interface EmailListFilters {
  label?: string;
  isUnread?: boolean;
  hasNoLabels?: boolean;
  from?: string;
  to?: string;
  subject?: string;
  after?: string; // Date string (YYYY/MM/DD)
  before?: string; // Date string (YYYY/MM/DD)
}

/**
 * Get authenticated Gmail client
 */
async function getGmailClient(userId: string) {
  const accessToken = await getValidOAuthToken(userId, 'google');

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

/**
 * Build Gmail search query from filters
 */
function buildSearchQuery(filters: EmailListFilters): string {
  const queryParts: string[] = [];

  if (filters.label) {
    queryParts.push(`label:${filters.label}`);
  }

  if (filters.isUnread) {
    queryParts.push('is:unread');
  }

  if (filters.hasNoLabels) {
    queryParts.push('has:nouserlabels');
  }

  if (filters.from) {
    queryParts.push(`from:${filters.from}`);
  }

  if (filters.to) {
    queryParts.push(`to:${filters.to}`);
  }

  if (filters.subject) {
    queryParts.push(`subject:"${filters.subject}"`);
  }

  if (filters.after) {
    queryParts.push(`after:${filters.after}`);
  }

  if (filters.before) {
    queryParts.push(`before:${filters.before}`);
  }

  return queryParts.join(' ');
}

/**
 * Parse email headers into object
 */
function parseHeaders(headers: Array<{ name: string; value: string }>): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (const header of headers) {
    parsed[header.name.toLowerCase()] = header.value;
  }
  return parsed;
}

/**
 * Extract email body from message payload
 */
function extractEmailBody(message: GmailMessage): { text?: string; html?: string } {
  const result: { text?: string; html?: string } = {};

  // Try direct body first
  if (message.payload.body?.data) {
    const decoded = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
    result.text = decoded;
    return result;
  }

  // Try parts (multipart emails)
  if (message.payload.parts) {
    for (const part of message.payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        result.text = Buffer.from(part.body.data, 'base64').toString('utf-8');
      }
      if (part.mimeType === 'text/html' && part.body?.data) {
        result.html = Buffer.from(part.body.data, 'base64').toString('utf-8');
      }
    }
  }

  return result;
}

/**
 * Fetch emails from Gmail with filters
 */
export async function fetchEmails(params: {
  userId: string;
  filters?: EmailListFilters;
  limit?: number;
  includeBody?: boolean;
}): Promise<Array<{
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  body?: { text?: string; html?: string };
  labels: string[];
  date: Date;
  isUnread: boolean;
}>> {
  const { userId, filters = {}, limit = 10, includeBody = false } = params;

  logger.info({ userId, filters, limit }, 'Fetching Gmail emails');

  const gmail = await getGmailClient(userId);

  // Build search query
  const query = buildSearchQuery(filters);

  // List messages
  const listResponse = await gmail.users.messages.list({
    userId: 'me',
    q: query || undefined,
    maxResults: limit,
  });

  const messages = listResponse.data.messages || [];

  if (messages.length === 0) {
    return [];
  }

  // Fetch full message details
  const emails = await Promise.all(
    messages.map(async (msg) => {
      const fullMessage = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id!,
        format: includeBody ? 'full' : 'metadata',
        metadataHeaders: ['From', 'To', 'Subject', 'Date'],
      });

      const data = fullMessage.data as GmailMessage;
      const headers = parseHeaders(data.payload.headers);

      return {
        id: data.id,
        threadId: data.threadId,
        from: headers['from'] || '',
        to: headers['to'] || '',
        subject: headers['subject'] || '',
        snippet: data.snippet,
        body: includeBody ? extractEmailBody(data) : undefined,
        labels: data.labelIds || [],
        date: new Date(parseInt(data.internalDate)),
        isUnread: data.labelIds?.includes('UNREAD') || false,
      };
    })
  );

  logger.info({ userId, count: emails.length }, 'Gmail emails fetched');

  return emails;
}

/**
 * Add labels to an email
 */
export async function addLabels(params: {
  userId: string;
  emailId: string;
  labels: string[];
}): Promise<{ success: boolean }> {
  const { userId, emailId, labels } = params;

  logger.info({ userId, emailId, labels }, 'Adding Gmail labels');

  const gmail = await getGmailClient(userId);

  await gmail.users.messages.modify({
    userId: 'me',
    id: emailId,
    requestBody: {
      addLabelIds: labels,
    },
  });

  logger.info({ userId, emailId, labels }, 'Gmail labels added');

  return { success: true };
}

/**
 * Remove labels from an email
 */
export async function removeLabels(params: {
  userId: string;
  emailId: string;
  labels: string[];
}): Promise<{ success: boolean }> {
  const { userId, emailId, labels } = params;

  logger.info({ userId, emailId, labels }, 'Removing Gmail labels');

  const gmail = await getGmailClient(userId);

  await gmail.users.messages.modify({
    userId: 'me',
    id: emailId,
    requestBody: {
      removeLabelIds: labels,
    },
  });

  logger.info({ userId, emailId, labels }, 'Gmail labels removed');

  return { success: true };
}

/**
 * Mark email as read
 */
export async function markAsRead(params: {
  userId: string;
  emailId: string;
}): Promise<{ success: boolean }> {
  const { userId, emailId } = params;

  logger.info({ userId, emailId }, 'Marking Gmail email as read');

  const gmail = await getGmailClient(userId);

  await gmail.users.messages.modify({
    userId: 'me',
    id: emailId,
    requestBody: {
      removeLabelIds: ['UNREAD'],
    },
  });

  logger.info({ userId, emailId }, 'Gmail email marked as read');

  return { success: true };
}

/**
 * Mark email as unread
 */
export async function markAsUnread(params: {
  userId: string;
  emailId: string;
}): Promise<{ success: boolean }> {
  const { userId, emailId } = params;

  logger.info({ userId, emailId }, 'Marking Gmail email as unread');

  const gmail = await getGmailClient(userId);

  await gmail.users.messages.modify({
    userId: 'me',
    id: emailId,
    requestBody: {
      addLabelIds: ['UNREAD'],
    },
  });

  logger.info({ userId, emailId }, 'Gmail email marked as unread');

  return { success: true };
}

/**
 * Move email to trash
 */
export async function moveToTrash(params: {
  userId: string;
  emailId: string;
}): Promise<{ success: boolean }> {
  const { userId, emailId } = params;

  logger.info({ userId, emailId }, 'Moving Gmail email to trash');

  const gmail = await getGmailClient(userId);

  await gmail.users.messages.trash({
    userId: 'me',
    id: emailId,
  });

  logger.info({ userId, emailId }, 'Gmail email moved to trash');

  return { success: true };
}

/**
 * Archive email (remove from inbox)
 */
export async function archiveEmail(params: {
  userId: string;
  emailId: string;
}): Promise<{ success: boolean }> {
  const { userId, emailId } = params;

  logger.info({ userId, emailId }, 'Archiving Gmail email');

  const gmail = await getGmailClient(userId);

  await gmail.users.messages.modify({
    userId: 'me',
    id: emailId,
    requestBody: {
      removeLabelIds: ['INBOX'],
    },
  });

  logger.info({ userId, emailId }, 'Gmail email archived');

  return { success: true };
}

/**
 * Get all available labels
 */
export async function getLabels(params: {
  userId: string;
}): Promise<Array<{ id: string; name: string; type: string }>> {
  const { userId } = params;

  logger.info({ userId }, 'Fetching Gmail labels');

  const gmail = await getGmailClient(userId);

  const response = await gmail.users.labels.list({
    userId: 'me',
  });

  const labels = (response.data.labels || []).map((label) => ({
    id: label.id || '',
    name: label.name || '',
    type: label.type || '',
  }));

  logger.info({ userId, count: labels.length }, 'Gmail labels fetched');

  return labels;
}
