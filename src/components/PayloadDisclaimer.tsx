// Phase 1.5.13 — post-level disclaimer banner inserted at the top of any
// blog post that ships payload-bearing `<EncodedCodeBlock>` examples.
//
// SENIOR ARCHITECT NOTE: server-compatible (no `'use client'`). Pure
// presentational markup, no interactivity, no hooks. Lives in the MDX
// component map alongside EncodedCodeBlock so posts can use `<PayloadDisclaimer />`
// directly after their frontmatter.

export default function PayloadDisclaimer() {
  return (
    <div className="my-8 rounded-lg border border-amber-500/30 bg-amber-500/[0.04] p-4 md:p-5">
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none mt-0.5" aria-hidden>
          🛡️
        </span>
        <div className="flex-1">
          <div className="font-semibold text-amber-300 mb-1.5 text-sm md:text-base">
            Eğitim İçeriği Uyarısı
          </div>
          <p className="text-slate-300 text-sm leading-relaxed">
            Bu yazı defansif araştırma amaçlı saldırı pattern örnekleri içerir.
            Aşağıdaki kod blokları antivirüs yazılımlarının yanlış pozitif
            tetiklemesini önlemek için base64 ile encode edilmiştir; tarayıcınızda
            otomatik olarak decode olur. Bu içerikler{' '}
            <strong className="text-amber-300/90">
              yalnızca yetkilendirilmiş test ortamlarında
            </strong>{' '}
            ve{' '}
            <strong className="text-amber-300/90">eğitim amacıyla</strong>{' '}
            kullanılmalıdır.
          </p>
        </div>
      </div>
    </div>
  )
}
