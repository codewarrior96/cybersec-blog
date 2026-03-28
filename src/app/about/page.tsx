'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AboutRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/portfolio'); }, [router]);
  return (
    <div className="min-h-screen bg-[#08080f] flex items-center justify-center font-mono text-slate-600 text-xs">
      <span className="animate-pulse">⟶ Portfolio sayfasına yönlendiriliyor...</span>
    </div>
  );
}
