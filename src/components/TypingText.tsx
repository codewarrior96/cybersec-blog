'use client';
import { useEffect, useState } from 'react';

export default function TypingText({ text, className }: { text: string; className?: string }) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        setDone(true);
        clearInterval(id);
      }
    }, 75);
    return () => clearInterval(id);
  }, [text]);

  return (
    <span className={className}>
      {displayed}
      {!done && <span className="inline-block w-0.5 h-[1em] bg-green-400 align-middle ml-0.5 cursor-blink" />}
    </span>
  );
}
