'use client';
import { useEffect, useRef } from 'react';

export default function MatrixRain() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const chars = 'アイウエオカキクケコサシスセソ0123456789ABCDEF<>{}[]!@#$%^&';

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const cols = Math.floor(canvas.width / 14);
    const drops: number[] = Array(cols).fill(1);

    const tick = () => {
      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = '13px monospace';
      drops.forEach((y, i) => {
        ctx.fillStyle = Math.random() > 0.96 ? '#ffffff' : '#00ff41';
        ctx.globalAlpha = 0.15 + Math.random() * 0.3;
        ctx.fillText(chars[Math.floor(Math.random() * chars.length)], i * 14, y * 14);
        ctx.globalAlpha = 1;
        if (y * 14 > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      });
    };

    const id = setInterval(tick, 50);
    return () => { clearInterval(id); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={ref} className="absolute inset-0 w-full h-full" />;
}
