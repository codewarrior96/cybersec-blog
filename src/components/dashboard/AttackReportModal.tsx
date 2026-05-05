'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, CheckCircle, FileText, Send, Shield, Tag, X } from 'lucide-react'
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

interface AttackProfile {
  title: string
  description: string
  mitre: string
  tags: string[]
  investigationFocus: string[]
  impactStatement: string
  recommendations: string[]
  defenseLayers: string[]
}

interface DraftSections {
  findings: string
  impact: string
  recommendations: string
  defense: string
}

const REGION_LABELS: Record<string, string> = {
  'US-EAST': 'United States',
  'UK-LON': 'United Kingdom',
  'JP-TYO': 'Japan',
  'SG-SIN': 'Singapore',
  'BR-SAO': 'Brazil',
  'RU-MOW': 'Russia',
  'CN-PEK': 'China',
}

const SEVERITY_LABELS: Record<AttackReportIncident['sev'], string> = {
  CRITICAL: 'KRİTİK',
  HIGH: 'YÜKSEK',
  MEDIUM: 'ORTA',
  LOW: 'DÜŞÜK',
}

function getRegionLabel(region: string): string {
  return REGION_LABELS[region] ?? region
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function formatTimelineType(type: string): string {
  const labels: Record<string, string> = {
    OBSERVED: 'Gözlem',
    CORRELATED: 'Korelasyon',
    DETECTED: 'Tespit',
    ALERT_OPENED: 'Alarm Açıldı',
    INVESTIGATING: 'İnceleme Başladı',
    CONTAINED: 'İzolasyon Uygulandı',
    DISMISSED: 'Kapatıldı',
  }

  return labels[type] ?? type
}

function getAttackProfile(label: string): AttackProfile {
  const value = label.toLowerCase()

  if (value.includes('sql')) {
    return {
      title: 'SQL Enjeksiyonu',
      description:
        'Web uygulamasına yönelik enjeksiyon denemesi simüle edildi. Sorgu manipülasyonu, yetkisiz veri erişimi, veri sızdırma ve uygulama bütünlüğünün bozulması riskleri değerlendirilmelidir.',
      mitre: 'MITRE ATT&CK: T1190 - Exploit Public-Facing Application',
      tags: ['sqli', 'injection', 'database', 'web-attack'],
      investigationFocus: [
        'WAF ve uygulama loglarında tekrar eden payload desenleri ile hata üretmiş istekleri ayıkla.',
        'Veritabanı erişim kayıtlarında beklenmeyen sorgu hacmi, tablo keşfi veya dump işaretlerini doğrula.',
        'Kimlik doğrulama ve oturum akışında eş zamanlı anomali oluşup oluşmadığını kontrol et.',
      ],
      impactStatement:
        'veritabanı içeriğinin okunması, değiştirilmesi veya hassas uygulama fonksiyonlarının kötüye kullanılması',
      recommendations: [
        'Kaynak IP ve ilişkili oturumları geçici olarak sınırla; aynı payload kalıpları için WAF kural sıkılaştırması uygula.',
        'Etkilenen endpoint üzerinde parametreli sorgu kullanımı, input validation ve hata yakalama davranışını doğrula.',
        'Uygulama, veritabanı ve ters vekil loglarını tek zaman çizelgesinde birleştirerek kesin saldırı yolunu çıkar.',
        'Benzer input yüzeyleri için hızlı güvenlik taraması yapıp tekrar üretilebilir zafiyetleri kapat.',
      ],
      defenseLayers: [
        'WAF/IPS tarafında SQLi imzalarını aktif tut ve false negative örneklerini kural setine besle.',
        'Veritabanı kullanıcılarını en az ayrıcalık modeline indir; kritik tablolar için ek erişim denetimi uygula.',
        'Hata sayısı, sorgu anomalisi ve hassas tablo erişimi için SIEM korelasyonu tanımla.',
        'Yayın öncesi güvenlik testlerine dinamik uygulama testi ve payload regresyon kontrolleri ekle.',
      ],
    }
  }

  if (value.includes('ransom')) {
    return {
      title: 'Fidye Yazılımı',
      description:
        'Şifreleme veya yıkıcı etki üretmeye odaklanan bir zararlı yazılım zinciri simüle edildi. İlk erişim noktası, süreç ağacı, lateral movement izi ve kurtarma kapasitesi birlikte doğrulanmalıdır.',
      mitre: 'MITRE ATT&CK: T1486 - Data Encrypted for Impact',
      tags: ['ransomware', 'malware', 'impact', 'encryption'],
      investigationFocus: [
        'Etkilenen host üzerinde yeni süreçler, servis oluşturma ve dosya uzantısı değişim paternlerini incele.',
        'Kaynak IP ile ilişkili oturumları, kimlik bilgisi kullanımlarını ve paylaşımlı dizin erişimlerini gözden geçir.',
        'Aynı zaman aralığında başka düğümlerde benzer IoC veya hızlı dosya operasyonu sıçraması olup olmadığını doğrula.',
      ],
      impactStatement:
        'servis kesintisi, veri erişilemezliği, yedeklerden geri dönme ihtiyacı ve potansiyel iş sürekliliği kaybı',
      recommendations: [
        'Etkilenen düğümü ağdan ayır ve ilgili kimlik bilgileri için acil parola/oturum yenileme süreci başlat.',
        'Dosya değişim hacmi, süreç zinciri ve ağ bağlantılarını zaman çizelgesi bazında ilişkilendir.',
        'Yedeklerin erişilebilirliğini ve temiz geri dönüş noktasını doğrula; kurtarma öncesi IoC temizliği yap.',
        'Lateral movement şüphesi varsa bağlı sistemlerde hızlı IOC avı ve EDR taraması gerçekleştir.',
      ],
      defenseLayers: [
        'EDR üzerinde şifreleme davranışı, toplu dosya değişimi ve gölge kopya silme tetikleyicilerini aktif tut.',
        'Ayrıcalıklı hesapları segmentlere ayır ve yönetici erişimlerini just-in-time modele çek.',
        'Yedek sistemlerini ağdan ve kimlik bağlamından izole tut; düzenli geri yükleme tatbikatı yap.',
        'Office makroları, script yürütme ve SMB yayılımı için sıkı uygulama kontrol politikaları uygula.',
      ],
    }
  }

  if (value.includes('auth')) {
    return {
      title: 'Kimlik Doğrulama Atlama',
      description:
        'Kimlik doğrulama katmanının beklenen güvenlik kontrolünü atladığını düşündüren bir simülasyon kaydı oluştu. Yetki artışı ve geçerli hesap kötüye kullanımı olasılığı birlikte ele alınmalıdır.',
      mitre: 'MITRE ATT&CK: T1078 - Valid Accounts',
      tags: ['auth-bypass', 'identity', 'privilege', 'access-control'],
      investigationFocus: [
        'Başarısız ve başarılı giriş kayıtları arasındaki geçişleri, token üretimlerini ve session creation izlerini incele.',
        'Kaynak IP, kullanıcı ajanı ve coğrafi bağlam uyumsuzluklarını doğrula.',
        'Rol/izin değişiklikleri veya beklenmeyen admin fonksiyon çağrılarını olay zamanıyla eşleştir.',
      ],
      impactStatement:
        'yetkisiz erişim, ayrıcalık yükseltme ve bağlı sistemlerde daha geniş kapsamlı suistimal',
      recommendations: [
        'İlgili hesapları, tokenları ve oturumları iptal et; MFA ve conditional access kayıtlarını yeniden değerlendir.',
        'Erişim kontrol katmanında atlanan kuralı belirlemek için auth service ve reverse proxy loglarını çapraz oku.',
        'Aynı oturum anahtarlarıyla erişilmiş hassas işlemleri denetle ve gereken yerlerde geri al.',
        'Yetki matrisi, rol kalıtımı ve API korumalarını hızlı bir güvenlik incelemesinden geçir.',
      ],
      defenseLayers: [
        'MFA, device posture ve risk bazlı erişim politikalarını zorunlu hale getir.',
        'Kısa ömürlü token, IP/device binding ve session anomaly detection kontrollerini devreye al.',
        'Kimlik servisleri için denetim loglarını merkezi SIEM korelasyonu ile izlenebilir tut.',
        'Yetki kontrollerini regression test senaryolarına bağlayarak sessiz bozulmaları erken yakala.',
      ],
    }
  }

  if (value.includes('c2')) {
    return {
      title: 'Komuta ve Kontrol Trafiği',
      description:
        'Beaconing veya uzaktan komuta işaretleri veren düzenli haberleşme davranışı simüle edildi. Kalıcılık, veri çıkarma ve ikinci aşama komut yürütme ihtimali birlikte değerlendirilmelidir.',
      mitre: 'MITRE ATT&CK: T1071 - Application Layer Protocol',
      tags: ['c2', 'beaconing', 'persistence', 'network'],
      investigationFocus: [
        'Periyodik bağlantı aralıklarını, hedef protokolü ve aynı hedefe yapılan tekrar eden denemeleri incele.',
        'Etkilenen düğümde kalıcılık mekanizması, başlangıç girdisi ve şüpheli süreç ebeveynliğini doğrula.',
        'Bu iletişimin veri çıkışıyla veya ek yük indirme davranışıyla birleşip birleşmediğini kontrol et.',
      ],
      impactStatement:
        'uzaktan komut yürütme, kalıcılık sürdürme ve ikinci aşama saldırıların devreye alınması',
      recommendations: [
        'Şüpheli hedeflerle olan ağ iletişimini geçici olarak kes ve aynı IOC için çevresel av başlat.',
        'Host üzerinde zamanlanmış görevler, autorun girdileri ve yeni servis kayıtlarını doğrula.',
        'Ağ akış kayıtları ile EDR olaylarını birleştirip beaconing periyodunu ve komut penceresini çıkar.',
        'Şüpheli süreç ikililerini ve indirilen artefaktları sandbox/analiz kuyruğuna al.',
      ],
      defenseLayers: [
        'Egress filtreleme, DNS anomali tespiti ve yeni dış hedef uyarıları tanımla.',
        'EDR üzerinde persistence ve LOLBin kötüye kullanımı için davranış kuralları etkinleştir.',
        'Uzun süreli düşük hacimli trafik için ağ analitiği ve periyodiklik korelasyonu ekle.',
        'C2 IOC beslemelerini güvenlik duvarı, proxy ve SIEM katmanlarında ortak kullan.',
      ],
    }
  }

  if (value.includes('flood')) {
    return {
      title: 'Hizmet Engelleme Trafiği',
      description:
        'Hedef servisin kapasitesini zorlayan yoğun trafik paterni simüle edildi. Uygulama yanıt süreleri, upstream koruma kapasitesi ve dar boğaz noktaları birlikte gözden geçirilmelidir.',
      mitre: 'MITRE ATT&CK: T1498 - Network Denial of Service',
      tags: ['ddos', 'network', 'availability', 'flood'],
      investigationFocus: [
        'Kaynak dağılımını, paket/istek yoğunluğunu ve spike zamanlarını netleştir.',
        'Hedef serviste CPU, bağlantı havuzu, rate limit ve upstream bant kullanımı etkisini doğrula.',
        'Saldırı trafiğinin uygulama katmanı mı yoksa ağ katmanı mı baskın olduğunu sınıflandır.',
      ],
      impactStatement:
        'servis sürekliliğinin bozulması, kullanıcı deneyiminde düşüş ve savunma katmanlarının doygunluğa ulaşması',
      recommendations: [
        'Geçici rate limiting, kaynak IP gruplama ve upstream koruma politikalarını devreye al.',
        'Yük dengeleyici, WAF ve ağ geçidi istatistiklerini aynı zaman penceresinde toplayarak darboğazı belirle.',
        'Sağlık kontrolleri ve otomatik ölçekleme eşiklerini gözden geçir; gerekirse savunma profili yükselt.',
        'Trafik imzası netleştiğinde kalıcı blok/şekillendirme kurallarını değişiklik kaydıyla uygula.',
      ],
      defenseLayers: [
        'Anycast/CDN, upstream scrubbing ve bağlantı sınırlandırma stratejilerini hazır tut.',
        'WAF, API gateway ve reverse proxy üzerinde ayrı rate-limit profilleri tanımla.',
        'Ağ cihazlarında SYN protection, connection tracking ve burst alarm eşikleri oluştur.',
        'Kapasite testlerini düzenli yaparak kritik servislerin tolerans seviyesini görünür tut.',
      ],
    }
  }

  if (value.includes('exfil')) {
    return {
      title: 'Veri Sızdırma Girişimi',
      description:
        'Hassas verinin dışarı taşınmasına işaret eden bir simülasyon kaydı üretildi. Veri sınıflandırması, çıkış kanalı ve erişim bağlamı birlikte incelenmelidir.',
      mitre: 'MITRE ATT&CK: T1041 - Exfiltration Over C2 Channel',
      tags: ['exfiltration', 'data-loss', 'dlp', 'sensitive-data'],
      investigationFocus: [
        'Veri çıkış hacmini, hedef yönünü ve transferin hangi kullanıcı/süreç bağlamından yapıldığını doğrula.',
        'DLP, proxy ve endpoint loglarını karşılaştırarak hangi veri tipinin etkilenmiş olabileceğini sınırla.',
        'Transfer öncesinde yetkisiz erişim veya staging davranışı olup olmadığını zaman çizelgesinde ara.',
      ],
      impactStatement:
        'hassas veri kaybı, mevzuat etkisi, müşteri güveni kaybı ve ek ihlal bildirim süreçleri',
      recommendations: [
        'Şüpheli çıkış kanalını sınırlayıp aynı hedefe yönelen benzer trafiği çevresel olarak tara.',
        'Etkilenen veri kümesini sınıflandır ve hangi kullanıcı/servis hesabının erişim yaptığını netleştir.',
        'DLP, proxy ve uygulama logları arasında dosya/nesne düzeyinde eşleştirme yap.',
        'Eğer erişim kötüye kullanımı teyit edilirse ilgili kimlik bilgilerini döndür ve olay kapsamını genişlet.',
      ],
      defenseLayers: [
        'DLP kurallarını veri etiketi, dosya türü ve hedef kategori bazında sıkılaştır.',
        'Egress filtreleme ve anormal veri transfer hacmi için davranış temelli uyarılar tanımla.',
        'Hassas veri depolarında erişim gözden geçirme ve just-in-time erişim modeli uygula.',
        'Proxy, CASB ve endpoint telemetrisini ortak vaka görünümünde birleştir.',
      ],
    }
  }

  return {
    title: label,
    description:
      'Bu simüle olay, tehdit zincirinin erken aşamalarını görünür kılmak için oluşturulmuş genel bir saldırı kaydıdır. Saldırı vektörü, etkilenen varlık ve telemetri korelasyonu birlikte değerlendirilmelidir.',
    mitre: 'MITRE ATT&CK: Ayrıntılı teknik sınıflandırma analist doğrulaması gerektirir',
    tags: ['security-incident', 'simulation', 'triage'],
    investigationFocus: [
      'İlk tespit anındaki log, alarm ve ağ akış kayıtlarını aynı zaman penceresinde topla.',
      'Kaynak IP, hedef düğüm ve ilişkili kullanıcı/oturum izlerini bağlamsal olarak doğrula.',
      'Ek IOC, lateral movement veya tekrarlayan davranış olup olmadığını çevresel olarak tara.',
    ],
    impactStatement:
      'iş sürekliliği, veri gizliliği ve erişim güvenliği açısından zincirleme etki yaratabilecek bir güvenlik olayı',
    recommendations: [
      'Olay kapsamını doğrulamak için host, ağ ve uygulama loglarını tek vaka zaman çizelgesinde birleştir.',
      'Kaynak IP ve ilişkili oturumlar için geçici koruma/izleme kararı al.',
      'Etkilenen varlık üzerinde hızlı IOC taraması yap ve gerektiğinde izolasyon planını hazırla.',
      'Bulgular netleştikçe vaka notlarını Zafiyet Taraması tarafında rapor kaydıyla eşleştir.',
    ],
    defenseLayers: [
      'Merkezi SIEM korelasyonlarını olay türüne uygun yeni davranış göstergeleriyle besle.',
      'Host ve ağ telemetrisini aynı vaka bağlamında görünür kılacak gösterge panelleri oluştur.',
      'Kimlik, ağ ve uygulama katmanlarında en az ayrıcalık ve segmentasyon kontrollerini gözden geçir.',
      'Tatbikat senaryolarını gerçek telemetri örnekleriyle besleyerek analist hazırlığını artır.',
    ],
  }
}

function deriveTags(incident: AttackReportIncident, profile: AttackProfile): string[] {
  const tags = new Set<string>([
    ...profile.tags,
    'simulation',
    'incident-report',
    toSlug(incident.sev),
    toSlug(incident.region),
    toSlug(incident.node),
  ])

  const labelTag = toSlug(incident.label)
  const sourceTag = toSlug(incident.source)

  if (labelTag) tags.add(labelTag)
  if (sourceTag) tags.add(sourceTag)

  return Array.from(tags)
}

function buildDraftSections(incident: AttackReportIncident, profile: AttackProfile): DraftSections {
  const regionLabel = getRegionLabel(incident.region)
  const detectedAt = new Date(incident.time).toLocaleString('tr-TR')
  const timelineSnippet = incident.timeline?.length
    ? incident.timeline
        .slice(-3)
        .map((entry) => `${new Date(entry.time).toLocaleTimeString('tr-TR')} - ${formatTimelineType(entry.type)}: ${entry.desc}`)
        .join('\n')
    : 'Zaman çizelgesi sınırlı. Bu nedenle host, ağ ve uygulama loglarının birlikte doğrulanması önerilir.'

  return {
    findings: [
      'Bu içerik, laboratuvar amaçlı simüle edilen olay için otomatik hazırlanmış başlangıç raporudur.',
      `${detectedAt} tarihinde ${regionLabel} bölgesindeki ${incident.node} varlığında "${incident.label}" alarmı üretildi. Kaynak gösterge ${incident.source} olarak işlendi.`,
      `İlk analiz odağı: ${profile.investigationFocus.join(' ')}`,
      'Son zaman çizelgesi özeti:',
      timelineSnippet,
    ].join('\n\n'),
    impact: [
      `Bu senaryo simüle olsa da gerçek bir ortamda ${profile.impactStatement} riskini doğurabilir.`,
      `${incident.node} üzerinde çalışan servisler, bağlı veri akışı ve ${regionLabel} bölgesine ait operasyonel görünürlük bu olaydan etkilenebilecek öncelikli alanlardır.`,
      'Öncelikli doğrulama başlıkları; kapsamın tek varlıkla sınırlı olup olmadığı, ek IOC yayılımı, yetkisiz erişim izi ve olası iş etkisinin genişleme hızıdır.',
    ].join('\n\n'),
    recommendations: profile.recommendations
      .map((step, index) => `${index + 1}. ${step}`)
      .concat('5. Rapor kesinleştiğinde Zafiyet Taraması tarafında ilgili kayıtla ilişkilendir ve sonraki araştırma adımlarını aynı vaka altında topla.')
      .join('\n'),
    defense: profile.defenseLayers
      .map((step, index) => `${index + 1}. ${step}`)
      .join('\n'),
  }
}

export default function AttackReportModal({ incident, open, onClose }: AttackReportModalProps) {
  const [title, setTitle] = useState('')
  const [severity, setSeverity] = useState<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'>('CRITICAL')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [findings, setFindings] = useState('')
  const [impact, setImpact] = useState('')
  const [recommendations, setRecommendations] = useState('')
  const [defense, setDefense] = useState('')
  const [explanation, setExplanation] = useState<AttackProfile | null>(null)

  useEffect(() => {
    if (!incident || !open) return

    const profile = getAttackProfile(incident.label)
    const draft = buildDraftSections(incident, profile)

    setTitle(`[SİMÜLE] ${profile.title} - ${getRegionLabel(incident.region)} - ${incident.source}`)
    setSeverity(incident.sev)
    setTags(deriveTags(incident, profile))
    setTagInput('')
    setStatus('idle')
    setErrorMsg('')
    setFindings(draft.findings)
    setImpact(draft.impact)
    setRecommendations(draft.recommendations)
    setDefense(draft.defense)
    setExplanation(profile)
  }, [incident, open])

  const addTag = () => {
    const next = toSlug(tagInput.trim())
    if (next && !tags.includes(next)) setTags((prev) => [...prev, next])
    setTagInput('')
  }

  const removeTag = (value: string) => {
    setTags((prev) => prev.filter((item) => item !== value))
  }

  const buildContent = () => [
    '## Olay Özeti',
    '',
    `**Çalışma Modu:** Simüle / laboratuvar olayı`,
    `**Olay ID:** ${incident?.id ?? ''}`,
    `**Saldırı Tipi:** ${incident?.label ?? ''}`,
    `**Önem Seviyesi:** ${SEVERITY_LABELS[severity]}`,
    `**Kaynak IP:** ${incident?.source ?? ''}`,
    `**Hedef Düğüm:** ${incident?.node ?? ''}`,
    `**Bölge:** ${incident ? getRegionLabel(incident.region) : ''}`,
    `**Tespit Zamanı:** ${incident ? new Date(incident.time).toLocaleString('tr-TR') : ''}`,
    '',
    '### Saldırı Bağlamı',
    explanation?.description ?? '',
    '',
    `_${explanation?.mitre ?? ''}_`,
    '',
    '## Bulgular',
    findings || '[Analist notu bekleniyor]',
    '',
    '## Etki Değerlendirmesi',
    impact || '[Analist notu bekleniyor]',
    '',
    '## Öneriler',
    recommendations || '[Analist notu bekleniyor]',
    '',
    '## Savunma Hattı',
    defense || '[Analist notu bekleniyor]',
    '',
    '## Zaman Çizelgesi',
    incident?.timeline?.length
      ? incident.timeline
          .map((entry) => `- ${new Date(entry.time).toLocaleTimeString('tr-TR')} [${formatTimelineType(entry.type)}] ${entry.desc}`)
          .join('\n')
      : '- Kullanılabilir zaman çizelgesi kaydı yok.',
  ].join('\n')

  const handleSubmit = async () => {
    if (!incident || !title.trim()) {
      setErrorMsg('Rapor başlığı zorunludur.')
      setStatus('error')
      return
    }

    setStatus('loading')
    setErrorMsg('')

    try {
      const content = buildContent()
      const response = await fetch('/api/reports', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, severity, tags }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string
          source?: string
        }
        if (response.status === 401) {
          throw new Error('Oturumunuz sonlandırılmış olabilir. Giriş ekranından tekrar oturum açın.')
        }
        throw new Error(payload.error ?? `HTTP ${response.status}`)
      }

      dispatchReportsUpdatedEvent()
      setStatus('success')
      setTimeout(() => {
        onClose()
        setStatus('idle')
      }, 2400)
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Bilinmeyen hata.')
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
      className="fixed inset-0 z-[60] flex items-end justify-center p-2 sm:items-center sm:p-4"
      style={{ background: 'rgba(6,0,15,0.85)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="flex max-h-[96dvh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border font-mono sm:max-h-[92vh] sm:rounded-lg"
        style={{
          background: 'rgb(var(--route-surface-0-rgb))',
          borderColor: 'rgb(var(--route-accent-rgb) / 0.3)',
          boxShadow: '0 0 60px rgb(var(--route-accent-rgb) / 0.12)',
          maxHeight: 'min(96dvh, 92vh)',
        }}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-route-accent/20 px-3 py-3 sm:items-center sm:px-5">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <FileText className="w-4 h-4 text-route-accent" />
            <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-route-accent sm:text-xs">
              Saldırı İnceleme Raporu
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
                {SEVERITY_LABELS[severity]}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="shrink-0 text-slate-500 transition-colors hover:text-slate-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        {status === 'success' ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-10 sm:px-8 sm:py-12">
            <CheckCircle className="w-12 h-12 text-green-400" />
            <p className="text-green-400 font-bold text-lg">Rapor oluşturuldu!</p>
            <p className="text-slate-500 text-sm text-center">Rapor başarıyla kaydedildi.</p>
            <Link
              href="/zafiyet-taramasi"
              className="text-route-accent text-xs underline underline-offset-2 hover:text-route-accent/80"
            >
              Zafiyet Taramasında görüntüle
            </Link>
          </div>
        ) : (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3 sm:p-5">
            {explanation && (
              <div
                className="space-y-2 rounded border p-3 sm:p-4"
                style={{ background: 'rgb(var(--route-accent-rgb) / 0.04)', borderColor: 'rgb(var(--route-accent-rgb) / 0.2)' }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="w-3.5 h-3.5 text-route-accent" />
                  <span className="text-[10px] text-route-accent font-bold tracking-widest uppercase">
                    {explanation.title}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{explanation.description}</p>
                <p className="text-[10px] text-slate-600 italic">{explanation.mitre}</p>
                <div className="grid grid-cols-1 gap-x-4 gap-y-0.5 pt-1 text-[10px] text-slate-500 sm:grid-cols-2">
                  <span><span className="text-slate-600">IP:</span> {incident.source}</span>
                  <span><span className="text-slate-600">BÖLGE:</span> {getRegionLabel(incident.region)}</span>
                  <span><span className="text-slate-600">DÜĞÜM:</span> {incident.node}</span>
                  <span><span className="text-slate-600">ZAMAN:</span> {new Date(incident.time).toLocaleString('tr-TR')}</span>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[9px] text-slate-500 tracking-widest uppercase">Rapor Başlığı</label>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full bg-[rgb(var(--route-bg-rgb))] border border-route-accent/25 rounded px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-route-accent/60 transition-colors"
                placeholder="Rapor başlığı..."
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="w-full shrink-0 space-y-1.5 sm:w-36">
                <label className="text-[9px] text-slate-500 tracking-widest uppercase">Önem</label>
                <select
                  value={severity}
                  onChange={(event) => setSeverity(event.target.value as typeof severity)}
                  className="w-full bg-[rgb(var(--route-bg-rgb))] border border-route-accent/25 rounded px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-route-accent/60"
                >
                  <option value="CRITICAL">KRİTİK</option>
                  <option value="HIGH">YÜKSEK</option>
                  <option value="MEDIUM">ORTA</option>
                  <option value="LOW">DÜŞÜK</option>
                </select>
              </div>
              <div className="flex-1 space-y-1.5">
                <label className="text-[9px] text-slate-500 tracking-widest uppercase">Etiketler</label>
                <div className="flex flex-wrap gap-1.5 min-h-[38px] bg-[rgb(var(--route-bg-rgb))] border border-route-accent/25 rounded px-2 py-1.5 items-center focus-within:border-route-accent/60 transition-colors">
                  {tags.map((tag) => (
                    <span key={tag} className="flex items-center gap-1 bg-route-accent/20 border border-route-accent/35 px-1.5 py-0.5 rounded text-[10px] text-route-accent">
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
                    placeholder="etiket ekle..."
                  />
                </div>
              </div>
            </div>

            {([
              {
                label: 'Bulgular',
                value: findings,
                setValue: setFindings,
                placeholder: 'Gözlemlenen saldırı yolu, IOC değerleri, şüpheli varlıklar ve telemetri bulguları...',
              },
              {
                label: 'Etki Değerlendirmesi',
                value: impact,
                setValue: setImpact,
                placeholder: 'Muhtemel etki alanı, etkilenen sistemler ve iş etkisi...',
              },
              {
                label: 'Öneriler',
                value: recommendations,
                setValue: setRecommendations,
                placeholder: '1. Kaynağı engelle\n2. Düğümü izle\n3. Logları incele\n4. Açığı kapat...',
              },
              {
                label: 'Savunma Hattı',
                value: defense,
                setValue: setDefense,
                placeholder: 'Güvenlik duvarı kuralları, SIEM korelasyonu, IDS imzaları ve hardening aksiyonları...',
              },
            ] as const).map(({ label, value, setValue, placeholder }) => (
              <div key={label} className="space-y-1.5">
                <label className="text-[9px] text-slate-500 tracking-widest uppercase">{label}</label>
                <textarea
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  rows={3}
                  className="w-full bg-[rgb(var(--route-bg-rgb))] border border-route-accent/25 rounded px-3 py-2 text-sm text-slate-300 font-mono resize-none focus:outline-none focus:border-route-accent/60 transition-colors leading-relaxed"
                  placeholder={placeholder}
                />
              </div>
            ))}

            {status === 'error' && errorMsg && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span className="text-red-400 text-xs">{errorMsg}</span>
              </div>
            )}
          </div>
        )}

        {status !== 'success' && (
          <div className="shrink-0 border-t border-route-accent/15 px-3 py-3 sm:px-5">
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                onClick={onClose}
                className="min-h-[42px] rounded-lg border border-route-accent/20 px-3 text-xs text-slate-400 transition-colors hover:text-slate-200 sm:min-h-0 sm:border-0 sm:px-0"
              >
                İptal
              </button>
              <button
                onClick={handleSubmit}
                disabled={status === 'loading'}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-50 sm:min-h-0 sm:w-auto sm:px-5"
                style={{ background: 'rgb(var(--route-accent-rgb) / 0.2)', border: '1px solid rgb(var(--route-accent-rgb) / 0.45)', color: 'rgb(var(--route-accent-rgb))' }}
              >
                {status === 'loading'
                  ? <><span className="h-3.5 w-3.5 animate-spin rounded-full border border-route-accent border-t-transparent" /> Kaydediliyor...</>
                  : <><Send className="w-3.5 h-3.5" /> Raporu Kaydet</>
                }
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


