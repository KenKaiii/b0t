'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useState } from 'react';

interface OAuthProvider {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  authorizeUrl: string;
  bgColor: string;
  textColor: string;
}

const OAUTH_PROVIDERS: OAuthProvider[] = [
  // Gmail and Outlook OAuth handled in workflow credential modal only
];

interface OAuthProvidersProps {
  connectedProviders?: string[];
}

export function OAuthProviders({ connectedProviders = [] }: OAuthProvidersProps) {
  const [connecting, setConnecting] = useState<string | null>(null);

  const handleConnect = async (provider: OAuthProvider) => {
    setConnecting(provider.id);
    // Redirect to OAuth authorization URL
    window.location.href = provider.authorizeUrl;
  };

  // Don't render anything if there are no providers
  if (OAUTH_PROVIDERS.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-1">OAuth Connections</h3>
        <p className="text-sm text-muted-foreground">
          Connect your accounts with secure OAuth authentication
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {OAUTH_PROVIDERS.map((provider) => {
          const isConnected = connectedProviders.includes(provider.id);

          return (
            <Card key={provider.id} className="relative overflow-hidden">
              <div className={`absolute top-0 left-0 w-full h-1 ${provider.bgColor}`} />
              <CardHeader className="pt-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${provider.bgColor} ${provider.textColor}`}>
                      {provider.icon}
                    </div>
                    <div>
                      <CardTitle className="text-base">{provider.name}</CardTitle>
                      {isConnected && (
                        <span className="text-xs text-green-600 dark:text-green-400">
                          ✓ Connected
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <CardDescription className="text-xs">
                  {provider.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => handleConnect(provider)}
                  disabled={connecting === provider.id}
                  className="w-full"
                  variant={isConnected ? 'outline' : 'default'}
                >
                  {connecting === provider.id
                    ? 'Connecting...'
                    : isConnected
                      ? 'Reconnect'
                      : `Connect ${provider.name.split(' ')[0]}`}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950 p-4">
        <p className="text-xs text-blue-900 dark:text-blue-100">
          <strong>Note:</strong> OAuth connections are secure and allow the app to access your emails on your behalf.
          You can revoke access anytime from your Google or Microsoft account settings.
        </p>
      </div>
    </div>
  );
}
