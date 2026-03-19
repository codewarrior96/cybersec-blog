import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { cookies, headers } from 'next/headers';
import '@/styles/globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SearchModal from '@/components/SearchModal';
import PageTransition from '@/components/PageTransition';
import OperatorSidebar from '@/components/OperatorSidebar';
import MobileNav from '@/components/MobileNav';
import { AUTH_STORAGE_KEY, AUTH_USER } from '@/lib/auth-shared';
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
  title: { default: 'CyberSec Blog', template: '%s Â· CyberSec' },
  description: 'Siber gÃ¼venlik, CTF writeup ve araÅŸtÄ±rma yazÄ±larÄ±.',
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
  const headerStore = headers();

  const rawPathname =
    headerStore.get('x-pathname') ??
    headerStore.get('next-url') ??
    headerStore.get('x-matched-path') ??
    '';
  const pathname = normalizePathname(rawPathname);
  const hasReliablePath = pathname.length > 0;
  const isLoginRoute = pathname === '/login' || pathname.startsWith('/login/');
  const isRootRoute = pathname === '/';
  const isAuthedFromCookie = cookieStore.get(AUTH_STORAGE_KEY)?.value === AUTH_USER;
  const isAuthGatewayRoute = isLoginRoute || (!isAuthedFromCookie && isRootRoute);
  // If path headers are unavailable, hide chrome on first paint to prevent refresh flicker.
  const showOperatorShell = hasReliablePath && isAuthedFromCookie && !isLoginRoute;
  const showPublicHeader = hasReliablePath && !showOperatorShell && !isAuthGatewayRoute;
  const showGlobalTools = hasReliablePath && !isAuthGatewayRoute;

  return (
    <html lang="tr" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen flex flex-col">
        <OperatorSidebar initialAuth={isAuthedFromCookie} />
        <MobileNav initialAuth={isAuthedFromCookie} />
        <div
          className="transition-all duration-300 flex flex-col flex-1"
          style={{ paddingLeft: 'var(--operator-shell-offset, 0px)' }}
        >
          {showPublicHeader && <Header initialAuth={isAuthedFromCookie} />}
          <PageTransition>
            <main className="flex-1">{children}</main>
          </PageTransition>
          {showGlobalTools && <Footer />}
        </div>
        {showGlobalTools && <SearchModal posts={posts} />}
      </body>
    </html>
  );
}

