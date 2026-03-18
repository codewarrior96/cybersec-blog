import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import '@/styles/globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SearchModal from '@/components/SearchModal';
import PageTransition from '@/components/PageTransition';
import OperatorSidebar from '@/components/OperatorSidebar';
import MobileNav from '@/components/MobileNav';
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
  return (
    <html lang="tr" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen flex flex-col">
        <OperatorSidebar />
        <MobileNav />
        <div className="lg:pl-[220px] transition-all duration-300 flex flex-col flex-1">
          <Header />
          <PageTransition>
            <main className="flex-1">{children}</main>
          </PageTransition>
          <Footer />
        </div>
        <SearchModal posts={posts} />
      </body>
    </html>
  );
}
