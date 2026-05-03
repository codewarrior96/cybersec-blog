'use client'

import { useState } from 'react'
import DeleteAccountModal from './DeleteAccountModal'

/**
 * F-002: account permanent-delete entry point. Rendered at the bottom
 * of /portfolio for authenticated users only. Visually segregated
 * with rose accents to flag the destructive intent before the user
 * even opens the modal. Modal handles confirmation + submit.
 */
export default function DangerZone() {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <>
      <section
        className="mt-12 rounded-2xl border border-rose-500/30 bg-rose-950/10 p-6"
        aria-labelledby="danger-zone-heading"
      >
        <div className="flex items-start gap-3">
          <span className="text-2xl text-rose-400" aria-hidden="true">⚠</span>
          <div className="flex-1">
            <h2
              id="danger-zone-heading"
              className="font-mono text-sm font-bold uppercase tracking-[0.3em] text-rose-300"
            >
              Tehlike Bölgesi
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Bu işlemler geri alınamaz. Hesabınızı silerseniz tüm verileriniz
              (profil bilgileri, sertifikalar, eğitimler, raporlar) kalıcı
              olarak silinecek.
            </p>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="mt-5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.25em] text-rose-200 transition hover:border-rose-400/60 hover:bg-rose-500/20"
            >
              Hesabı Kalıcı Olarak Sil
            </button>
          </div>
        </div>
      </section>

      {modalOpen && <DeleteAccountModal onClose={() => setModalOpen(false)} />}
    </>
  )
}
