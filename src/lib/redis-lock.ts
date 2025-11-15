import { Redis } from 'ioredis';
import { logger } from './logger';

/**
 * Redis Connection for Distributed Locking
 *
 * Provides a shared Redis connection for distributed locking mechanisms
 * Used by workflow scheduler for leader election
 */

let redisConnection: Redis | null = null;

/**
 * Get or create Redis connection for distributed locking
 * Returns null if Redis is not configured
 */
export function getRedisConnection(): Redis | null {
  // If no Redis URL, return null
  if (!process.env.REDIS_URL) {
    return null;
  }

  // Return existing connection if available
  if (redisConnection) {
    return redisConnection;
  }

  try {
    // Create new connection
    redisConnection = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy: (times) => {
        if (times > 3) {
          logger.error('Redis lock connection failed after 3 retries');
          return null;
        }
        const delay = Math.min(times * 1000, 5000);
        logger.warn({ attempt: times, delay }, 'Retrying Redis lock connection');
        return delay;
      },
    });

    redisConnection.on('error', (error) => {
      logger.error({ error }, 'Redis lock connection error');
    });

    redisConnection.on('connect', () => {
      logger.info('Redis lock connection established');
    });

    return redisConnection;
  } catch (error) {
    logger.error({ error }, 'Failed to create Redis lock connection');
    return null;
  }
}

/**
 * Close Redis lock connection
 */
export async function closeRedisLockConnection() {
  if (redisConnection) {
    await redisConnection.quit();
    redisConnection = null;
    logger.info('Redis lock connection closed');
  }
}
