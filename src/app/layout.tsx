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
  title: { default: 'CyberSec Blog', template: '%s · CyberSec' },
  description: 'Siber güvenlik, CTF writeup ve araştırma yazıları.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const posts = await getAllPosts();
  const cookieStore = cookies();
  const headerStore = headers();

  const rawPathname =
    headerStore.get('x-pathname') ??
    headerStore.get('next-url') ??
    headerStore.get('x-matched-path') ??
    '';
  const pathname = rawPathname.split('?')[0];
  const hasReliablePath = pathname.length > 0;
  const isLoginRoute = pathname === '/login';
  const isAuthedFromCookie = cookieStore.get(AUTH_STORAGE_KEY)?.value === AUTH_USER;
  // If path headers are unavailable, hide chrome on first paint to prevent refresh flicker.
  const showOperatorShell = hasReliablePath && isAuthedFromCookie && !isLoginRoute;
  const showPublicHeader = hasReliablePath && !showOperatorShell && !isLoginRoute;
  const showGlobalTools = hasReliablePath && !isLoginRoute;

  return (
    <html lang="tr" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen flex flex-col">
        {showOperatorShell && <OperatorSidebar initialAuth={isAuthedFromCookie} />}
        {showOperatorShell && <MobileNav initialAuth={isAuthedFromCookie} />}
        <div className={`${showOperatorShell ? 'lg:pl-[220px]' : ''} transition-all duration-300 flex flex-col flex-1`}>
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
