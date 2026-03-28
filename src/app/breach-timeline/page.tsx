'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function BreachTimelineRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/zafiyet-taramasi');
  }, [router]);
  return (
    <div className="min-h-screen bg-[#06000f] flex items-center justify-center font-mono text-slate-600 text-xs">
      <span className="animate-pulse">⟶ Threat Intelligence Hub'a yönlendiriliyor...</span>
    </div>
  );
}
