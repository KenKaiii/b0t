'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useTransition } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Languages, Check } from 'lucide-react';
import { locales, languageNames, languageFlags, type Locale } from '@/i18n';
import { useLocale } from 'next-intl';

export function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const currentLocale = useLocale() as Locale;
  const [isPending, startTransition] = useTransition();

  const handleLocaleChange = (newLocale: Locale) => {
    if (newLocale === currentLocale) return;

    startTransition(() => {
      // Save preference to localStorage
      localStorage.setItem('preferred-locale', newLocale);

      // Update the URL with new locale
      let newPathname = pathname;

      // Remove current locale prefix if present
      for (const locale of locales) {
        if (pathname.startsWith(`/${locale}/`)) {
          newPathname = pathname.slice(`/${locale}`.length);
          break;
        }
        if (pathname === `/${locale}`) {
          newPathname = '/';
          break;
        }
      }

      // Add new locale prefix (unless it's the default 'en')
      if (newLocale !== 'en') {
        newPathname = `/${newLocale}${newPathname}`;
      }

      router.push(newPathname);
      router.refresh();
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 px-0"
          disabled={isPending}
        >
          <Languages className="h-4 w-4" />
          <span className="sr-only">Change language</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[160px]">
        {locales.map((locale) => (
          <DropdownMenuItem
            key={locale}
            onClick={() => handleLocaleChange(locale)}
            className="cursor-pointer flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <span>{languageFlags[locale]}</span>
              <span>{languageNames[locale]}</span>
            </span>
            {currentLocale === locale && (
              <Check className="h-4 w-4 text-blue-500" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
