'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, CheckCircle, FileText, Send, Shield, Tag, Users, X } from 'lucide-react'
import { dispatchReportsUpdatedEvent } from '@/lib/reports-events'

interface IncidentTimelineEntry {
  time: string
  desc: string
  type: string
}

export interface AttackReportIncident {
  id: string
  sev: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  label: string
  source: string
  node: string
  region: string
  time: string
  timeline?: IncidentTimelineEntry[]
}

interface AttackReportModalProps {
  incident: AttackReportIncident | null
  open: boolean
  onClose: () => void
}

function getAttackExplanation(label: string): { title: string; description: string; mitre: string } {
  const value = label.toLowerCase()

  if (value.includes('sql')) {
    return {
      title: 'SQL Injection',
      description:
        'Injection tabanli bir web uygulama saldirisi gozlendi. Sorgu manipule edilerek veri tabani erisimi, veri sizdirma veya yetkisiz islem riski olusabilir.',
      mitre: 'MITRE ATT&CK: T1190 - Exploit Public-Facing Application',
    }
  }

  if (value.includes('ransom')) {
    return {
      title: 'Ransomware',
      description:
        'Dosya sifreleme veya etki olusturma odakli bir malware akisi tespit edildi. Ilk erisim, yatay hareket ve kalicilik zinciri arastirilmalidir.',
      mitre: 'MITRE ATT&CK: T1486 - Data Encrypted for Impact',
    }
  }

  if (value.includes('auth')) {
    return {
      title: 'Authentication Bypass',
      description:
        'Kimlik dogrulama kontrolunun atlatildigina veya yetki seviyesinin beklenmeyen sekilde artirildigina isaret eden bulgular olusmustur.',
      mitre: 'MITRE ATT&CK: T1078 - Valid Accounts',
    }
  }

  if (value.includes('c2')) {
    return {
      title: 'Command and Control',
      description:
        'Sistem, uzaktan yonetim veya beaconing paternine benzeyen duzenli haberlesme davranisi gostermistir. Kalicilik ve veri cikisi riski degerlendirilmelidir.',
      mitre: 'MITRE ATT&CK: T1071 - Application Layer Protocol',
    }
  }

  if (value.includes('flood')) {
    return {
      title: 'Denial of Service',
      description:
        'Ag veya servis kapasitesini tuketmeye yonelik asiri trafik paterni algilanmistir. Kural sertlestirme ve upstream koruma gerekebilir.',
      mitre: 'MITRE ATT&CK: T1498 - Network Denial of Service',
    }
  }

  if (value.includes('exfil')) {
    return {
      title: 'Data Exfiltration',
      description:
        'Anormal buyuklukte veri cikisi veya hassas veri tasinmasi ihtimali vardir. Hedef sistemler ve veri siniflandirmasi tekrar incelenmelidir.',
      mitre: 'MITRE ATT&CK: T1041 - Exfiltration Over C2 Channel',
    }
  }

  return {
    title: label,
    description:
      'Kritik seviyede bir olay kaydi olustu. Saldiri vektoru, etki alani ve baglamsal forensics bulgulari ayrintili sekilde analiz edilmelidir.',
    mitre: 'MITRE ATT&CK: Detailed investigation required',
  }
}

function deriveTags(incident: AttackReportIncident): string[] {
  const value = incident.label.toLowerCase()
  const tags: string[] = []

  if (value.includes('sql')) tags.push('sqli', 'injection', 'database')
  if (value.includes('ransom')) tags.push('ransomware', 'malware', 'impact')
  if (value.includes('auth')) tags.push('auth-bypass', 'credential', 'privilege-escalation')
  if (value.includes('c2')) tags.push('c2', 'beaconing', 'persistence')
  if (value.includes('flood')) tags.push('ddos', 'network', 'dos')
  if (value.includes('exfil')) tags.push('exfiltration', 'data-loss', 'dlp')

  tags.push(incident.region.toLowerCase().replace(/\s+/g, '-'))
  return Array.from(new Set(tags))
}

function toCommunityCategory(label: string): string {
  const value = label.toLowerCase()
  if (value.includes('sql') || value.includes('auth')) return 'PENTEST'
  if (value.includes('ransom') || value.includes('c2')) return 'MALWARE'
  return 'NETWORK'
}

export default function AttackReportModal({ incident, open, onClose }: AttackReportModalProps) {
  const [title, setTitle] = useState('')
  const [severity, setSeverity] = useState<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'>('CRITICAL')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [toCommunity, setToCommunity] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [findings, setFindings] = useState('')
  const [impact, setImpact] = useState('')
  const [recommendations, setRecommendations] = useState('')
  const [defense, setDefense] = useState('')
  const [explanation, setExplanation] = useState<ReturnType<typeof getAttackExplanation> | null>(null)

  useEffect(() => {
    if (!incident || !open) return
    setTitle(`[${incident.sev}] ${incident.label} - ${incident.region} (${incident.source})`)
    setSeverity(incident.sev)
    setTags(deriveTags(incident))
    setTagInput('')
    setToCommunity(false)
    setStatus('idle')
    setErrorMsg('')
    setFindings('')
    setImpact('')
    setRecommendations('')
    setDefense('')
    setExplanation(getAttackExplanation(incident.label))
  }, [incident, open])

  const addTag = () => {
    const next = tagInput.trim().toLowerCase().replace(/\s+/g, '-')
    if (next && !tags.includes(next)) setTags((prev) => [...prev, next])
    setTagInput('')
  }

  const removeTag = (value: string) => {
    setTags((prev) => prev.filter((item) => item !== value))
  }

  const buildContent = () => [
    '## Incident Summary',
    '',
    `**Incident ID:** ${incident?.id ?? ''}`,
    `**Attack Type:** ${incident?.label ?? ''}`,
    `**Severity:** ${severity}`,
    `**Source IP:** ${incident?.source ?? ''}`,
    `**Target Node:** ${incident?.node ?? ''}`,
    `**Region:** ${incident?.region ?? ''}`,
    `**Detected At:** ${incident ? new Date(incident.time).toLocaleString('tr-TR') : ''}`,
    '',
    '### Attack Context',
    explanation?.description ?? '',
    '',
    `_${explanation?.mitre ?? ''}_`,
    '',
    '## Findings',
    findings || '[Analyst note pending]',
    '',
    '## Impact Assessment',
    impact || '[Analyst note pending]',
    '',
    '## Recommendations',
    recommendations || '[Analyst note pending]',
    '',
    '## Defense Line',
    defense || '[Analyst note pending]',
    '',
    '## Timeline',
    incident?.timeline?.length
      ? incident.timeline.map((entry) => `- ${new Date(entry.time).toLocaleTimeString('tr-TR')} [${entry.type}] ${entry.desc}`).join('\n')
      : '- No timeline entries available.',
  ].join('\n')

  const handleSubmit = async () => {
    if (!incident || !title.trim()) {
      setErrorMsg('Report title is required.')
      setStatus('error')
      return
    }

    setStatus('loading')
    setErrorMsg('')

    try {
      const content = buildContent()
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, severity, tags }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string }
        throw new Error(payload.error ?? `HTTP ${response.status}`)
      }

      if (toCommunity && typeof window !== 'undefined') {
        try {
          const existing = JSON.parse(localStorage.getItem('community_posts') ?? '[]') as unknown[]
          const newPost = {
            id: `report-${Date.now()}`,
            author: 'Ghost Admin',
            authorRole: 'Admin',
            title,
            content,
            category: toCommunityCategory(incident.label),
            difficulty: incident.sev === 'CRITICAL' ? 'advanced' : incident.sev === 'HIGH' ? 'intermediate' : 'beginner',
            tags,
            likes: [],
            comments: [],
            createdAt: new Date().toISOString(),
            views: 0,
          }
          localStorage.setItem('community_posts', JSON.stringify([newPost, ...existing]))
        } catch {
          // Keep report creation independent from local community persistence.
        }
      }

      dispatchReportsUpdatedEvent()
      setStatus('success')
      setTimeout(() => {
        onClose()
        setStatus('idle')
      }, 2400)
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Unknown error.')
      setStatus('error')
    }
  }

  if (!open || !incident) return null

  const severityColor =
    severity === 'CRITICAL'
      ? '#ef4444'
      : severity === 'HIGH'
        ? '#f97316'
        : severity === 'MEDIUM'
          ? '#eab308'
          : '#22c55e'

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(6,0,15,0.85)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="w-full max-w-2xl flex flex-col rounded-lg border overflow-hidden font-mono"
        style={{
          background: '#0d0018',
          borderColor: 'rgba(139,92,246,0.3)',
          boxShadow: '0 0 60px rgba(139,92,246,0.12)',
          maxHeight: '92vh',
        }}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-violet-500/20 shrink-0">
          <div className="flex items-center gap-3">
            <FileText className="w-4 h-4 text-violet-400" />
            <span className="text-violet-400 font-bold tracking-widest text-xs uppercase">
              Attack Review Report
            </span>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: 'rgba(239,68,68,0.08)',
                border: `1px solid ${severityColor}40`,
                borderRadius: 4,
                padding: '2px 8px',
              }}
            >
              <span style={{ fontSize: 9, color: severityColor, fontWeight: 700, letterSpacing: '0.1em' }}>
                {severity}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {status === 'success' ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-12 px-8">
            <CheckCircle className="w-12 h-12 text-green-400" />
            <p className="text-green-400 font-bold text-lg">Report created!</p>
            <p className="text-slate-500 text-sm text-center">
              Report saved successfully.{toCommunity && ' Community copy created.'}
            </p>
            <Link
              href="/zafiyet-taramasi"
              className="text-violet-400 text-xs underline underline-offset-2 hover:text-violet-300"
            >
              View in Sentinel
            </Link>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
            {explanation && (
              <div
                className="rounded border p-4 space-y-2"
                style={{ background: 'rgba(139,92,246,0.04)', borderColor: 'rgba(139,92,246,0.2)' }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="w-3.5 h-3.5 text-violet-400" />
                  <span className="text-[10px] text-violet-400 font-bold tracking-widest uppercase">
                    {explanation.title}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{explanation.description}</p>
                <p className="text-[10px] text-slate-600 italic">{explanation.mitre}</p>
                <div className="pt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px] text-slate-500">
                  <span><span className="text-slate-600">IP:</span> {incident.source}</span>
                  <span><span className="text-slate-600">REGION:</span> {incident.region}</span>
                  <span><span className="text-slate-600">NODE:</span> {incident.node}</span>
                  <span><span className="text-slate-600">TIME:</span> {new Date(incident.time).toLocaleString('tr-TR')}</span>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[9px] text-slate-500 tracking-widest uppercase">Report Title</label>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full bg-[#06000f] border border-violet-900/40 rounded px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-violet-500/60 transition-colors"
                placeholder="Report title..."
              />
            </div>

            <div className="flex gap-3">
              <div className="space-y-1.5 w-36 shrink-0">
                <label className="text-[9px] text-slate-500 tracking-widest uppercase">Severity</label>
                <select
                  value={severity}
                  onChange={(event) => setSeverity(event.target.value as typeof severity)}
                  className="w-full bg-[#06000f] border border-violet-900/40 rounded px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-violet-500/60"
                >
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="HIGH">HIGH</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="LOW">LOW</option>
                </select>
              </div>
              <div className="flex-1 space-y-1.5">
                <label className="text-[9px] text-slate-500 tracking-widest uppercase">Tags</label>
                <div className="flex flex-wrap gap-1.5 min-h-[38px] bg-[#06000f] border border-violet-900/40 rounded px-2 py-1.5 items-center focus-within:border-violet-500/60 transition-colors">
                  {tags.map((tag) => (
                    <span key={tag} className="flex items-center gap-1 bg-violet-900/30 border border-violet-700/40 px-1.5 py-0.5 rounded text-[10px] text-violet-300">
                      <Tag className="w-2.5 h-2.5" />
                      {tag}
                      <button onClick={() => removeTag(tag)} className="text-slate-500 hover:text-red-400 ml-0.5">
                        x
                      </button>
                    </span>
                  ))}
                  <input
                    value={tagInput}
                    onChange={(event) => setTagInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ',') {
                        event.preventDefault()
                        addTag()
                      }
                    }}
                    className="flex-1 min-w-[80px] bg-transparent text-[11px] text-slate-300 focus:outline-none placeholder-slate-600"
                    placeholder="add tag..."
                  />
                </div>
              </div>
            </div>

            {([
              {
                label: 'Findings',
                value: findings,
                setValue: setFindings,
                placeholder: 'Observed attack path, IoCs, suspicious assets, and telemetry findings...',
              },
              {
                label: 'Impact Assessment',
                value: impact,
                setValue: setImpact,
                placeholder: 'Potential blast radius, affected systems, and business impact...',
              },
              {
                label: 'Recommendations',
                value: recommendations,
                setValue: setRecommendations,
                placeholder: '1. Block source\n2. Isolate node\n3. Review logs\n4. Patch exposure...',
              },
              {
                label: 'Defense Line',
                value: defense,
                setValue: setDefense,
                placeholder: 'Firewall rules, SIEM correlation, IDS signatures, and hardening actions...',
              },
            ] as const).map(({ label, value, setValue, placeholder }) => (
              <div key={label} className="space-y-1.5">
                <label className="text-[9px] text-slate-500 tracking-widest uppercase">{label}</label>
                <textarea
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  rows={3}
                  className="w-full bg-[#06000f] border border-violet-900/40 rounded px-3 py-2 text-sm text-slate-300 font-mono resize-none focus:outline-none focus:border-violet-500/60 transition-colors leading-relaxed"
                  placeholder={placeholder}
                />
              </div>
            ))}

            <label className="flex items-center gap-3 cursor-pointer group">
              <div
                onClick={() => setToCommunity((value) => !value)}
                className="w-9 h-5 rounded-full border transition-all duration-200 flex items-center px-0.5"
                style={{
                  background: toCommunity ? 'rgba(139,92,246,0.3)' : '#0a0015',
                  borderColor: toCommunity ? 'rgba(139,92,246,0.6)' : 'rgba(139,92,246,0.2)',
                }}
              >
                <div
                  className="w-4 h-4 rounded-full transition-transform duration-200"
                  style={{
                    background: toCommunity ? '#8b5cf6' : '#334155',
                    transform: toCommunity ? 'translateX(16px)' : 'translateX(0)',
                    boxShadow: toCommunity ? '0 0 8px #8b5cf6' : 'none',
                  }}
                />
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-500 group-hover:text-violet-400 transition-colors" />
                <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors">
                  Share a copy to Community
                </span>
              </div>
            </label>

            {status === 'error' && errorMsg && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span className="text-red-400 text-xs">{errorMsg}</span>
              </div>
            )}
          </div>
        )}

        {status !== 'success' && (
          <div className="shrink-0 flex items-center justify-between px-5 py-3 border-t border-violet-500/15">
            <button onClick={onClose} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={status === 'loading'}
              className="flex items-center gap-2 px-5 py-2 rounded font-bold text-xs transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
              style={{ background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.45)', color: '#c084fc' }}
            >
              {status === 'loading'
                ? <><span className="animate-spin w-3.5 h-3.5 border border-t-transparent border-violet-400 rounded-full" /> Saving...</>
                : <><Send className="w-3.5 h-3.5" /> Save Report</>
              }
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
