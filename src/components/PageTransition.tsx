'use client';
import { usePathname } from 'next/navigation';

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const disableFadeForDashboard = pathname === '/home' || pathname === '/';
  return (
    <div
      className="page-transition"
      style={disableFadeForDashboard ? { animation: 'none', opacity: 1, transform: 'none' } : undefined}
    >
      {children}
    </div>
  );
}
