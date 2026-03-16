const socialLinks = [
  {
    label: 'GitHub',
    href: 'https://github.com',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden>
        <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844a9.59 9.59 0 012.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
      </svg>
    ),
  },
  {
    label: 'LinkedIn',
    href: 'https://linkedin.com',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden>
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
  {
    label: 'TryHackMe',
    href: 'https://tryhackme.com',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden>
        <path d="M10.705 0C7.54 0 4.902 2.285 4.374 5.298A4.3 4.3 0 000 9.52a4.301 4.301 0 004.3 4.3h6.405V0zm2.59 24c3.165 0 5.803-2.285 6.33-5.298A4.3 4.3 0 0024 14.48a4.301 4.301 0 00-4.3-4.3h-6.405V24z" />
      </svg>
    ),
  },
  {
    label: 'Twitter/X',
    href: 'https://twitter.com',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden>
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
];

export default function Footer() {
  return (
    <footer className="mt-20 relative">
      {/* Matrix-style top border */}
      <div className="h-px bg-gradient-to-r from-transparent via-green-400/40 to-transparent" />
      <div className="h-px bg-gradient-to-r from-transparent via-green-400/10 to-transparent mt-0.5" />

      <div className="bg-[#08080f] border-t border-green-400/5">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {/* Brand */}
            <div>
              <div className="font-mono text-green-400 font-bold text-sm mb-2">~/cybersec</div>
              <p className="font-mono text-slate-600 text-xs leading-relaxed">
                <span className="text-slate-700">// </span>
                güvenli kal, meraklı kal
              </p>
              <p className="font-mono text-slate-700 text-xs mt-2">
                © {new Date().getFullYear()} — tüm haklar saklıdır
              </p>
            </div>

            {/* Links */}
            <div>
              <div className="font-mono text-green-400/60 text-xs uppercase tracking-widest mb-3">
                // Linkler
              </div>
              <ul className="space-y-1.5">
                {[
                  { href: '/blog',      label: 'Blog' },
                  { href: '/portfolio', label: 'Portfolio' },
                  { href: '/about',     label: 'Hakkımda' },
                ].map((l) => (
                  <li key={l.href}>
                    <a
                      href={l.href}
                      className="font-mono text-xs text-slate-500 hover:text-green-400 transition-colors flex items-center gap-1.5"
                    >
                      <span className="text-green-400/30">›</span>
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact + Social */}
            <div>
              <div className="font-mono text-green-400/60 text-xs uppercase tracking-widest mb-3">
                // İletişim
              </div>
              <a
                href="mailto:hello@cybersec.blog"
                className="font-mono text-xs text-slate-500 hover:text-green-400 transition-colors block mb-4"
              >
                <span className="text-green-400/30">›</span> hello@cybersec.blog
              </a>
              <div className="flex gap-3">
                {socialLinks.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className="text-slate-600 hover:text-green-400 transition-all duration-300 hover:drop-shadow-[0_0_6px_rgba(0,255,65,0.8)]"
                  >
                    {s.icon}
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-8 pt-4 border-t border-slate-800/60 flex items-center justify-between">
            <span className="font-mono text-slate-700 text-xs">
              built with Next.js + MDX
            </span>
            <span className="font-mono text-green-400/20 text-xs select-none">
              &gt; _
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
