'use client';

import { useRef, useState } from 'react';

export default function CodeBlock({
  children,
  ...props
}: React.HTMLAttributes<HTMLPreElement>) {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const text = preRef.current?.textContent ?? '';
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group/code">
      <button
        onClick={copy}
        className="absolute top-2.5 right-2.5 z-10 px-2.5 py-1 text-xs font-mono
                   bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white
                   border border-slate-600 rounded
                   opacity-0 group-hover/code:opacity-100 transition-all duration-150"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <pre ref={preRef} {...props}>
        {children}
      </pre>
    </div>
  );
}
