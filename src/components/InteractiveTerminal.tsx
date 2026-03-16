'use client';

import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import Link from 'next/link';
import MatrixRain from '@/components/MatrixRain';

// ─── Types ────────────────────────────────────────────────────────────────────

type LineKind = 'cmd' | 'output' | 'error' | 'info';

interface TerminalLine {
  kind: LineKind;
  text: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PROMPT = '[codewarrior96@kali ~]$ ';
const CHAR_DELAY = 40;
const SKILL_DELAY = 80;
const STAGE_PAUSE = 400;

const ASCII_ART = `\
██████╗ ██████╗ ███████╗ █████╗  ██████╗██╗  ██╗
██╔════╝██╔═══██╗██╔════╝██╔══██╗██╔════╝██║  ██║
██║     ██║   ██║█████╗  ███████║██║     ███████║
██║     ██║   ██║██╔══╝  ██╔══██║██║     ██╔══██║
╚██████╗╚██████╔╝███████╗██║  ██║╚██████╗██║  ██║
 ╚═════╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝`;

const SKILLS = [
  '→ Penetration Testing',
  '→ CTF Challenges (PWN/WEB/CRYPTO/FORENSICS)',
  '→ Malware Analysis & Reverse Engineering',
  '→ Network Protocol Analysis',
  '→ OSINT & Threat Intelligence',
];

// ─── Command Definitions ──────────────────────────────────────────────────────

const COMMANDS: Record<string, () => TerminalLine[]> = {
  help: () => [
    { kind: 'info', text: 'Available: whoami | skills | blog | portfolio | contact | clear | hack' },
  ],
  whoami: () => [
    { kind: 'output', text: 'codewarrior96 — Security Researcher | CTF Player | Malware Analyst' },
  ],
  skills: () => SKILLS.map((s) => ({ kind: 'output' as LineKind, text: s })),
  contact: () => [
    { kind: 'output', text: 'Email: contact@codewarrior96.dev' },
  ],
  hack: () => [
    { kind: 'error', text: 'Nice try. Already inside.' },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Renders a typed command line with the prompt in green and the command in white */
function CmdLine({ text }: { text: string }) {
  const dollarIdx = text.lastIndexOf('$ ');
  if (dollarIdx === -1) {
    return <span className="text-green-400">{text}</span>;
  }
  return (
    <>
      <span className="text-green-400">{text.slice(0, dollarIdx + 2)}</span>
      <span className="text-slate-200">{text.slice(dollarIdx + 2)}</span>
    </>
  );
}

function lineColorClass(kind: LineKind): string {
  switch (kind) {
    case 'cmd':    return 'text-slate-200';
    case 'output': return 'text-green-400/80';
    case 'error':  return 'text-red-400';
    case 'info':   return 'text-yellow-300/80';
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function InteractiveTerminal() {
  // Pre-typed animation
  const [preLines, setPreLines] = useState<TerminalLine[]>([]);
  const [typingText, setTypingText] = useState('');
  const [inputVisible, setInputVisible] = useState(false);

  // Interactive section
  const [history, setHistory] = useState<TerminalLine[]>([]);
  const [inputValue, setInputValue] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);
  const bodyRef  = useRef<HTMLDivElement>(null);

  // ── Boot animation ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

    const typeCmd = async (text: string) => {
      for (let i = 0; i <= text.length; i++) {
        if (cancelled) return;
        setTypingText(text.slice(0, i));
        await wait(CHAR_DELAY);
      }
    };

    const addLines = (...lines: TerminalLine[]) => {
      setPreLines((prev) => [...prev, ...lines]);
      setTypingText('');
    };

    const run = async () => {
      await wait(200);

      // ── Stage 1: whoami ──
      const cmd1 = `${PROMPT}whoami`;
      await typeCmd(cmd1);
      if (cancelled) return;
      addLines(
        { kind: 'cmd',    text: cmd1 },
        { kind: 'output', text: 'codewarrior96 — Security Researcher | CTF Player | Malware Analyst' },
      );
      await wait(STAGE_PAUSE);

      // ── Stage 2: cat skills.txt ──
      const cmd2 = `${PROMPT}cat skills.txt`;
      await typeCmd(cmd2);
      if (cancelled) return;
      addLines({ kind: 'cmd', text: cmd2 });

      for (const skill of SKILLS) {
        if (cancelled) return;
        setPreLines((prev) => [...prev, { kind: 'output', text: skill }]);
        await wait(SKILL_DELAY);
      }
      await wait(STAGE_PAUSE);

      // ── Stage 3: show interactive input ──
      if (cancelled) return;
      setInputVisible(true);
      // focus on next tick so the element is mounted
      setTimeout(() => inputRef.current?.focus(), 0);
    };

    run();
    return () => { cancelled = true; };
  }, []);

  // ── Auto-scroll ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [preLines, typingText, history]);

  // ── Command handler ─────────────────────────────────────────────────────────
  const handleCommand = (raw: string) => {
    const cmd = raw.trim().toLowerCase();
    const inputLine: TerminalLine = { kind: 'cmd', text: `${PROMPT}${raw.trim()}` };

    if (cmd === '') {
      setHistory((prev) => [...prev, inputLine].slice(-20));
      return;
    }

    if (cmd === 'clear') {
      setHistory([]);
      return;
    }

    if (cmd === 'blog') {
      setHistory((prev) => [...prev, inputLine, { kind: 'output', text: 'Navigating to /blog...' }].slice(-20));
      window.location.href = '/blog';
      return;
    }

    if (cmd === 'portfolio') {
      setHistory((prev) => [...prev, inputLine, { kind: 'output', text: 'Navigating to /portfolio...' }].slice(-20));
      window.location.href = '/portfolio';
      return;
    }

    const handler = COMMANDS[cmd];
    if (handler) {
      setHistory((prev) => [...prev, inputLine, ...handler()].slice(-20));
    } else {
      setHistory((prev) => [
        ...prev,
        inputLine,
        { kind: 'error', text: `command not found: ${cmd}. Try 'help'` },
      ].slice(-20));
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleCommand(inputValue);
      setInputValue('');
    }
  };

  const focusInput = () => inputRef.current?.focus();

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden py-16 px-4">

      {/* Matrix rain @ 30% opacity */}
      <div className="absolute inset-0 opacity-30">
        <MatrixRain />
      </div>

      {/* Radial vignette — dims edges */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_50%,transparent_30%,#08080f_100%)]" />

      <div className="relative z-10 w-full max-w-3xl">

        {/* ASCII art — desktop only */}
        <pre
          className="font-mono text-green-400/30 text-[10px] leading-none mb-8 hidden md:block select-none overflow-hidden"
          aria-hidden
        >
          {ASCII_ART}
        </pre>

        {/* ── Terminal window ── */}
        <div
          className="rounded-lg border border-green-400/20 bg-black/85 backdrop-blur-sm overflow-hidden shadow-2xl shadow-green-400/5 cursor-text"
          onClick={focusInput}
        >
          {/* Window chrome */}
          <div className="flex items-center gap-2 px-4 py-3 bg-slate-900/60 border-b border-green-400/10 select-none">
            <span className="w-3 h-3 rounded-full bg-red-500/80" />
            <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <span className="w-3 h-3 rounded-full bg-green-500/80" />
            <span className="ml-3 font-mono text-xs text-slate-400">codewarrior96@kali: ~</span>
          </div>

          {/* Terminal body */}
          <div
            ref={bodyRef}
            className="p-5 font-mono text-sm min-h-72 max-h-[420px] overflow-y-auto scroll-smooth"
          >
            {/* Pre-typed demo lines */}
            {preLines.map((line, i) => (
              <div key={i} className={`leading-relaxed ${lineColorClass(line.kind)}`}>
                {line.kind === 'cmd' ? <CmdLine text={line.text} /> : line.text}
              </div>
            ))}

            {/* Currently animating character-by-character */}
            {typingText && (
              <div className="leading-relaxed">
                <CmdLine text={typingText} />
                <span className="cursor-blink text-green-400">█</span>
              </div>
            )}

            {/* Static waiting cursor between last skill line and input appearing */}
            {!typingText && !inputVisible && preLines.length > 0 && (
              <div className="leading-relaxed text-green-400">
                {PROMPT}
                <span className="cursor-blink">_</span>
              </div>
            )}

            {/* ── Interactive section ── */}
            {inputVisible && (
              <>
                {history.map((line, i) => (
                  <div key={`h-${i}`} className={`leading-relaxed ${lineColorClass(line.kind)}`}>
                    {line.kind === 'cmd' ? <CmdLine text={line.text} /> : line.text}
                  </div>
                ))}

                {/* Live input row */}
                <div className="flex items-center leading-relaxed mt-0.5">
                  <span className="text-green-400 shrink-0">{PROMPT}</span>
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="flex-1 bg-transparent border-none outline-none text-green-400 font-mono text-sm caret-green-400 min-w-0"
                    spellCheck={false}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    aria-label="Terminal input"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* CTA buttons */}
        <div className="mt-8 flex flex-col items-center gap-3">
          <div className="flex gap-4 flex-wrap justify-center">
            <Link href="/blog" className="neon-btn-solid">
              ./explore-writeups →
            </Link>
            <Link href="/portfolio" className="neon-btn">
              ./view-portfolio
            </Link>
          </div>
          <p className="font-mono text-xs text-slate-600">
            or type a command above ↑
          </p>
        </div>

      </div>
    </section>
  );
}
