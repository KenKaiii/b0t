'use client';

import { useEffect, useState } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { useClient } from '@/components/providers/ClientProvider';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogIn, LogOut, Loader2, ChevronDown, Building2 } from 'lucide-react';
import { SystemStatusBadge } from '@/components/SystemStatusBadge';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useTranslations } from 'next-intl';

export function Header() {
  const t = useTranslations('common');
  const [currentTime, setCurrentTime] = useState<string>('');
  const [timezone, setTimezone] = useState<string>('');
  const { data: session, status } = useSession();
  const { currentClient, clients, setCurrentClient, isLoading: clientsLoading } = useClient();

  useEffect(() => {
    // Get user's timezone
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTimezone(tz);

    // Update time immediately and then every second
    const updateTime = () => {
      const now = new Date();
      const timeString = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        timeZone: tz,
      }).format(now);
      setCurrentTime(timeString);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleAuth = () => {
    if (session) {
      signOut({ callbackUrl: '/auth/signin' });
    } else {
      signIn();
    }
  };

  return (
    <header className="flex h-14 min-h-14 items-center px-4 md:px-6 bg-background-100 border-b border-gray-alpha-400">
      <nav className="flex w-full items-center justify-between">
        {/* Left side - Logo/Brand */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-0.5">
            <span className="text-xl font-bold bg-gradient-to-br from-primary via-blue-500 to-primary bg-clip-text text-transparent">
              b
            </span>
            <span className="text-xl font-bold bg-gradient-to-br from-blue-500 via-primary to-blue-500 bg-clip-text text-transparent">
              0
            </span>
            <span className="text-xl font-bold bg-gradient-to-br from-primary via-blue-500 to-primary bg-clip-text text-transparent">
              t
            </span>
          </div>

          {/* System Status Badge - Only show in development or for admins */}
          {(process.env.NODE_ENV === 'development' || !currentClient) && session?.user && (
            <SystemStatusBadge />
          )}

          {/* Timezone Clock */}
          {currentTime && (
            <div className="hidden md:flex items-center gap-1.5 text-xs text-gray-700 ml-3 pl-3 border-l border-gray-alpha-400">
              <span className="font-mono tabular-nums">{currentTime}</span>
              <span className="text-gray-500">·</span>
              <span className="text-gray-600">{timezone}</span>
            </div>
          )}
        </div>

        {/* Right side - Language Switcher, Client Switcher & Auth Button */}
        <div className="flex items-center gap-3">
          {/* Language Switcher */}
          <LanguageSwitcher />

          {/* Client Switcher */}
          {session?.user && clients.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs text-gray-700 hover:text-gray-900"
                  disabled={clientsLoading}
                >
                  <Building2 className="h-3.5 w-3.5 mr-1.5" />
                  <span className="hidden sm:inline">
                    {currentClient?.name || t('admin')}
                  </span>
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[200px]">
                <DropdownMenuItem
                  onClick={() => setCurrentClient(null)}
                  className="text-xs cursor-pointer"
                >
                  <div className="flex items-center justify-between w-full">
                    <span>{t('admin')}</span>
                    {!currentClient && (
                      <span className="text-blue-500">✓</span>
                    )}
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {clients.map((client) => (
                  <DropdownMenuItem
                    key={client.id}
                    onClick={() => setCurrentClient(client)}
                    className="text-xs cursor-pointer"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span>{client.name}</span>
                      {currentClient?.id === client.id && (
                        <span className="text-blue-500">✓</span>
                      )}
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {session?.user && (
            <span className="text-xs text-gray-700 hidden sm:inline">
              {session.user.email}
            </span>
          )}
          <Button
            onClick={handleAuth}
            disabled={status === 'loading'}
            variant={session ? 'outline' : 'default'}
            size="sm"
            className="h-8 text-xs"
          >
            {status === 'loading' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : session ? (
              <>
                <LogOut className="h-3.5 w-3.5 mr-1.5" />
                {t('logout')}
              </>
            ) : (
              <>
                <LogIn className="h-3.5 w-3.5 mr-1.5" />
                {t('login')}
              </>
            )}
          </Button>
        </div>
      </nav>
    </header>
  );
}
