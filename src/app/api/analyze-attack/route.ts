import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface AttackBody {
  sourceIP?: string
  sourceCountry?: string
  type?: string
  targetPort?: number
  severity?: string
  time?: string
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as AttackBody

  const { sourceIP = '?', sourceCountry = '?', type = '?', targetPort = 0, severity = '?', time = '?' } = body

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const prompt = `Sen kıdemli bir SOC (Güvenlik Operasyon Merkezi) analistisin. Aşağıdaki siber saldırı olayını Türkçe olarak analiz et ve profesyonel bir olay müdahale raporu yaz.

**OLAY BİLGİLERİ:**
- Kaynak IP: ${sourceIP}
- Kaynak Ülke: ${sourceCountry}
- Saldırı Tipi: ${type}
- Hedef Port: ${targetPort}
- Önem Seviyesi: ${severity.toUpperCase()}
- Tespit Zamanı: ${time}

Aşağıdaki yapıda bir rapor oluştur (Markdown formatında):

## Saldırı Özeti

**Kaynak IP:** ${sourceIP}
**Kaynak Ülke:** ${sourceCountry}
**Saldırı Tipi:** ${type}
**Hedef Port:** ${targetPort}
**Önem Seviyesi:** ${severity.toUpperCase()}
**Zaman:** ${time}

## Bulgular

[Bu saldırı tipine özgü teknik bulgular, saldırı vektörü, kullanılan teknikler ve IoC (Gösterge) bilgileri. MITRE ATT&CK framework referansları ekle.]

## Etki Değerlendirmesi

[Bu saldırının potansiyel etkisi, hedef alınan servislerin kritikliği, veri ihlali riski, iş sürekliliği etkisi ve risk skoru.]

## Öneriler

[Acil alınması gereken aksiyonlar numaralı liste olarak. IP engelleme, port kapatma, yama, log inceleme gibi spesifik adımlar.]

## Savunma Hattı

[Uzun vadeli savunma stratejisi: güvenlik duvarı kuralları, IDS/IPS imzaları, SIEM korelasyon kuralları, awareness ve hardening önerileri.]

Raporu tamamen Türkçe yaz. Teknik terimleri olduğu gibi bırak (SQLi, XSS, RCE vb). Gerçekçi, uygulanabilir ve özlü ol.`

  const stream = await client.messages.stream({
    model: 'claude-opus-4-6',
    max_tokens: 1500,
    thinking: { type: 'adaptive' },
    messages: [{ role: 'user', content: prompt }],
  })

  const readable = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      for await (const chunk of stream) {
        if (
          chunk.type === 'content_block_delta' &&
          chunk.delta.type === 'text_delta'
        ) {
          controller.enqueue(enc.encode(chunk.delta.text))
        }
      }
      controller.close()
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
    },
  })
}
