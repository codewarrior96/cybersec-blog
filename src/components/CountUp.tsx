'use client';
import { useEffect, useRef, useState } from 'react';

export default function CountUp({ to, suffix = '' }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const elRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = elRef.current!;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        obs.disconnect();
        if (to === 0) { setVal(0); return; }
        let n = 0;
        const step = to / 40;
        const id = setInterval(() => {
          n = Math.min(n + step, to);
          setVal(Math.floor(n));
          if (n >= to) clearInterval(id);
        }, 35);
      },
      { threshold: 0.5 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [to]);

  return <span ref={elRef}>{val}{suffix}</span>;
}
