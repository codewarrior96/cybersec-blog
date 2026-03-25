import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Hakkımda' };

const tools = ['Burp Suite', 'Nmap', 'Metasploit', 'Wireshark', 'Ghidra', 'Python', 'Linux'];

export default function AboutPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 md:px-6 md:py-16">
      <div className="max-w-2xl">
        {/* Terminal prompt */}
        <p className="font-mono text-slate-500 text-sm mb-8">
          <span className="text-green-400">guest</span>@cybersec:~$
          <span className="text-slate-300"> cat about.txt</span>
        </p>

        {/* Başlık */}
        <h1 className="text-3xl font-bold text-slate-100 mb-2">Hakkımda</h1>
        <div className="w-12 h-0.5 bg-green-400 mb-8" />

        <div className="space-y-6 text-slate-300 leading-relaxed">
          <p>
            Siber güvenlik alanında araştırma yapan, CTF yarışmalarına katılan ve öğrendiklerini
            burada paylaşan birisiyim.
          </p>
          <p>
            Bu blog; penetrasyon testi teknikleri, CTF writeup&apos;ları, malware analizi ve
            güvenlik araştırmalarını kapsayan yazılar içeriyor.
          </p>
        </div>

        {/* Araçlar */}
        <div className="mt-12">
          <h2 className="font-mono text-slate-400 text-sm mb-4">
            <span className="text-green-400">// </span>kullandığım araçlar
          </h2>
          <div className="flex flex-wrap gap-2">
            {tools.map((tool) => (
              <span
                key={tool}
                className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 font-mono text-sm
                           hover:border-green-500/50 hover:text-green-400 transition-colors cursor-default"
              >
                {tool}
              </span>
            ))}
          </div>
        </div>

        {/* İletişim */}
        <div className="mt-12 p-6 rounded-xl border border-slate-800 bg-[#0f0f1a]">
          <h2 className="font-mono text-slate-400 text-sm mb-3">
            <span className="text-green-400">// </span>iletişim
          </h2>
          <p className="text-slate-400 text-sm">
            Güvenlik araştırmaları, bug bounty veya iş birliği için ulaşabilirsiniz.
          </p>
        </div>
      </div>
    </div>
  );
}
