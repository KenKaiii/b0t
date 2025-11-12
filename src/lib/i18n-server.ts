import { headers } from 'next/headers';
import { defaultLocale, type Locale, locales } from '@/i18n';

export async function getLocale(): Promise<Locale> {
  const headersList = await headers();
  const pathname = headersList.get('x-pathname') || headersList.get('x-url') || '';

  // Extract locale from pathname if present
  for (const locale of locales) {
    if (pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`) {
      return locale;
    }
  }

  // Check Accept-Language header as fallback
  const acceptLanguage = headersList.get('accept-language');
  if (acceptLanguage) {
    for (const locale of locales) {
      if (acceptLanguage.toLowerCase().includes(locale.toLowerCase())) {
        return locale;
      }
    }
  }

  return defaultLocale;
}

export async function getMessages(locale: Locale) {
  try {
    return (await import(`../../messages/${locale}.json`)).default;
  } catch {
    return (await import(`../../messages/${defaultLocale}.json`)).default;
  }
}
