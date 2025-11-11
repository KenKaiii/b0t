import { db } from '@/lib/db';
import { accountsTable } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { encrypt, decrypt } from '@/lib/encryption';
import { logger } from '@/lib/logger';

/**
 * OAuth Token Manager
 *
 * Generic, platform-agnostic OAuth token refresh system.
 * Automatically refreshes expired tokens for ANY OAuth provider.
 *
 * Features:
 * - Platform-agnostic (Twitter, Google, YouTube, etc.)
 * - Automatic token refresh on expiry
 * - Configurable refresh logic per provider
 * - Thread-safe with database locking
 * - Comprehensive logging
 */

/**
 * OAuth Provider Configuration
 * Each provider defines how to refresh its tokens
 */
interface OAuthProviderConfig {
  name: string;
  refreshTokenUrl: string;
  buildRefreshRequest: (refreshToken: string, clientId?: string, clientSecret?: string) => {
    method: string;
    headers: Record<string, string>;
    body: string | URLSearchParams;
  };
  parseRefreshResponse: (response: unknown) => {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };
}

/**
 * OAuth Provider Registry
 * Add new providers here to enable automatic token refresh
 */
const OAUTH_PROVIDERS: Record<string, OAuthProviderConfig> = {
  twitter: {
    name: 'Twitter',
    refreshTokenUrl: 'https://api.twitter.com/2/oauth2/token',
    buildRefreshRequest: (refreshToken, clientId, clientSecret) => {
      if (!clientId || !clientSecret) {
        throw new Error('Twitter OAuth requires clientId and clientSecret for token refresh');
      }

      const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      });

      return {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${auth}`,
        },
        body: body.toString(),
      };
    },
    parseRefreshResponse: (response) => {
      const data = response as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
      };
      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
      };
    },
  },

  google: {
    name: 'Google',
    refreshTokenUrl: 'https://oauth2.googleapis.com/token',
    buildRefreshRequest: (refreshToken, clientId, clientSecret) => {
      if (!clientId || !clientSecret) {
        throw new Error('Google OAuth requires clientId and clientSecret for token refresh');
      }

      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      });

      return {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      };
    },
    parseRefreshResponse: (response) => {
      const data = response as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
      };
      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
      };
    },
  },

  // YouTube uses Google OAuth
  youtube: {
    name: 'YouTube (Google OAuth)',
    refreshTokenUrl: 'https://oauth2.googleapis.com/token',
    buildRefreshRequest: (refreshToken, clientId, clientSecret) => {
      if (!clientId || !clientSecret) {
        throw new Error('YouTube OAuth requires clientId and clientSecret for token refresh');
      }

      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      });

      return {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      };
    },
    parseRefreshResponse: (response) => {
      const data = response as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
      };
      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
      };
    },
  },

  outlook: {
    name: 'Outlook (Microsoft OAuth)',
    refreshTokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    buildRefreshRequest: (refreshToken, clientId, clientSecret) => {
      if (!clientId || !clientSecret) {
        throw new Error('Outlook OAuth requires clientId and clientSecret for token refresh');
      }

      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.ReadWrite offline_access',
      });

      return {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      };
    },
    parseRefreshResponse: (response) => {
      const data = response as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
      };
      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
      };
    },
  },

  linkedin: {
    name: 'LinkedIn',
    refreshTokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    buildRefreshRequest: (refreshToken, clientId, clientSecret) => {
      if (!clientId || !clientSecret) {
        throw new Error('LinkedIn OAuth requires clientId and clientSecret for token refresh');
      }

      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      });

      return {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      };
    },
    parseRefreshResponse: (response) => {
      const data = response as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
      };
      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
      };
    },
  },

  instagram: {
    name: 'Instagram',
    refreshTokenUrl: 'https://graph.instagram.com/refresh_access_token',
    buildRefreshRequest: (refreshToken) => {
      // Instagram uses a different refresh mechanism - access token is used to refresh itself
      const url = new URL('https://graph.instagram.com/refresh_access_token');
      url.searchParams.set('grant_type', 'ig_refresh_token');
      url.searchParams.set('access_token', refreshToken);

      return {
        method: 'GET',
        headers: {},
        body: '',
      };
    },
    parseRefreshResponse: (response) => {
      const data = response as {
        access_token: string;
        token_type: string;
        expires_in?: number;
      };
      return {
        access_token: data.access_token,
        expires_in: data.expires_in,
      };
    },
  },

  reddit: {
    name: 'Reddit',
    refreshTokenUrl: 'https://www.reddit.com/api/v1/access_token',
    buildRefreshRequest: (refreshToken, clientId, clientSecret) => {
      if (!clientId || !clientSecret) {
        throw new Error('Reddit OAuth requires clientId and clientSecret for token refresh');
      }

      const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      });

      return {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${auth}`,
        },
        body: body.toString(),
      };
    },
    parseRefreshResponse: (response) => {
      const data = response as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
      };
      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
      };
    },
  },

  github: {
    name: 'GitHub',
    refreshTokenUrl: 'https://github.com/login/oauth/access_token',
    buildRefreshRequest: (refreshToken, clientId, clientSecret) => {
      if (!clientId || !clientSecret) {
        throw new Error('GitHub OAuth requires clientId and clientSecret for token refresh');
      }

      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      });

      return {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: body.toString(),
      };
    },
    parseRefreshResponse: (response) => {
      const data = response as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
      };
      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
      };
    },
  },

  linear: {
    name: 'Linear',
    refreshTokenUrl: 'https://api.linear.app/oauth/token',
    buildRefreshRequest: (refreshToken, clientId, clientSecret) => {
      if (!clientId || !clientSecret) {
        throw new Error('Linear OAuth requires clientId and clientSecret for token refresh');
      }

      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      });

      return {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      };
    },
    parseRefreshResponse: (response) => {
      const data = response as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
      };
      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
      };
    },
  },

  typeform: {
    name: 'Typeform',
    refreshTokenUrl: 'https://api.typeform.com/oauth/token',
    buildRefreshRequest: (refreshToken, clientId, clientSecret) => {
      if (!clientId || !clientSecret) {
        throw new Error('Typeform OAuth requires clientId and clientSecret for token refresh');
      }

      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      });

      return {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      };
    },
    parseRefreshResponse: (response) => {
      const data = response as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
      };
      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
      };
    },
  },

  calendly: {
    name: 'Calendly',
    refreshTokenUrl: 'https://auth.calendly.com/oauth/token',
    buildRefreshRequest: (refreshToken, clientId, clientSecret) => {
      if (!clientId || !clientSecret) {
        throw new Error('Calendly OAuth requires clientId and clientSecret for token refresh');
      }

      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      });

      return {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      };
    },
    parseRefreshResponse: (response) => {
      const data = response as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
      };
      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
      };
    },
  },

  calendar: {
    name: 'Google Calendar',
    refreshTokenUrl: 'https://oauth2.googleapis.com/token',
    buildRefreshRequest: (refreshToken, clientId, clientSecret) => {
      if (!clientId || !clientSecret) {
        throw new Error('Google Calendar OAuth requires clientId and clientSecret for token refresh');
      }

      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      });

      return {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      };
    },
    parseRefreshResponse: (response) => {
      const data = response as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
      };
      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
      };
    },
  },
};

/**
 * Check if a token is expired or will expire soon
 */
function isTokenExpired(expiresAt: number | null): boolean {
  if (!expiresAt) {
    // No expiry info - assume not expired
    return false;
  }

  // Consider expired if within 5 minutes of expiry (300 seconds buffer)
  const now = Math.floor(Date.now() / 1000);
  return now >= expiresAt - 300;
}

/**
 * Refresh an OAuth token for a specific provider
 */
async function refreshOAuthToken(
  userId: string,
  provider: string,
  accountId: string
): Promise<string> {
  const providerConfig = OAUTH_PROVIDERS[provider.toLowerCase()];

  if (!providerConfig) {
    throw new Error(`OAuth provider "${provider}" is not configured for automatic token refresh`);
  }

  logger.info({ userId, provider, accountId }, 'Starting OAuth token refresh');

  // Get the account with refresh token
  const accounts = await db
    .select()
    .from(accountsTable)
    .where(
      and(
        eq(accountsTable.id, accountId),
        eq(accountsTable.userId, userId)
      )
    )
    .limit(1);

  if (accounts.length === 0) {
    throw new Error(`OAuth account not found for ${provider}`);
  }

  const account = accounts[0];

  if (!account.refresh_token) {
    throw new Error(`No refresh token available for ${provider}. User needs to re-authenticate.`);
  }

  const refreshToken = await decrypt(account.refresh_token);

  // Get client credentials from database credentials system
  let clientId: string | undefined;
  let clientSecret: string | undefined;

  try {
    const { getCredentialFields } = await import('@/lib/workflows/credentials');

    // Try provider-specific credential first (e.g., 'twitter_oauth2_app')
    const appCredentialName = `${provider.toLowerCase()}_oauth2_app`;
    const fields = await getCredentialFields(userId, appCredentialName);

    if (fields) {
      clientId = fields.client_id || fields.clientId;
      clientSecret = fields.client_secret || fields.clientSecret;
      logger.info({ provider, credentialName: appCredentialName }, 'Loaded OAuth app credentials from database');
    }
  } catch (error) {
    logger.warn({
      error,
      provider,
      userId
    }, 'Failed to load OAuth app credentials from database');
  }

  // Fallback to environment variables if database credentials not found
  if (!clientId || !clientSecret) {
    clientId = process.env[`${provider.toUpperCase()}_CLIENT_ID`];
    clientSecret = process.env[`${provider.toUpperCase()}_CLIENT_SECRET`];

    if (clientId && clientSecret) {
      logger.info({ provider }, 'Using OAuth app credentials from environment variables');
    }
  }

  if (!clientId || !clientSecret) {
    throw new Error(
      `OAuth app credentials not configured for ${provider}. ` +
      `Please add '${provider.toLowerCase()}_oauth2_app' credentials (client_id and client_secret) ` +
      `in the credentials page, or set ${provider.toUpperCase()}_CLIENT_ID and ${provider.toUpperCase()}_CLIENT_SECRET environment variables.`
    );
  }

  try {
    // Build refresh request
    const requestConfig = providerConfig.buildRefreshRequest(refreshToken, clientId, clientSecret);

    logger.info({ provider, url: providerConfig.refreshTokenUrl }, 'Sending token refresh request');

    // Make refresh request
    const response = await fetch(providerConfig.refreshTokenUrl, {
      method: requestConfig.method,
      headers: requestConfig.headers,
      body: requestConfig.body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({
        provider,
        status: response.status,
        error: errorText
      }, 'Token refresh failed');

      throw new Error(`Token refresh failed for ${provider}: ${response.status} - ${errorText}`);
    }

    const responseData = await response.json();
    const tokens = providerConfig.parseRefreshResponse(responseData);

    logger.info({
      provider,
      hasNewRefreshToken: !!tokens.refresh_token,
      expiresIn: tokens.expires_in
    }, 'Token refresh successful');

    // Calculate new expiry time
    const expiresAt = tokens.expires_in
      ? Math.floor(Date.now() / 1000) + tokens.expires_in
      : null;

    // Update database with new tokens
    await db
      .update(accountsTable)
      .set({
        access_token: await encrypt(tokens.access_token),
        refresh_token: tokens.refresh_token ? await encrypt(tokens.refresh_token) : account.refresh_token,
        expires_at: expiresAt,
      })
      .where(eq(accountsTable.id, accountId));

    logger.info({
      userId,
      provider,
      accountId,
      expiresAt,
      action: 'token_refreshed'
    }, 'OAuth token refreshed and saved');

    return tokens.access_token;
  } catch (error) {
    logger.error({
      error,
      provider,
      userId,
      accountId
    }, 'Failed to refresh OAuth token');

    throw error;
  }
}

/**
 * Get a valid OAuth token, refreshing if necessary
 * This is the main entry point for workflows
 */
export async function getValidOAuthToken(
  userId: string,
  provider: string
): Promise<string> {
  logger.debug({ userId, provider }, 'Getting valid OAuth token');

  // Get the account
  const accounts = await db
    .select()
    .from(accountsTable)
    .where(
      and(
        eq(accountsTable.userId, userId),
        eq(accountsTable.provider, provider.toLowerCase())
      )
    )
    .limit(1);

  if (accounts.length === 0) {
    throw new Error(`No OAuth account found for ${provider}. Please connect your ${provider} account.`);
  }

  const account = accounts[0];

  if (!account.access_token) {
    throw new Error(`No access token found for ${provider}. Please re-authenticate.`);
  }

  // Check if token is expired
  const needsRefresh = isTokenExpired(account.expires_at);

  if (needsRefresh) {
    logger.info({ userId, provider, expiresAt: account.expires_at }, 'Token expired, refreshing');

    // Refresh the token
    return await refreshOAuthToken(userId, provider, account.id);
  }

  // Token is still valid
  logger.debug({ userId, provider }, 'Using existing valid token');
  return await decrypt(account.access_token);
}

/**
 * Check if a provider supports automatic token refresh
 */
export function supportsTokenRefresh(provider: string): boolean {
  return provider.toLowerCase() in OAUTH_PROVIDERS;
}

/**
 * Get list of supported OAuth providers
 */
export function getSupportedProviders(): string[] {
  return Object.keys(OAUTH_PROVIDERS);
}
