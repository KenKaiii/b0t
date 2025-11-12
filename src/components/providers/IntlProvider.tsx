'use client';

import { NextIntlClientProvider } from 'next-intl';

interface IntlProviderProps {
  children: React.ReactNode;
  locale: string;
  messages: Record<string, unknown>;
}

export function IntlProvider({ children, locale, messages }: IntlProviderProps) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      {children}
    </NextIntlClientProvider>
  );
}
