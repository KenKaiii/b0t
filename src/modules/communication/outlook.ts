import { Client } from '@microsoft/microsoft-graph-client';
import { getValidOAuthToken } from '@/lib/oauth-token-manager';
import { logger } from '@/lib/logger';

/**
 * Outlook Module
 *
 * Provides Outlook/Microsoft 365 email management functionality using Microsoft Graph API.
 * Supports fetching, updating categories, moving to folders, and marking emails.
 *
 * Required Microsoft Graph API Scopes:
 * - Mail.Read (for read operations)
 * - Mail.ReadWrite (for update operations)
 *
 * Authentication:
 * - Uses OAuth 2.0 via outlook credential system
 * - Automatic token refresh via oauth-token-manager
 */

interface OutlookMessage {
  id: string;
  subject: string;
  from: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
  toRecipients: Array<{
    emailAddress: {
      name: string;
      address: string;
    };
  }>;
  body: {
    contentType: string;
    content: string;
  };
  bodyPreview: string;
  categories: string[];
  isRead: boolean;
  receivedDateTime: string;
  importance: string;
  hasAttachments: boolean;
}

interface EmailListFilters {
  folder?: string; // 'inbox', 'sentitems', 'drafts', or folder ID
  isUnread?: boolean;
  hasNoCategories?: boolean;
  from?: string;
  to?: string;
  subject?: string;
  importance?: 'low' | 'normal' | 'high';
}

/**
 * Get authenticated Microsoft Graph client
 */
async function getGraphClient(userId: string): Promise<Client> {
  const accessToken = await getValidOAuthToken(userId, 'outlook');

  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}

/**
 * Build OData filter query from filters
 */
function buildFilterQuery(filters: EmailListFilters): string {
  const filterParts: string[] = [];

  if (filters.isUnread !== undefined) {
    filterParts.push(`isRead eq ${!filters.isUnread}`);
  }

  if (filters.from) {
    filterParts.push(`from/emailAddress/address eq '${filters.from}'`);
  }

  if (filters.subject) {
    filterParts.push(`contains(subject, '${filters.subject}')`);
  }

  if (filters.importance) {
    filterParts.push(`importance eq '${filters.importance}'`);
  }

  // Note: hasNoCategories requires custom logic as Graph doesn't support "categories/any()"
  // We'll filter this client-side after fetching

  return filterParts.join(' and ');
}

/**
 * Fetch emails from Outlook with filters
 */
export async function fetchEmails(params: {
  userId: string;
  filters?: EmailListFilters;
  limit?: number;
  includeBody?: boolean;
}): Promise<
  Array<{
    id: string;
    from: string;
    to: string;
    subject: string;
    snippet: string;
    body?: { text?: string; html?: string };
    categories: string[];
    date: Date;
    isUnread: boolean;
    importance: string;
    hasAttachments: boolean;
  }>
> {
  const { userId, filters = {}, limit = 10, includeBody = false } = params;

  logger.info({ userId, filters, limit }, 'Fetching Outlook emails');

  const client = await getGraphClient(userId);

  // Build folder path
  const folder = filters.folder || 'inbox';
  const folderPath = `/me/mailFolders/${folder}/messages`;

  // Build query
  let query = client.api(folderPath).top(limit).select(
    includeBody
      ? 'id,subject,from,toRecipients,body,bodyPreview,categories,isRead,receivedDateTime,importance,hasAttachments'
      : 'id,subject,from,toRecipients,bodyPreview,categories,isRead,receivedDateTime,importance,hasAttachments'
  );

  // Add filter if present
  const filterQuery = buildFilterQuery(filters);
  if (filterQuery) {
    query = query.filter(filterQuery);
  }

  // Execute request
  const response = await query.get();
  let messages: OutlookMessage[] = response.value || [];

  // Client-side filter for hasNoCategories (Graph API doesn't support this natively)
  if (filters.hasNoCategories) {
    messages = messages.filter((msg) => !msg.categories || msg.categories.length === 0);
  }

  // Transform to standard format
  const emails = messages.map((msg) => ({
    id: msg.id,
    from: msg.from?.emailAddress?.address || '',
    to: msg.toRecipients?.map((r) => r.emailAddress.address).join(', ') || '',
    subject: msg.subject || '',
    snippet: msg.bodyPreview || '',
    body: includeBody
      ? {
          text: msg.body.contentType === 'text' ? msg.body.content : undefined,
          html: msg.body.contentType === 'html' ? msg.body.content : undefined,
        }
      : undefined,
    categories: msg.categories || [],
    date: new Date(msg.receivedDateTime),
    isUnread: !msg.isRead,
    importance: msg.importance || 'normal',
    hasAttachments: msg.hasAttachments || false,
  }));

  logger.info({ userId, count: emails.length }, 'Outlook emails fetched');

  return emails;
}

/**
 * Update categories on an email
 */
export async function updateCategories(params: {
  userId: string;
  emailId: string;
  categories: string[];
}): Promise<{ success: boolean }> {
  const { userId, emailId, categories } = params;

  logger.info({ userId, emailId, categories }, 'Updating Outlook categories');

  const client = await getGraphClient(userId);

  await client.api(`/me/messages/${emailId}`).patch({
    categories,
  });

  logger.info({ userId, emailId, categories }, 'Outlook categories updated');

  return { success: true };
}

/**
 * Add categories to an email (preserves existing)
 */
export async function addCategories(params: {
  userId: string;
  emailId: string;
  categories: string[];
}): Promise<{ success: boolean }> {
  const { userId, emailId, categories } = params;

  logger.info({ userId, emailId, categories }, 'Adding Outlook categories');

  const client = await getGraphClient(userId);

  // Get current categories
  const message = await client.api(`/me/messages/${emailId}`).select('categories').get();

  const existingCategories = message.categories || [];
  const newCategories = Array.from(new Set([...existingCategories, ...categories]));

  await client.api(`/me/messages/${emailId}`).patch({
    categories: newCategories,
  });

  logger.info({ userId, emailId, addedCategories: categories }, 'Outlook categories added');

  return { success: true };
}

/**
 * Move email to a folder
 */
export async function moveToFolder(params: {
  userId: string;
  emailId: string;
  folderId: string; // Can be 'deleteditems', 'inbox', or actual folder ID
}): Promise<{ success: boolean; newId: string }> {
  const { userId, emailId, folderId } = params;

  logger.info({ userId, emailId, folderId }, 'Moving Outlook email to folder');

  const client = await getGraphClient(userId);

  const result = await client.api(`/me/messages/${emailId}/move`).post({
    destinationId: folderId,
  });

  logger.info({ userId, emailId, folderId, newId: result.id }, 'Outlook email moved');

  return { success: true, newId: result.id };
}

/**
 * Mark email as read
 */
export async function markAsRead(params: {
  userId: string;
  emailId: string;
}): Promise<{ success: boolean }> {
  const { userId, emailId } = params;

  logger.info({ userId, emailId }, 'Marking Outlook email as read');

  const client = await getGraphClient(userId);

  await client.api(`/me/messages/${emailId}`).patch({
    isRead: true,
  });

  logger.info({ userId, emailId }, 'Outlook email marked as read');

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

  logger.info({ userId, emailId }, 'Marking Outlook email as unread');

  const client = await getGraphClient(userId);

  await client.api(`/me/messages/${emailId}`).patch({
    isRead: false,
  });

  logger.info({ userId, emailId }, 'Outlook email marked as unread');

  return { success: true };
}

/**
 * Move email to deleted items (trash)
 */
export async function moveToTrash(params: {
  userId: string;
  emailId: string;
}): Promise<{ success: boolean }> {
  const { userId, emailId } = params;

  logger.info({ userId, emailId }, 'Moving Outlook email to trash');

  const result = await moveToFolder({
    userId,
    emailId,
    folderId: 'deleteditems',
  });

  logger.info({ userId, emailId }, 'Outlook email moved to trash');

  return { success: result.success };
}

/**
 * Get all mail folders
 */
export async function getFolders(params: {
  userId: string;
}): Promise<Array<{ id: string; displayName: string; unreadItemCount: number }>> {
  const { userId } = params;

  logger.info({ userId }, 'Fetching Outlook folders');

  const client = await getGraphClient(userId);

  const response = await client
    .api('/me/mailFolders')
    .select('id,displayName,unreadItemCount')
    .get();

  const folders = response.value || [];

  logger.info({ userId, count: folders.length }, 'Outlook folders fetched');

  return folders.map((folder: { id: string; displayName: string; unreadItemCount: number }) => ({
    id: folder.id,
    displayName: folder.displayName,
    unreadItemCount: folder.unreadItemCount || 0,
  }));
}

/**
 * Get all Outlook categories
 */
export async function getCategories(params: {
  userId: string;
}): Promise<Array<{ displayName: string; color: string }>> {
  const { userId } = params;

  logger.info({ userId }, 'Fetching Outlook categories');

  const client = await getGraphClient(userId);

  const response = await client.api('/me/outlook/masterCategories').get();

  const categories = response.value || [];

  logger.info({ userId, count: categories.length }, 'Outlook categories fetched');

  return categories.map((cat: { displayName: string; color: string }) => ({
    displayName: cat.displayName,
    color: cat.color,
  }));
}
