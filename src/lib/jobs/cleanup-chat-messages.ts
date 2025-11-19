import { db } from '@/lib/db';
import { chatMessagesTable, chatConversationsTable } from '@/lib/schema';
import { lt, and, eq, sql, inArray } from 'drizzle-orm';
import { logger } from '@/lib/logger';

/**
 * Clean up old chat messages and inactive conversations
 *
 * Retention policy:
 * - Active conversations: Keep last 100 messages per conversation
 * - Inactive conversations (90+ days): Archive or delete
 *
 * This prevents unbounded growth from AI chat interactions.
 *
 * Schedule: Daily at 3 AM
 */
export async function cleanupChatMessages(): Promise<void> {
  try {
    let totalMessagesDeleted = 0;
    let totalConversationsArchived = 0;

    // 1. Clean up old messages in active conversations (keep last 100 per conversation)
    // Uses window functions for optimal performance (single query instead of N queries)
    const deleteResult = await db.execute(sql`
      DELETE FROM ${chatMessagesTable}
      WHERE id IN (
        SELECT id FROM (
          SELECT
            ${chatMessagesTable.id} as id,
            ROW_NUMBER() OVER (
              PARTITION BY ${chatMessagesTable.conversationId}
              ORDER BY ${chatMessagesTable.createdAt} DESC
            ) as rn
          FROM ${chatMessagesTable}
          WHERE ${chatMessagesTable.conversationId} IN (
            SELECT ${chatConversationsTable.id}
            FROM ${chatConversationsTable}
            WHERE ${chatConversationsTable.status} = 'active'
          )
        ) ranked
        WHERE rn > 100
      )
    `);

    totalMessagesDeleted += deleteResult.rowCount || 0;

    // 2. Archive inactive conversations (no updates in 90+ days)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const archiveResult = await db
      .update(chatConversationsTable)
      .set({ status: 'archived' })
      .where(
        and(
          eq(chatConversationsTable.status, 'active'),
          lt(chatConversationsTable.updatedAt, ninetyDaysAgo)
        )
      );

    totalConversationsArchived = archiveResult.rowCount || 0;

    // 3. Delete messages from conversations archived more than 30 days ago
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const archivedConversations = await db
      .select({ id: chatConversationsTable.id })
      .from(chatConversationsTable)
      .where(
        and(
          eq(chatConversationsTable.status, 'archived'),
          lt(chatConversationsTable.updatedAt, thirtyDaysAgo)
        )
      );

    if (archivedConversations.length > 0) {
      const archivedIds = archivedConversations.map((c) => c.id);

      const archivedMessagesResult = await db
        .delete(chatMessagesTable)
        .where(inArray(chatMessagesTable.conversationId, archivedIds));

      totalMessagesDeleted += archivedMessagesResult.rowCount || 0;
    }

    if (totalMessagesDeleted > 0 || totalConversationsArchived > 0) {
      logger.info(
        {
          messagesDeleted: totalMessagesDeleted,
          conversationsArchived: totalConversationsArchived,
          archivedConversationsWithDeletedMessages: archivedConversations.length,
        },
        'Cleaned up chat messages and archived conversations'
      );
    }
  } catch (error) {
    logger.error({ error }, 'Failed to cleanup chat messages');
    throw error;
  }
}
