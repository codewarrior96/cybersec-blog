'use client';
import React, { useState, useEffect } from 'react';
import { X, FileText, Send, CheckCircle, AlertCircle, Tag, Users, Shield } from 'lucide-react';
import Link from 'next/link';
import type { AttackEvent } from '@/lib/dashboard-types';
import { dispatchReportsUpdatedEvent } from '@/lib/reports-events';

interface AttackReportModalProps {
  attack: AttackEvent | null;
  open: boolean;
  onClose: () => void;
}

// ─── Static attack explanations (Turkish) ────────────────────────────────────

function getAttackExplanation(type: string): { title: string; description: string; mitre: string } {
  const t = type.toLowerCase();

  if (t.includes('sql') || t.includes('sqli')) return {
    title: 'SQL Injection (SQLi)',
    description:
      'SQL Injection, saldırganın uygulama giriş alanlarına kötü amaçlı SQL sorguları enjekte ederek veritabanı üzerinde yetkisiz işlemler gerçekleştirdiği bir saldırı vektörüdür. ' +
      'Saldırgan; kullanıcı verilerini sızdırabilir, kimlik doğrulamayı atlayabilir veya veritabanını tamamen silebilir. ' +
      'Klasik SQLi vektörleri: hata tabanlı, kör (blind) ve zamanlama tabanlı enjeksiyonlardır.',
    mitre: 'MITRE ATT&CK: T1190 — Exploit Public-Facing Application',
  };

  if (t.includes('xss') || t.includes('cross-site scripting')) return {
    title: 'Cross-Site Scripting (XSS)',
    description:
      'XSS saldırıları, saldırganın web sayfasına kötü amaçlı JavaScript kodu enjekte etmesiyle gerçekleşir. ' +
      'Kurban tarayıcısında çalışan bu kod; oturum çerezlerini çalabilir, kullanıcıyı sahte sayfalara yönlendirebilir veya tuş kaydı yapabilir. ' +
      'Reflected, Stored ve DOM-based olmak üzere üç ana türü vardır. Stored XSS en tehlikeli varyantıdır.',
    mitre: 'MITRE ATT&CK: T1059.007 — JavaScript / XSS',
  };

  if (t.includes('rce') || t.includes('remote code')) return {
    title: 'Remote Code Execution (RCE)',
    description:
      'RCE, saldırganın hedef sistemde uzaktan rastgele kod çalıştırabildiği kritik bir güvenlik açığıdır. ' +
      'Genellikle işletim sistemi veya uygulama katmanındaki tampon taşması, deserialization veya komut enjeksiyonu zafiyetleri üzerinden tetiklenir. ' +
      'Başarılı bir RCE, saldırgana tam sistem kontrolü sağlayabilir ve ağ içinde lateral movement için zemin hazırlar.',
    mitre: 'MITRE ATT&CK: T1203 — Exploitation for Client Execution',
  };

  if (t.includes('ssh') || t.includes('brute') || t.includes('bruteforce')) return {
    title: 'SSH Brute Force Saldırısı',
    description:
      'Brute force saldırısında saldırgan, hedef servise (genellikle SSH port 22) sistematik şifre kombinasyonları deneyerek yetkisiz erişim elde etmeye çalışır. ' +
      'Sözlük saldırıları (dictionary attack), credential stuffing ve pure brute force yöntemleri kullanılır. ' +
      'Başarılı bir SSH erişimi; sistem üzerinde kalıcı arka kapı kurulumu, veri sızdırma ve yatay hareket için kullanılabilir.',
    mitre: 'MITRE ATT&CK: T1110 — Brute Force',
  };

  if (t.includes('ddos') || t.includes('dos') || t.includes('flood')) return {
    title: 'DDoS / DoS Saldırısı',
    description:
      'Dağıtık Hizmet Engelleme (DDoS) saldırısında, botnet ağından gelen yüksek hacimli trafik hedef sistemi veya ağı kullanılamaz hale getirir. ' +
      'Volumetric (UDP/ICMP flood), Protocol (SYN flood) ve Application Layer (HTTP flood) katmanlarında gerçekleşebilir. ' +
      'Botnet altyapısı genellikle IoT cihazları veya ele geçirilmiş sunuculardan oluşur.',
    mitre: 'MITRE ATT&CK: T1498 — Network Denial of Service',
  };

  if (t.includes('phishing') || t.includes('spear')) return {
    title: 'Phishing / Spear Phishing',
    description:
      'Phishing, kullanıcıları sahte e-posta, sayfa veya mesajlar aracılığıyla kimlik bilgilerini açıklamaya veya zararlı yazılım çalıştırmaya ikna eden sosyal mühendislik saldırısıdır. ' +
      'Spear phishing ise belirli bir hedef veya kuruluşa özel olarak hazırlanmış, çok daha ikna edici bir varyanttır. ' +
      'Başarılı kimlik avı; credential harvest, malware deployment veya BEC (Business Email Compromise) ile sonuçlanabilir.',
    mitre: 'MITRE ATT&CK: T1566 — Phishing',
  };

  if (t.includes('port') || t.includes('scan') || t.includes('recon')) return {
    title: 'Port Tarama / Keşif (Reconnaissance)',
    description:
      'Port tarama, saldırganın hedef sistemdeki açık portları, çalışan servisleri ve güvenlik açıklarını tespit etmek amacıyla gerçekleştirdiği keşif faaliyetidir. ' +
      'Nmap, Masscan gibi araçlarla TCP SYN, UDP ve servis versiyon taramaları yapılır. ' +
      'Bu aşama genellikle bir saldırının ilk adımıdır ve hedef profili çıkarmak için kullanılır.',
    mitre: 'MITRE ATT&CK: T1046 — Network Service Discovery',
  };

  if (t.includes('malware') || t.includes('ransomware') || t.includes('trojan')) return {
    title: 'Malware / Zararlı Yazılım',
    description:
      'Zararlı yazılımlar; fidye yazılımı (ransomware), Truva atı (trojan), casus yazılım (spyware) ve rootkit gibi çeşitli biçimlerde karşımıza çıkar. ' +
      'Genellikle phishing e-postaları, güvenli olmayan indirmeler veya exploit kitler aracılığıyla sisteme bulaşır. ' +
      'Ransomware, dosyaları şifreleyerek fidye talep eder; trojanlar ise arka kapı açarak uzaktan komuta-kontrol (C2) bağlantısı kurar.',
    mitre: 'MITRE ATT&CK: T1204 — User Execution / T1486 — Data Encrypted for Impact',
  };

  if (t.includes('lfi') || t.includes('rfi') || t.includes('file inclusion')) return {
    title: 'File Inclusion (LFI/RFI)',
    description:
      'Local File Inclusion (LFI) ve Remote File Inclusion (RFI) saldırıları, web uygulamalarındaki dosya yükleme parametrelerinin yetersiz doğrulanmasından kaynaklanır. ' +
      'LFI ile saldırgan /etc/passwd gibi yerel sistem dosyalarını okuyabilir; RFI ile uzak sunucudaki zararlı kod çalıştırılabilir. ' +
      'Path traversal (../../../) teknikleri sıklıkla bu saldırılarla birlikte kullanılır.',
    mitre: 'MITRE ATT&CK: T1190 — Exploit Public-Facing Application',
  };

  if (t.includes('mitm') || t.includes('man-in-the-middle') || t.includes('arp')) return {
    title: 'Man-in-the-Middle (MitM) Saldırısı',
    description:
      'MitM saldırısında saldırgan, iki taraf arasındaki iletişime gizlice aracılık ederek veri trafiğini dinler veya değiştirir. ' +
      'ARP poisoning, DNS spoofing ve SSL stripping bu saldırının yaygın teknikleridir. ' +
      'Şifrelenmemiş protokoller (HTTP, FTP, Telnet) MitM saldırılarına en açık iletişim kanallarıdır.',
    mitre: 'MITRE ATT&CK: T1557 — Adversary-in-the-Middle',
  };

  // Generic fallback
  return {
    title: type,
    description:
      `${type} saldırısı, hedef sisteme veya ağa yetkisiz erişim elde etmek ya da normal işleyişi bozmak amacıyla gerçekleştirilen bir siber saldırıdır. ` +
      'Saldırının tam vektörü ve kullanılan teknikler, derinlemesine log analizi ve ağ trafiği incelemesiyle belirlenmelidir. ' +
      'Olay müdahale ekibinin mevcut bulgular doğrultusunda detaylı bir inceleme başlatması önerilir.',
    mitre: 'MITRE ATT&CK: Detaylı analiz gereklidir',
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function deriveTags(attack: AttackEvent): string[] {
  const type = attack.type.toLowerCase();
  const tags: string[] = [];
  if (type.includes('ssh') || type.includes('brute')) tags.push('bruteforce');
  if (type.includes('sql'))      tags.push('sqli');
  if (type.includes('rce'))      tags.push('exploit', 'rce');
  if (type.includes('ddos'))     tags.push('botnet', 'ddos');
  if (type.includes('phishing')) tags.push('phishing', 'social-engineering');
  if (type.includes('port') || type.includes('scan')) tags.push('scanner', 'reconnaissance');
  if (type.includes('xss'))      tags.push('xss', 'web');
  tags.push(attack.sourceCountry.toLowerCase().replace(/\s+/g, '-'));
  return Array.from(new Set(tags));
}

function toDifficulty(sev: string): 'beginner' | 'intermediate' | 'advanced' {
  if (sev === 'critical') return 'advanced';
  if (sev === 'high')     return 'intermediate';
  return 'beginner';
}

function toCategory(type: string): string {
  const t = type.toLowerCase();
  if (t.includes('phishing') || t.includes('malware')) return 'MALWARE';
  if (t.includes('rce') || t.includes('sql') || t.includes('xss')) return 'PENTEST';
  return 'NETWORK';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AttackReportModal({ attack, open, onClose }: AttackReportModalProps) {
  const [title,        setTitle]        = useState('');
  const [severity,     setSeverity]     = useState('CRITICAL');
  const [tags,         setTags]         = useState<string[]>([]);
  const [tagInput,     setTagInput]     = useState('');
  const [toCommunity,  setToCommunity]  = useState(false);
  const [status,       setStatus]       = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg,     setErrorMsg]     = useState('');

  // Editable analyst sections
  const [bulgular,  setBulgular]  = useState('');
  const [etki,      setEtki]      = useState('');
  const [oneriler,  setOneriler]  = useState('');
  const [savunma,   setSavunma]   = useState('');

  // Derived static explanation
  const [explanation, setExplanation] = useState<ReturnType<typeof getAttackExplanation> | null>(null);

  useEffect(() => {
    if (!attack || !open) return;
    const sev = attack.severity.toUpperCase();
    setTitle(`[${sev}] ${attack.type} — ${attack.sourceCountry} (${attack.sourceIP})`);
    setSeverity(sev);
    setTags(deriveTags(attack));
    setStatus('idle');
    setErrorMsg('');
    setBulgular('');
    setEtki('');
    setOneriler('');
    setSavunma('');
    setExplanation(getAttackExplanation(attack.type));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attack, open]);

  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, '-');
    if (t && !tags.includes(t)) setTags(prev => [...prev, t]);
    setTagInput('');
  };
  const removeTag = (t: string) => setTags(prev => prev.filter(x => x !== t));

  const buildContent = () => [
    `## Saldırı Özeti`,
    ``,
    `**Kaynak IP:** ${attack?.sourceIP}`,
    `**Kaynak Ülke:** ${attack?.sourceCountry}`,
    `**Saldırı Tipi:** ${attack?.type}`,
    `**Hedef Port:** ${attack?.targetPort}`,
    `**Önem Seviyesi:** ${severity}`,
    `**Zaman:** ${attack ? new Date(attack.createdAt).toLocaleString('tr-TR') : ''}`,
    ``,
    `### Saldırı Hakkında`,
    explanation?.description ?? '',
    ``,
    `_${explanation?.mitre ?? ''}_`,
    ``,
    `## Bulgular`,
    bulgular || '[Analist notu girilmedi]',
    ``,
    `## Etki Değerlendirmesi`,
    etki || '[Analist notu girilmedi]',
    ``,
    `## Öneriler`,
    oneriler || '[Analist notu girilmedi]',
    ``,
    `## Savunma Hattı`,
    savunma || '[Analist notu girilmedi]',
  ].join('\n');

  const handleSubmit = async () => {
    if (!title.trim()) {
      setErrorMsg('Başlık zorunludur.');
      setStatus('error');
      return;
    }
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content: buildContent(), severity, tags }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? `HTTP ${res.status}`);
      }

      if (toCommunity && attack && typeof window !== 'undefined') {
        try {
          const existing = JSON.parse(localStorage.getItem('community_posts') ?? '[]') as unknown[];
          const newPost = {
            id: `report-${Date.now()}`,
            author: 'Ghost Admin', authorRole: 'Admin',
            title, content: buildContent(),
            category: toCategory(attack.type),
            difficulty: toDifficulty(attack.severity),
            tags, likes: [], comments: [],
            createdAt: new Date().toISOString(), views: 0,
          };
          localStorage.setItem('community_posts', JSON.stringify([newPost, ...existing]));
        } catch { /* ignore */ }
      }
      dispatchReportsUpdatedEvent();

      setStatus('success');
      setTimeout(() => { onClose(); setStatus('idle'); }, 2400);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Bilinmeyen hata.');
      setStatus('error');
    }
  };

  if (!open || !attack) return null;

  const sev = attack.severity.toUpperCase();
  const sevColor = sev === 'CRITICAL' ? '#ef4444' : sev === 'HIGH' ? '#f97316' : '#eab308';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(1,8,6,0.85)', backdropFilter: 'blur(6px)' }}>
      <div className="w-full max-w-2xl flex flex-col rounded-lg border overflow-hidden font-mono"
        style={{ background: '#020d0a', borderColor: 'rgba(16,185,129,0.35)',
          boxShadow: '0 0 70px rgba(16,185,129,0.12)', maxHeight: '92vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-emerald-500/20 shrink-0">
          <div className="flex items-center gap-3">
            <FileText className="w-4 h-4 text-emerald-300" />
            <span className="text-emerald-300 font-bold tracking-widest text-xs uppercase">
              Saldırı İnceleme Raporu
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5,
              background: 'rgba(239,68,68,0.08)', border: `1px solid ${sevColor}40`,
              borderRadius: 4, padding: '2px 8px' }}>
              <span style={{ fontSize: 9, color: sevColor, fontWeight: 700, letterSpacing: '0.1em' }}>
                ● {sev}
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
            <p className="text-green-400 font-bold text-lg">Rapor oluşturuldu!</p>
            <p className="text-slate-500 text-sm text-center">
              Rapor kaydedildi.{toCommunity && ' Community\'ye gönderildi.'}
            </p>
            <Link href="/zafiyet-taramasi"
              className="text-cyan-300 text-xs underline underline-offset-2 hover:text-cyan-200">
              Sentinel'de görüntüle →
            </Link>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">

            {/* Attack summary (read-only) */}
            {explanation && (
              <div className="rounded border p-4 space-y-2"
                style={{ background: 'rgba(16,185,129,0.05)', borderColor: 'rgba(16,185,129,0.25)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="w-3.5 h-3.5 text-emerald-300" />
                  <span className="text-[10px] text-emerald-300 font-bold tracking-widest uppercase">
                    {explanation.title}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{explanation.description}</p>
                <p className="text-[10px] text-slate-600 italic">{explanation.mitre}</p>
                <div className="pt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px] text-slate-500">
                  <span><span className="text-slate-600">IP:</span> {attack.sourceIP}</span>
                  <span><span className="text-slate-600">ÜLKE:</span> {attack.sourceCountry}</span>
                  <span><span className="text-slate-600">PORT:</span> {attack.targetPort}</span>
                  <span><span className="text-slate-600">ZAMAN:</span> {new Date(attack.createdAt).toLocaleString('tr-TR')}</span>
                </div>
              </div>
            )}

            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-[9px] text-slate-500 tracking-widest uppercase">Rapor Başlığı</label>
              <input value={title} onChange={e => setTitle(e.target.value)}
                className="w-full bg-[#03100d] border border-emerald-900/40 rounded px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-cyan-400/60 transition-colors"
                placeholder="Rapor başlığı..." />
            </div>

            {/* Severity + Tags */}
            <div className="flex gap-3">
              <div className="space-y-1.5 w-36 shrink-0">
                <label className="text-[9px] text-slate-500 tracking-widest uppercase">Önem</label>
                <select value={severity} onChange={e => setSeverity(e.target.value)}
                  className="w-full bg-[#03100d] border border-emerald-900/40 rounded px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-cyan-400/60">
                  <option value="CRITICAL">KRİTİK</option>
                  <option value="HIGH">YÜKSEK</option>
                  <option value="MEDIUM">ORTA</option>
                  <option value="LOW">DÜŞÜK</option>
                </select>
              </div>
              <div className="flex-1 space-y-1.5">
                <label className="text-[9px] text-slate-500 tracking-widest uppercase">Etiketler</label>
                <div className="flex flex-wrap gap-1.5 min-h-[38px] bg-[#03100d] border border-emerald-900/40 rounded px-2 py-1.5 items-center focus-within:border-cyan-400/60 transition-colors">
                  {tags.map(t => (
                    <span key={t} className="flex items-center gap-1 bg-cyan-900/30 border border-cyan-700/40 px-1.5 py-0.5 rounded text-[10px] text-cyan-200">
                      <Tag className="w-2.5 h-2.5" />
                      {t}
                      <button onClick={() => removeTag(t)} className="text-slate-500 hover:text-red-400 ml-0.5">×</button>
                    </span>
                  ))}
                  <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); }}}
                    className="flex-1 min-w-[80px] bg-transparent text-[11px] text-slate-300 focus:outline-none placeholder-slate-600"
                    placeholder="etiket ekle..." />
                </div>
              </div>
            </div>

            {/* Analyst sections */}
            {[
              { label: 'Bulgular', value: bulgular, set: setBulgular,
                placeholder: 'Bu saldırıda gözlemlenen teknik bulgular, IoC\'ler, saldırı vektörü...' },
              { label: 'Etki Değerlendirmesi', value: etki, set: setEtki,
                placeholder: 'Potansiyel etki, risk skoru, etkilenen sistemler, veri ihlali riski...' },
              { label: 'Öneriler', value: oneriler, set: setOneriler,
                placeholder: '1. IP engelle\n2. Port kapat\n3. Log incele\n4. Yama uygula...' },
              { label: 'Savunma Hattı', value: savunma, set: setSavunma,
                placeholder: 'Güvenlik duvarı kuralları, IDS/IPS imzaları, SIEM korelasyonu, hardening...' },
            ].map(({ label, value, set, placeholder }) => (
              <div key={label} className="space-y-1.5">
                <label className="text-[9px] text-slate-500 tracking-widest uppercase">{label}</label>
                <textarea value={value} onChange={e => set(e.target.value)} rows={3}
                  className="w-full bg-[#03100d] border border-emerald-900/40 rounded px-3 py-2 text-sm text-slate-300 font-mono resize-none focus:outline-none focus:border-cyan-400/60 transition-colors leading-relaxed"
                  placeholder={placeholder} />
              </div>
            ))}

            {/* Community toggle */}
            <label className="flex items-center gap-3 cursor-pointer group">
              <div onClick={() => setToCommunity(v => !v)}
                className="w-9 h-5 rounded-full border transition-all duration-200 flex items-center px-0.5"
                style={{ background: toCommunity ? 'rgba(16,185,129,0.3)' : '#03110d',
                  borderColor: toCommunity ? 'rgba(16,185,129,0.65)' : 'rgba(16,185,129,0.25)' }}>
                <div className="w-4 h-4 rounded-full transition-transform duration-200"
                  style={{ background: toCommunity ? '#10b981' : '#334155',
                    transform: toCommunity ? 'translateX(16px)' : 'translateX(0)',
                    boxShadow: toCommunity ? '0 0 8px #10b981' : 'none' }} />
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-300 transition-colors" />
                <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors">
                  Community'ye de paylaş
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
          <div className="shrink-0 flex items-center justify-between px-5 py-3 border-t border-emerald-500/15">
            <button onClick={onClose} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
              İptal
            </button>
            <button onClick={handleSubmit}
              disabled={status === 'loading'}
              className="flex items-center gap-2 px-5 py-2 rounded font-bold text-xs transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
              style={{ background: 'rgba(16,185,129,0.18)', border: '1px solid rgba(34,211,238,0.45)', color: '#a7f3d0' }}>
              {status === 'loading'
                ? <><span className="animate-spin w-3.5 h-3.5 border border-t-transparent border-cyan-300 rounded-full" /> Gönderiliyor...</>
                : <><Send className="w-3.5 h-3.5" /> Raporu Kaydet</>
              }
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

