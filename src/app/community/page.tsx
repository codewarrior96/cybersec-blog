'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { MODULES, TOOLS, CHALLENGES, TOOL_CATEGORIES } from '@/lib/lab/content'
import { VALID_FLAGS } from '@/lib/lab/engine'
import type { Module, ToolCard, Challenge, Difficulty } from '@/lib/lab/types'

// Terminal dinamik import — SSR devre dışı (window/WebSocket)
const Terminal = dynamic(() => import('@/components/lab/Terminal'), { ssr: false })

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'terminal' | 'curriculum' | 'tools' | 'setup'
type ToolCategory = typeof TOOL_CATEGORIES[number]

// ─── Constants ────────────────────────────────────────────────────────────────

const DIFFICULTY_META: Record<Difficulty, { label: string; color: string }> = {
  beginner:     { label: 'Başlangıç',  color: '#00ff41' },
  intermediate: { label: 'Orta',       color: '#f59e0b' },
  advanced:     { label: 'İleri',      color: '#ef4444' },
  expert:       { label: 'Uzman',      color: '#7c3aed' },
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'terminal',   label: '⌨  Terminal'   },
  { id: 'curriculum', label: '📚 Müfredat'   },
  { id: 'tools',      label: '🛠  Araçlar'   },
  { id: 'setup',      label: '⚙  Kurulum'   },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LabPage() {
  const [activeTab,      setActiveTab]      = useState<Tab>('terminal')
  const [submittedFlags, setSubmittedFlags] = useState<Set<string>>(new Set())

  function handleFlagSubmit(flag: string) {
    setSubmittedFlags(prev => new Set([...Array.from(prev), flag]))
  }

  const progress = submittedFlags.size
  const total    = VALID_FLAGS.size

  return (
    <div style={{
      height: 'calc(100vh - 64px)',   /* 64px = sticky NavigationBar height */
      display: 'flex', flexDirection: 'column',
      background: '#000', color: '#e2e8f0', fontFamily: 'monospace',
      overflow: 'hidden',
    }}>
      <PageHeader progress={progress} total={total} />
      <TabBar activeTab={activeTab} onSelect={setActiveTab} />

      <div style={{ flex: 1, minHeight: 0 }}>
        {activeTab === 'terminal'   && <TerminalTab onFlagSubmit={handleFlagSubmit} />}
        {activeTab === 'curriculum' && <CurriculumTab />}
        {activeTab === 'tools'      && <ToolsTab />}
        {activeTab === 'setup'      && <SetupTab />}
      </div>
    </div>
  )
}

// ─── Page Header ──────────────────────────────────────────────────────────────

function PageHeader({ progress, total }: { progress: number; total: number }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 20px', flexShrink: 0,
      background: 'linear-gradient(90deg, #050f05 0%, #071407 100%)',
      borderBottom: '1px solid #00ff41',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 9, height: 9, borderRadius: '50%',
          background: '#00ff41', boxShadow: '0 0 10px #00ff41, 0 0 20px #00ff4188',
          flexShrink: 0,
        }} />
        <span style={{ color: '#00ff41', fontWeight: 800, letterSpacing: '0.2em', fontSize: 14 }}>
          BREACH LAB
        </span>
        <span style={{ color: '#4ade80', fontSize: 12, opacity: 0.8 }}>
          — Siber Güvenlik Eğitim Platformu
        </span>
      </div>
      <ProgressBadge progress={progress} total={total} />
    </div>
  )
}

function ProgressBadge({ progress, total }: { progress: number; total: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ color: '#4ade80', fontSize: 12 }}>
        🚩 {progress}/{total} bayrak
      </span>
      <div style={{ width: 90, height: 5, background: 'rgba(0,255,65,0.12)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          width: `${total ? (progress / total) * 100 : 0}%`, height: '100%',
          background: 'linear-gradient(90deg, #00ff41, #4ade80)',
          borderRadius: 3, transition: 'width 0.5s ease',
          boxShadow: '0 0 6px #00ff41',
        }} />
      </div>
    </div>
  )
}

// ─── Tab Bar ──────────────────────────────────────────────────────────────────

function TabBar({ activeTab, onSelect }: { activeTab: Tab; onSelect: (t: Tab) => void }) {
  return (
    <div style={{
      display: 'flex', flexShrink: 0,
      background: '#0a0a0a',
      borderBottom: '2px solid #1a2e1a',
    }}>
      {TABS.map(tab => {
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            style={{
              padding: '11px 22px',
              fontFamily: 'monospace', fontSize: 13, fontWeight: 700,
              letterSpacing: '0.06em', cursor: 'pointer',
              background: isActive ? 'rgba(0,255,65,0.08)' : 'transparent',
              border: 'none',
              borderBottom: isActive ? '2px solid #00ff41' : '2px solid transparent',
              borderTop: isActive ? '1px solid rgba(0,255,65,0.3)' : '1px solid transparent',
              color: isActive ? '#00ff41' : '#6b7280',
              transition: 'all 0.15s ease',
              marginBottom: -2,
              outline: 'none',
            }}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Terminal Tab ─────────────────────────────────────────────────────────────

function TerminalTab({ onFlagSubmit }: { onFlagSubmit: (flag: string) => void }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Terminal onFlagSubmit={onFlagSubmit} />
    </div>
  )
}

// ─── Curriculum Tab ───────────────────────────────────────────────────────────

function CurriculumTab() {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '2rem 1.5rem' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <SectionHeader
          eyebrow="ÖĞRENME YOLU"
          title="Başlangıçtan Uzmanlığa"
          subtitle="Siber güvenlikte sıfırdan profesyonel seviyeye kapsamlı müfredat"
        />

        <div style={{ position: 'relative' }}>
          {/* Vertical timeline line */}
          <div style={{ position: 'absolute', left: 23, top: 0, bottom: 0, width: 2,
            background: 'linear-gradient(to bottom, #00ff41, #7c3aed)', opacity: 0.3 }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {MODULES.map((mod, i) => (
              <ModuleCard
                key={mod.id}
                module={mod}
                index={i}
                isExpanded={expanded === mod.id}
                onToggle={() => setExpanded(prev => prev === mod.id ? null : mod.id)}
              />
            ))}
          </div>
        </div>

        <ChallengesSection />
      </div>
    </div>
  )
}

function ModuleCard({ module: mod, index, isExpanded, onToggle }: {
  module: Module; index: number; isExpanded: boolean; onToggle: () => void
}) {
  const { label: diffLabel, color: diffColor } = DIFFICULTY_META[mod.difficulty]

  return (
    <div style={{ display: 'flex', gap: '1rem', paddingLeft: '0.5rem' }}>
      {/* Timeline dot */}
      <div style={{ flexShrink: 0, width: 48, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: 48, height: 48, borderRadius: 8, background: `${mod.color}15`,
          border: `1px solid ${mod.color}40`, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 22 }}>
          {mod.icon}
        </div>
      </div>

      {/* Card */}
      <div style={{ flex: 1, border: `1px solid ${isExpanded ? mod.color + '40' : 'rgba(255,255,255,0.07)'}`,
        borderRadius: 8, overflow: 'hidden', transition: 'border-color 0.2s' }}>
        <button
          onClick={onToggle}
          style={{ width: '100%', textAlign: 'left', padding: '1rem 1.25rem',
            background: isExpanded ? `${mod.color}08` : 'rgba(255,255,255,0.02)',
            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between' }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.2rem' }}>
              <span style={{ color: '#94a3b8', fontSize: 11 }}>
                {String(index + 1).padStart(2, '0')}
              </span>
              <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 14, fontFamily: 'monospace' }}>
                {mod.title}
              </span>
              <span style={{ padding: '1px 8px', borderRadius: 3, fontSize: 10, fontWeight: 700,
                background: `${diffColor}18`, color: diffColor, border: `1px solid ${diffColor}35` }}>
                {diffLabel}
              </span>
            </div>
            <span style={{ color: 'rgba(148,163,184,0.7)', fontSize: 12 }}>{mod.subtitle}</span>
          </div>
          <span style={{ color: 'rgba(148,163,184,0.5)', fontSize: 18, transition: 'transform 0.2s',
            transform: isExpanded ? 'rotate(90deg)' : 'none' }}>›</span>
        </button>

        {isExpanded && (
          <div style={{ padding: '0 1.25rem 1.25rem', borderTop: `1px solid ${mod.color}20` }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <p style={{ color: 'rgba(0,255,65,0.6)', fontSize: 11, letterSpacing: '0.1em', marginBottom: '0.6rem' }}>
                  KONULAR
                </p>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {mod.topics.map(topic => (
                    <li key={topic} style={{ color: 'rgba(226,232,240,0.75)', fontSize: 12, display: 'flex', gap: '0.4rem' }}>
                      <span style={{ color: mod.color, flexShrink: 0 }}>›</span>
                      {topic}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p style={{ color: 'rgba(0,255,65,0.6)', fontSize: 11, letterSpacing: '0.1em', marginBottom: '0.6rem' }}>
                  KAYNAKLAR
                </p>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {mod.resources.map(r => (
                    <li key={r.url}>
                      <a href={r.url} target="_blank" rel="noopener noreferrer"
                        style={{ color: '#60a5fa', fontSize: 12, textDecoration: 'none', display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                        <span>↗</span> {r.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ChallengesSection() {
  return (
    <div style={{ marginTop: '3rem' }}>
      <SectionHeader eyebrow="PRATİK" title="CTF Görevleri" subtitle="Terminalde çöz, bayrak gönder" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem' }}>
        {CHALLENGES.map(ch => <ChallengeCard key={ch.level} challenge={ch} />)}
      </div>
    </div>
  )
}

function ChallengeCard({ challenge: ch }: { challenge: Challenge }) {
  return (
    <div style={{ border: `1px solid ${ch.color}25`, borderRadius: 6, padding: '1rem',
      background: `${ch.color}05` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
        <span style={{ color: ch.color, fontWeight: 800, fontSize: 20, fontFamily: 'monospace' }}>
          {String(ch.level).padStart(2, '0')}
        </span>
        <div>
          <div style={{ color: ch.color, fontWeight: 700, fontSize: 13 }}>{ch.title}</div>
          <span style={{ padding: '1px 6px', borderRadius: 2, fontSize: 9, fontWeight: 700,
            background: `${ch.color}20`, color: ch.color }}>{ch.difficulty}</span>
        </div>
      </div>
      <p style={{ color: 'rgba(226,232,240,0.6)', fontSize: 12, lineHeight: 1.5, margin: 0 }}>
        {ch.description}
      </p>
      <code style={{ display: 'block', marginTop: '0.6rem', padding: '0.4rem 0.6rem',
        background: 'rgba(0,0,0,0.5)', borderRadius: 4, fontSize: 11, color: 'rgba(0,255,65,0.7)' }}>
        cd {ch.path} && cat mission.txt
      </code>
    </div>
  )
}

// ─── Tools Tab ────────────────────────────────────────────────────────────────

function ToolsTab() {
  const [category, setCategory] = useState<ToolCategory>('Tümü')
  const [search,   setSearch]   = useState('')
  const [selected, setSelected] = useState<ToolCard | null>(null)

  const filtered = TOOLS.filter(t => {
    const matchCat = category === 'Tümü' || t.category === category
    const q = search.toLowerCase()
    const matchSearch = !q || t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.tags.some(tag => tag.includes(q))
    return matchCat && matchSearch
  })

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Left panel */}
      <div style={{ width: 280, borderRight: '1px solid rgba(255,255,255,0.06)',
        overflowY: 'auto', background: '#050505' }}>
        <div style={{ padding: '1rem' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Araç ara..."
            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6, padding: '0.5rem 0.75rem', color: '#e2e8f0', fontSize: 12,
              fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ padding: '0 0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.75rem' }}>
          {TOOL_CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setCategory(cat)}
              style={{ padding: '2px 10px', borderRadius: 12, fontSize: 11, cursor: 'pointer',
                fontFamily: 'monospace', border: '1px solid',
                borderColor: category === cat ? '#00ff41' : 'rgba(255,255,255,0.1)',
                background: category === cat ? 'rgba(0,255,65,0.12)' : 'transparent',
                color: category === cat ? '#00ff41' : 'rgba(255,255,255,0.4)' }}>
              {cat}
            </button>
          ))}
        </div>

        {filtered.map(tool => (
          <button key={tool.id} onClick={() => setSelected(tool)}
            style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem', border: 'none',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
              background: selected?.id === tool.id ? 'rgba(0,255,65,0.06)' : 'transparent',
              cursor: 'pointer',
              borderLeft: selected?.id === tool.id ? '2px solid #00ff41' : '2px solid transparent' }}>
            <div style={{ color: selected?.id === tool.id ? '#00ff41' : '#e2e8f0',
              fontSize: 13, fontWeight: 600, fontFamily: 'monospace' }}>
              {tool.name}
            </div>
            <div style={{ color: 'rgba(148,163,184,0.6)', fontSize: 11, marginTop: 2 }}>
              {tool.category}
            </div>
          </button>
        ))}
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
        {selected ? <ToolDetail tool={selected} /> : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace', fontSize: 13 }}>
            ← Soldan bir araç seç
          </div>
        )}
      </div>
    </div>
  )
}

function ToolDetail({ tool }: { tool: ToolCard }) {
  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <h2 style={{ color: '#00ff41', fontFamily: 'monospace', fontSize: 22, fontWeight: 800, margin: 0 }}>
            {tool.name}
          </h2>
          <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: 11,
            background: 'rgba(0,255,65,0.1)', color: '#00ff41', border: '1px solid rgba(0,255,65,0.25)' }}>
            {tool.category}
          </span>
        </div>
        <p style={{ color: 'rgba(226,232,240,0.7)', fontSize: 13, lineHeight: 1.7, margin: 0 }}>
          {tool.description}
        </p>
      </div>

      <CodeBlock label="Kurulum" code={tool.install} />

      <Section title="Önemli Parametreler">
        <div style={{ display: 'grid', gap: '0.4rem' }}>
          {tool.flags.map(f => (
            <div key={f.flag} style={{ display: 'flex', gap: '1rem', padding: '0.5rem 0.75rem',
              borderRadius: 4, background: 'rgba(255,255,255,0.02)', alignItems: 'flex-start' }}>
              <code style={{ color: '#00ff41', fontSize: 12, minWidth: 140, flexShrink: 0,
                fontFamily: 'monospace' }}>{f.flag}</code>
              <span style={{ color: 'rgba(226,232,240,0.65)', fontSize: 12 }}>{f.description}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Kullanım Örnekleri">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {tool.examples.map((ex, i) => (
            <div key={i} style={{ borderRadius: 6, overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ background: '#111', padding: '0.75rem 1rem' }}>
                <pre style={{ margin: 0, color: '#e2e8f0', fontSize: 12, fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap' }}>{ex.command}</pre>
              </div>
              <div style={{ padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.02)',
                color: 'rgba(148,163,184,0.7)', fontSize: 11 }}>
                {ex.description}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '1.5rem' }}>
        {tool.tags.map(tag => (
          <span key={tag} style={{ padding: '2px 10px', borderRadius: 12, fontSize: 11,
            background: 'rgba(255,255,255,0.05)', color: 'rgba(148,163,184,0.6)',
            border: '1px solid rgba(255,255,255,0.08)', fontFamily: 'monospace' }}>
            #{tag}
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Setup Tab ────────────────────────────────────────────────────────────────

function SetupTab() {
  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '2rem 1.5rem' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <SectionHeader
          eyebrow="GERÇEK SUNUCU"
          title="Terminal Kurulum Rehberi"
          subtitle="node-pty + WebSocket ile tarayıcıdan gerçek Linux shell"
        />

        <InfoBox type="warning">
          Bu kurulum bir <strong>VPS veya yerel sunucu</strong> gerektirir.
          Vercel gibi serverless platformlarda çalışmaz (process spawn + persistent WebSocket).
          <br /><br />
          Önerilen: <strong>DigitalOcean Droplet $6/ay</strong> veya yerel Ubuntu makinesi.
        </InfoBox>

        <Section title="1. Sunucu Kurulumu">
          <CodeBlock label="Ubuntu 22.04 — Gereksinimler" code={`# Node.js 20 kur
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs build-essential python3

# node-pty için derleme araçları
sudo apt install -y libpty-dev`} />
        </Section>

        <Section title="2. Terminal Server Oluştur">
          <CodeBlock label="terminal-server/server.js" code={`const { WebSocketServer } = require('ws')
const pty = require('node-pty')

const wss = new WebSocketServer({ port: 3001 })

wss.on('connection', (ws) => {
  // Her bağlantı için ayrı shell process
  const shell = pty.spawn('bash', [], {
    name: 'xterm-256color',
    cols: 120,
    rows: 35,
    cwd: '/home/operator',
    env: {
      ...process.env,
      PS1: '\\\\u@breach-lab:\\\\w$ ',
      HOME: '/home/operator',
      USER: 'operator',
    },
  })

  // Shell → Browser
  shell.onData((data) => ws.send(data))

  // Browser → Shell
  ws.on('message', (data) => shell.write(data))

  // Temizlik
  ws.on('close', () => shell.kill())
})`} />

          <CodeBlock label="Bağımlılıklar" code={`cd terminal-server
npm init -y
npm install ws node-pty
node server.js`} />
        </Section>

        <Section title="3. Güvenli Kullanıcı Ortamı">
          <CodeBlock label="Sandbox kullanıcı oluştur" code={`# Kısıtlı operator kullanıcısı
sudo useradd -m -s /bin/bash operator
sudo passwd operator

# İzole dizin
sudo mkdir -p /home/operator/challenges
sudo chown -R operator:operator /home/operator

# Sadece belirli komutlara izin ver (opsiyonel)
# /etc/sudoers.d/operator dosyası ile kısıtla`} />
        </Section>

        <Section title="4. Next.js'e Bağla">
          <CodeBlock label="Sayfada wsUrl prop'unu ver" code={`// src/app/community/page.tsx
<Terminal wsUrl="ws://sunucu-ip:3001" onFlagSubmit={handleFlagSubmit} />

// .env.local
NEXT_PUBLIC_TERMINAL_WS=ws://sunucu-ip:3001`} />
        </Section>

        <Section title="5. Production — Nginx + SSL">
          <CodeBlock label="/etc/nginx/sites-available/breach-lab" code={`server {
  listen 443 ssl;
  server_name terminal.siteniz.com;

  ssl_certificate /etc/letsencrypt/live/terminal.siteniz.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/terminal.siteniz.com/privkey.pem;

  location /terminal {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
    proxy_set_header Host $host;
  }
}`} />

          <InfoBox type="info">
            SSL ile birlikte WebSocket adresi <code>wss://</code> olur.
            <br />
            <code>NEXT_PUBLIC_TERMINAL_WS=wss://terminal.siteniz.com/terminal</code>
          </InfoBox>
        </Section>

        <Section title="Mimariye Genel Bakış">
          <div style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.02)',
            borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)', fontFamily: 'monospace', fontSize: 12,
            color: 'rgba(226,232,240,0.7)', lineHeight: 2 }}>
            <div style={{ color: '#00ff41' }}>Tarayıcı (xterm.js)</div>
            <div style={{ paddingLeft: '1rem' }}>↕ WebSocket (ws:// veya wss://)</div>
            <div style={{ color: '#60a5fa' }}>Node.js Server (node-pty)</div>
            <div style={{ paddingLeft: '1rem' }}>↕ PTY (pseudo-terminal)</div>
            <div style={{ color: '#f59e0b' }}>Bash Process (/home/operator)</div>
          </div>
        </Section>
      </div>
    </div>
  )
}

// ─── Shared UI Helpers ────────────────────────────────────────────────────────

function SectionHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <div style={{ marginBottom: '2rem' }}>
      <p style={{ color: 'rgba(0,255,65,0.5)', fontSize: 11, letterSpacing: '0.2em',
        textTransform: 'uppercase', marginBottom: '0.4rem' }}>
        {eyebrow}
      </p>
      <h2 style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 22,
        fontFamily: 'monospace', margin: '0 0 0.4rem' }}>
        {title}
      </h2>
      <p style={{ color: 'rgba(148,163,184,0.7)', fontSize: 13, margin: 0 }}>{subtitle}</p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '2rem' }}>
      <h3 style={{ color: '#00ff41', fontFamily: 'monospace', fontSize: 14,
        fontWeight: 700, letterSpacing: '0.05em', margin: '0 0 0.75rem',
        borderBottom: '1px solid rgba(0,255,65,0.15)', paddingBottom: '0.4rem' }}>
        {title}
      </h3>
      {children}
    </div>
  )
}

function CodeBlock({ label, code }: { label: string; code: string }) {
  return (
    <div style={{ marginBottom: '1rem', borderRadius: 6, overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ padding: '0.4rem 1rem', background: 'rgba(255,255,255,0.04)',
        color: 'rgba(148,163,184,0.6)', fontSize: 11, fontFamily: 'monospace',
        borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {label}
      </div>
      <pre style={{ margin: 0, padding: '0.75rem 1rem', background: '#0a0a0a',
        color: '#e2e8f0', fontSize: 12, fontFamily: 'monospace',
        overflowX: 'auto', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
        {code}
      </pre>
    </div>
  )
}

function InfoBox({ type, children }: { type: 'warning' | 'info'; children: React.ReactNode }) {
  const color = type === 'warning' ? '#f59e0b' : '#60a5fa'
  return (
    <div style={{ padding: '1rem 1.25rem', borderRadius: 6, marginBottom: '1.5rem',
      border: `1px solid ${color}30`, background: `${color}08`,
      color: 'rgba(226,232,240,0.75)', fontSize: 13, lineHeight: 1.7,
      borderLeft: `3px solid ${color}` }}>
      {children}
    </div>
  )
}
