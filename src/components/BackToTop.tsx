'use client';

import { useEffect, useState } from 'react';

export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const toggle = () => setVisible(window.scrollY > 300);
    window.addEventListener('scroll', toggle, { passive: true });
    return () => window.removeEventListener('scroll', toggle);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Başa dön"
      className="fixed bottom-8 right-8 z-50 w-10 h-10 flex items-center justify-center
                 bg-slate-800 hover:bg-green-500 border border-slate-700 hover:border-green-500
                 text-slate-300 hover:text-gray-950 rounded-lg text-lg font-bold
                 transition-all duration-200 shadow-lg"
    >
      ↑
    </button>
  );
}
