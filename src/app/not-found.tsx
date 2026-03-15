import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: '404 — Access Denied' };

export default function NotFound() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-32 flex flex-col items-center text-center">
      <div className="font-mono space-y-2">
        <p className="text-slate-500 text-sm tracking-widest uppercase">Error 0x00000404</p>

        <h1 className="text-8xl font-bold tracking-tight">
          <span className="text-slate-100">4</span>
          <span className="text-red-500">0</span>
          <span className="text-slate-100">4</span>
        </h1>

        <p className="text-2xl text-red-400 font-semibold">Access Denied</p>

        <div className="mt-8 bg-[#0f0f1a] border border-red-900/40 rounded-xl p-6 text-left max-w-md mx-auto text-sm">
          <p>
            <span className="text-green-400">root@cybersec</span>
            <span className="text-slate-500">:~# </span>
            <span className="text-slate-300">cd /requested-page</span>
          </p>
          <p className="text-red-400 mt-2">
            bash: cd: /requested-page: No such file or directory
          </p>
          <p className="text-slate-600 mt-3"># Sayfa mevcut değil veya taşınmış olabilir.</p>
          <p className="text-slate-600"># İzinlerinizi ve URL&apos;yi kontrol edin.</p>
          <div className="flex items-center gap-1 mt-4 text-green-400">
            <span>root@cybersec:~#</span>
            <span className="cursor-blink">█</span>
          </div>
        </div>

        <div className="mt-10 flex gap-4 justify-center">
          <Link
            href="/"
            className="px-5 py-2.5 bg-green-400 text-gray-950 font-mono font-semibold rounded-lg text-sm hover:bg-green-300 transition-colors"
          >
            cd ~
          </Link>
          <Link
            href="/blog"
            className="px-5 py-2.5 border border-slate-700 text-slate-300 font-mono text-sm rounded-lg hover:border-slate-500 hover:text-slate-100 transition-colors"
          >
            ls ./blog
          </Link>
        </div>
      </div>
    </div>
  );
}
