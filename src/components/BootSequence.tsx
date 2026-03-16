'use client';

import { useState, useEffect, ReactNode } from 'react';

interface BootLine {
  prefix: string;
  text: string;
  prefixClass: string;
}

const BOOT_LINES: BootLine[] = [
  { prefix: '[OK]',   text: 'Initializing kernel modules...',                   prefixClass: 'text-green-400' },
  { prefix: '[OK]',   text: 'Loading network interfaces... eth0 UP',            prefixClass: 'text-green-400' },
  { prefix: '[OK]',   text: 'Mounting encrypted volumes...',                     prefixClass: 'text-green-400' },
  { prefix: '[WARN]', text: 'Anomalous traffic detected on port 4444',           prefixClass: 'text-yellow-400' },
  { prefix: '[OK]',   text: 'Bypassing firewall rules...',                       prefixClass: 'text-green-400' },
  { prefix: '[OK]',   text: 'Establishing encrypted tunnel...',                  prefixClass: 'text-green-400' },
  { prefix: '[!!]',   text: 'TARGET SYSTEM COMPROMISED',                         prefixClass: 'text-red-400' },
  { prefix: '',       text: 'CONNECTION ESTABLISHED — codewarrior96@target:~$', prefixClass: '' },
];

export default function BootSequence({ children }: { children: ReactNode }) {
  const [showOverlay, setShowOverlay] = useState(false);
  const [visibleLines, setVisibleLines] = useState(0);
  const [glitching, setGlitching] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('booted')) return;

    setShowOverlay(true);

    let cancelled = false;
    const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

    const run = async () => {
      await wait(300);

      for (let i = 0; i < BOOT_LINES.length; i++) {
        if (cancelled) return;
        setVisibleLines(i + 1);
        await wait(120);
      }

      if (cancelled) return;
      await wait(600);

      // Glitch flash — 3 times, 80ms each
      for (let i = 0; i < 3; i++) {
        if (cancelled) return;
        setGlitching(true);
        await wait(80);
        setGlitching(false);
        await wait(80);
      }

      if (cancelled) return;
      setFadingOut(true);
      await wait(500);

      if (cancelled) return;
      sessionStorage.setItem('booted', 'true');
      setShowOverlay(false);
    };

    run();
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      {children}

      {showOverlay && (
        <>
          <style>{`
            .boot-scanlines {
              background-image: repeating-linear-gradient(
                0deg,
                transparent,
                transparent 2px,
                rgba(0, 0, 0, 0.03) 2px,
                rgba(0, 0, 0, 0.03) 4px
              );
            }
            .boot-glitch {
              filter: hue-rotate(90deg) brightness(1.6) saturate(2);
              transform: skewX(-1.5deg) scaleY(0.99);
            }
          `}</style>

          <div
            className={[
              'fixed inset-0 z-[9999] bg-black font-mono flex flex-col p-6 md:p-12 overflow-hidden',
              'transition-opacity duration-500',
              fadingOut ? 'opacity-0' : 'opacity-100',
              glitching ? 'boot-glitch' : '',
            ].join(' ')}
          >
            {/* Scanline overlay */}
            <div className="boot-scanlines absolute inset-0 pointer-events-none z-10" />

            {/* BIOS header */}
            <p className="text-green-400 text-sm mb-8 relative z-20 tracking-wider">
              BIOS v2.0.26 — BREACH TERMINAL SYSTEMS
            </p>

            {/* Boot log lines */}
            <div className="space-y-1 relative z-20">
              {BOOT_LINES.slice(0, visibleLines).map((line, i) => (
                <div key={i} className="flex items-start gap-3 text-sm leading-6">
                  {line.prefix ? (
                    <span className={`${line.prefixClass} font-bold shrink-0 w-16`}>
                      {line.prefix}
                    </span>
                  ) : (
                    <span className="shrink-0 w-16" />
                  )}
                  <span className="text-green-400">{line.text}</span>
                </div>
              ))}

              {/* Blinking cursor after last visible line */}
              {visibleLines > 0 && visibleLines < BOOT_LINES.length && (
                <div className="flex items-start gap-3 text-sm leading-6">
                  <span className="shrink-0 w-16" />
                  <span className="cursor-blink text-green-400">█</span>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
