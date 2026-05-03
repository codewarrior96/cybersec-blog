import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { cookies, headers } from 'next/headers';
import '@/styles/globals.css';
import AppShellClient from '@/components/AppShellClient';
import { getServerSessionFromCookies } from '@/lib/auth-server';
import { getAllPosts } from '@/lib/posts';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

// Phase 6: siberlab branding refresh. The `template: '%s · siberlab'` is
// the load-bearing piece — every page that exports `metadata.title = 'X'`
// now renders as 'X · siberlab' in the browser tab. Pages that don't
// export their own title fall back to the `default` value.
//
// Icons: SVG primary (modern browsers), ICO secondary (legacy browser
// auto-fetch + bookmarks). The ICO file at public/favicon.ico is the
// pre-Phase-6 generic asset; regenerating it from icon.svg requires
// imagemagick/sharp/png-to-ico which aren't installed in this
// environment. Manual regeneration command documented in the Phase 6
// commit message.
//
// Manifest: PWA install metadata. References icon-192.png + icon-512.png
// which haven't been generated yet (same tooling gap). Browsers ignore
// missing manifest icons gracefully — the manifest still parses, "Add
// to Home Screen" still works, the install icon just falls back to the
// SVG.
export const metadata: Metadata = {
  metadataBase: new URL('https://siberlab.dev'),
  title: {
    default: 'siberlab — cybersecurity learning lab',
    template: '%s · siberlab',
  },
  description:
    'TR junior odaklı interaktif siber güvenlik laboratuvarı. Breach Lab, Sentinel telemetri ve gerçek zamanlı CTF senaryoları.',
  applicationName: 'siberlab',
  authors: [{ name: 'Salim Aybasti' }],
  creator: 'Salim Aybasti',
  publisher: 'siberlab',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: '32x32' },
    ],
    apple: '/icon-192.png',
  },
  openGraph: {
    type: 'website',
    locale: 'tr_TR',
    url: 'https://siberlab.dev',
    siteName: 'siberlab',
    title: 'siberlab — cybersecurity learning lab',
    description: 'TR junior odaklı interaktif siber güvenlik laboratuvarı.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'siberlab',
    description: 'TR junior odaklı interaktif siber güvenlik laboratuvarı.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

function normalizePathname(rawPath: string): string {
  if (!rawPath) return '';

  let value = rawPath.trim();
  try {
    if (value.startsWith('http://') || value.startsWith('https://')) {
      value = new URL(value).pathname;
    }
  } catch {
    // Keep original value when URL parsing fails.
  }

  value = value.split('?')[0]?.split('#')[0] ?? '';
  if (!value.startsWith('/')) value = `/${value}`;
  if (value.length > 1) value = value.replace(/\/+$/, '');
  return value;
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const posts = await getAllPosts();
  const cookieStore = cookies();
  const session = await getServerSessionFromCookies(cookieStore);
  const isAuthedFromCookie = Boolean(session);

  return (
    <html lang="tr" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen flex flex-col">
        <AppShellClient initialAuth={isAuthedFromCookie} posts={posts}>
          {children}
        </AppShellClient>
      </body>
    </html>
  );
}

