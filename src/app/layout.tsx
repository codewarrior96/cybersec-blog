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

export const metadata: Metadata = {
  title: { default: 'CyberSec Blog', template: '%s · CyberSec' },
  description: 'Siber güvenlik, CTF writeup ve araştırma yazıları.',
};

export const viewport: Viewport = {
  width: 1440,
  initialScale: 0.24,
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

