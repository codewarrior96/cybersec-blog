export default function Footer() {
  return (
    <footer className="border-t border-slate-800/60 mt-20">
      <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="font-mono text-slate-600 text-sm">
          <span className="text-green-400/70">~/cybersec</span> © {new Date().getFullYear()}
        </span>
        <div className="flex items-center gap-6 text-sm text-slate-500">
          <span className="font-mono">
            <span className="text-slate-600">// </span>güvenli kal, meraklı kal
          </span>
        </div>
      </div>
    </footer>
  );
}
