import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { ClientProvider } from "@/components/providers/ClientProvider";
import { IntlProvider } from "@/components/providers/IntlProvider";
import { Toaster } from "@/components/ui/sonner";
import { AppLoader } from "@/components/ui/app-loader";
import { getLocale, getMessages } from "@/lib/i18n-server";

// Force dynamic rendering for all pages
export const dynamic = 'force-dynamic';
export const dynamicParams = true;

const interHeading = Inter({
  weight: ["500", "600", "700"],
  variable: "--font-heading",
  subsets: ["latin"],
});

const interBody = Inter({
  weight: ["400", "500"],
  variable: "--font-body",
  subsets: ["latin"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "b0t - Build Custom Automations",
  description: "Visual automation platform for building custom workflows. Connect APIs, services, and platforms to create powerful automations.",
  icons: {
    icon: '/bot-icon.svg',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages(locale);

  return (
    <html lang={locale} data-scroll-behavior="smooth">
      <body
        className={`${interHeading.variable} ${interBody.variable} ${inter.variable} antialiased`}
      >
        <IntlProvider locale={locale} messages={messages}>
          <AppLoader />
          <SessionProvider>
            <ClientProvider>
              {children}
            </ClientProvider>
          </SessionProvider>
          <Toaster />
        </IntlProvider>
      </body>
    </html>
  );
}
