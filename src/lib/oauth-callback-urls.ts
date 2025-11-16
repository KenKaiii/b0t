/**
 * OAuth Callback URL Configuration
 *
 * Maps platform credential types to their OAuth callback URLs.
 * Used to display copy-able redirect URIs for OAuth app setup.
 */

export interface OAuthCallbackConfig {
  platform: string;
  callbackPath: string;
  providerName: string;
  setupUrl?: string; // Link to provider's OAuth setup page
}

// Platforms that require OAuth callback URLs
export const OAUTH_PLATFORMS: Record<string, OAuthCallbackConfig> = {
  google_oauth_app: {
    platform: 'google_oauth_app',
    callbackPath: '/api/auth/google/callback',
    providerName: 'Google Cloud Console',
    setupUrl: 'https://console.cloud.google.com/apis/credentials',
  },
  twitter_oauth2_app: {
    platform: 'twitter_oauth2_app',
    callbackPath: '/api/auth/twitter/callback',
    providerName: 'X (Twitter) Developer Portal',
    setupUrl: 'https://developer.twitter.com/en/portal/projects-and-apps',
  },
  youtube_oauth_app: {
    platform: 'youtube_oauth_app',
    callbackPath: '/api/auth/youtube/callback',
    providerName: 'Google Cloud Console',
    setupUrl: 'https://console.cloud.google.com/apis/credentials',
  },
  outlook_oauth_app: {
    platform: 'outlook_oauth_app',
    callbackPath: '/api/auth/outlook/callback',
    providerName: 'Azure App Registration',
    setupUrl: 'https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade',
  },
};

/**
 * Get the full OAuth callback URL for a platform
 */
export function getOAuthCallbackUrl(platform: string): string | null {
  const config = OAUTH_PLATFORMS[platform];
  if (!config) return null;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
                  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3123');

  return `${baseUrl}${config.callbackPath}`;
}

/**
 * Check if a platform requires OAuth callback URL
 */
export function requiresOAuthCallback(platform: string): boolean {
  return platform in OAUTH_PLATFORMS;
}

/**
 * Get OAuth callback config for a platform
 */
export function getOAuthCallbackConfig(platform: string): OAuthCallbackConfig | null {
  return OAUTH_PLATFORMS[platform] || null;
}
