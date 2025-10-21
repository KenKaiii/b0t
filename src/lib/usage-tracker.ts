/**
 * Client-side and server-side usage tracking helper
 *
 * Tracks Twitter API usage for rate limit monitoring
 */

import { logger } from './logger';
import { db, useSQLite } from './db';

export async function trackTwitterUsage(type: 'post' | 'read'): Promise<void> {
  try {
    // Server-side: Update database directly (more reliable)
    if (typeof window === 'undefined') {
      await trackUsageDirectly(type);
      return;
    }

    // Client-side: Call API endpoint
    await fetch('/api/twitter/usage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type }),
    });

    logger.debug({ type }, 'Tracked Twitter API usage');
  } catch (error) {
    // Don't throw - usage tracking should never break the main flow
    logger.error({ error, type }, 'Failed to track Twitter API usage');
  }
}

/**
 * Direct database tracking (server-side only)
 */
async function trackUsageDirectly(type: 'post' | 'read'): Promise<void> {
  const usageKey = type === 'post' ? 'twitter_post_usage' : 'twitter_read_usage';

  try {
    const { eq } = await import('drizzle-orm');

    if (useSQLite) {
      // SQLite path
      const { appSettingsTableSQLite } = await import('./schema');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const typedDb = db as any;

      const existingRows = await typedDb
        .select()
        .from(appSettingsTableSQLite)
        .where(eq(appSettingsTableSQLite.key, usageKey));

      const existing = existingRows[0];
      const now = Date.now();

      const usage = existing
        ? JSON.parse(existing.value)
        : {
            window15min: { count: 0, resetAt: now + 15 * 60 * 1000 },
            window1hr: { count: 0, resetAt: now + 60 * 60 * 1000 },
            window24hr: { count: 0, resetAt: now + 24 * 60 * 60 * 1000 },
            window30days: { count: 0, resetAt: now + 30 * 24 * 60 * 60 * 1000 },
          };

      // Reset expired windows
      if (usage.window15min.resetAt < now) {
        usage.window15min = { count: 0, resetAt: now + 15 * 60 * 1000 };
      }
      if (usage.window1hr.resetAt < now) {
        usage.window1hr = { count: 0, resetAt: now + 60 * 60 * 1000 };
      }
      if (usage.window24hr.resetAt < now) {
        usage.window24hr = { count: 0, resetAt: now + 24 * 60 * 60 * 1000 };
      }
      if (usage.window30days.resetAt < now) {
        usage.window30days = { count: 0, resetAt: now + 30 * 24 * 60 * 60 * 1000 };
      }

      // Increment all windows
      usage.window15min.count++;
      usage.window1hr.count++;
      usage.window24hr.count++;
      usage.window30days.count++;

      // Save back to database
      if (existing) {
        const { sql } = await import('drizzle-orm');
        await typedDb
          .update(appSettingsTableSQLite)
          .set({
            value: JSON.stringify(usage),
            updatedAt: sql`(unixepoch())`
          })
          .where(eq(appSettingsTableSQLite.key, usageKey));
      } else {
        await typedDb
          .insert(appSettingsTableSQLite)
          .values({ key: usageKey, value: JSON.stringify(usage) });
      }

      logger.debug({ type, usage }, 'Tracked Twitter API usage (direct)');
    } else {
      // PostgreSQL path
      const { appSettingsTablePostgres } = await import('./schema');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const typedDb = db as any;

      const existingRows = await typedDb
        .select()
        .from(appSettingsTablePostgres)
        .where(eq(appSettingsTablePostgres.key, usageKey));

      const existing = existingRows[0];
      const now = Date.now();

      const usage = existing
        ? JSON.parse(existing.value)
        : {
            window15min: { count: 0, resetAt: now + 15 * 60 * 1000 },
            window1hr: { count: 0, resetAt: now + 60 * 60 * 1000 },
            window24hr: { count: 0, resetAt: now + 24 * 60 * 60 * 1000 },
            window30days: { count: 0, resetAt: now + 30 * 24 * 60 * 60 * 1000 },
          };

      // Reset expired windows
      if (usage.window15min.resetAt < now) {
        usage.window15min = { count: 0, resetAt: now + 15 * 60 * 1000 };
      }
      if (usage.window1hr.resetAt < now) {
        usage.window1hr = { count: 0, resetAt: now + 60 * 60 * 1000 };
      }
      if (usage.window24hr.resetAt < now) {
        usage.window24hr = { count: 0, resetAt: now + 24 * 60 * 60 * 1000 };
      }
      if (usage.window30days.resetAt < now) {
        usage.window30days = { count: 0, resetAt: now + 30 * 24 * 60 * 60 * 1000 };
      }

      // Increment all windows
      usage.window15min.count++;
      usage.window1hr.count++;
      usage.window24hr.count++;
      usage.window30days.count++;

      // Save back to database
      if (existing) {
        await typedDb
          .update(appSettingsTablePostgres)
          .set({
            value: JSON.stringify(usage),
            updatedAt: new Date()
          })
          .where(eq(appSettingsTablePostgres.key, usageKey));
      } else {
        await typedDb
          .insert(appSettingsTablePostgres)
          .values({ key: usageKey, value: JSON.stringify(usage) });
      }

      logger.debug({ type, usage }, 'Tracked Twitter API usage (direct)');
    }
  } catch (error) {
    logger.error({ error, type }, 'Failed to track usage directly');
  }
}

/**
 * Track a post (tweet, reply, retweet, etc.)
 */
export function trackPost(): Promise<void> {
  return trackTwitterUsage('post');
}

/**
 * Track a read operation (search, fetch tweets, etc.)
 */
export function trackRead(): Promise<void> {
  return trackTwitterUsage('read');
}
