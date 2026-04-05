'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { getAuthSession } from '@/lib/auth-client'
import type {
  PortfolioCertificationRecord,
  PortfolioEducationRecord,
  PortfolioProfileRecord,
} from '@/lib/portfolio-profile'

type TabId = 'profile' | 'certifications' | 'education'

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'profile', label: 'PROFIL' },
  { id: 'certifications', label: 'SERTIFIKALAR' },
  { id: 'education', label: 'EGITIMLER' },
]

const emptyCert = {
  title: '',
  issuer: '',
  issueDate: '',
  expiryDate: '',
  credentialId: '',
  verifyUrl: '',
  status: 'active' as PortfolioCertificationRecord['status'],
  notes: '',
  sortOrder: 0,
}

const emptyEdu = {
  institution: '',
  program: '',
  degree: '',
  startDate: '',
  endDate: '',
  status: 'active' as PortfolioEducationRecord['status'],
  description: '',
  sortOrder: 0,
}

const fieldClass =
  'w-full rounded-2xl border border-white/10 bg-[#050807] px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-emerald-300/50'

function listToText(value: string[]) {
  return value.join('\n')
}

function textToList(value: string) {
  return value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean)
}

async function readError(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => ({}))) as { error?: string }
  return payload.error ?? fallback
}

function normalizeWebsiteUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function buildAvatarSrc(userId: number, username: string, avatarPath: string | null | undefined) {
  if (avatarPath) {
    return `/api/profile/avatar/${userId}?v=${encodeURIComponent(avatarPath)}`
  }
  if (username === 'ghost') {
    return '/skull.jpg'
  }
  return ''
}

function getInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'OP'
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('')
}

function CertificationPreview({ item }: { item: PortfolioCertificationRecord }) {
  const url = item.assetPath ? `/api/profile/certifications/assets/${item.id}` : ''
  if (item.assetPath && item.assetMimeType?.startsWith('image/')) {
    return <img src={url} alt={item.title} className="h-full w-full object-cover" />
  }
  if (item.assetPath && item.assetMimeType === 'application/pdf') {
    return <iframe src={`${url}#toolbar=0&navpanes=0&scrollbar=0`} title={item.title} className="h-full w-full border-0 bg-black" />
  }
  return (
    <div className="flex h-full w-full flex-col justify-between rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,#f7f4ee,#ece7de)] p-5 text-slate-900">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-slate-500">Certificate Preview</p>
        <h3 className="mt-6 text-xl font-semibold">{item.title}</h3>
        <p className="mt-2 text-sm text-slate-600">{item.issuer}</p>
      </div>
      <p className="rounded-2xl border border-slate-900/10 bg-white/60 p-3 text-sm text-slate-700">
        Belge yuklendiginde gercek sertifika burada gorunur.
      </p>
    </div>
  )
}

export default function PortfolioWorkspace({
  initialProfile,
  initialTab = 'profile',
  editable,
}: {
  initialProfile: PortfolioProfileRecord
  initialTab?: TabId
  editable: boolean
}) {
  const [tab, setTab] = useState<TabId>(initialTab)
  const [data, setData] = useState(initialProfile)
  const [canEdit, setCanEdit] = useState(editable)
  const [authSyncing, setAuthSyncing] = useState(!editable)
  const [profileForm, setProfileForm] = useState({
    headline: initialProfile.profile.headline,
    bio: initialProfile.profile.bio,
    location: initialProfile.profile.location,
    website: initialProfile.profile.website,
    specialties: listToText(initialProfile.profile.specialties),
    tools: listToText(initialProfile.profile.tools),
  })
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [certId, setCertId] = useState<number | 'new'>(initialProfile.certifications[0]?.id ?? 'new')
  const [eduId, setEduId] = useState<number | 'new'>(initialProfile.education[0]?.id ?? 'new')
  const [certForm, setCertForm] = useState(emptyCert)
  const [eduForm, setEduForm] = useState(emptyEdu)
  const [certFile, setCertFile] = useState<File | null>(null)
  const [removeCertAsset, setRemoveCertAsset] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [certComposerMode, setCertComposerMode] = useState<'create' | 'edit' | null>(null)
  const [lastSelectedCertId, setLastSelectedCertId] = useState<number | null>(
    initialProfile.certifications[0]?.id ?? null,
  )
  const avatarFileRef = useRef<HTMLInputElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const selectedCert = useMemo(
    () => (typeof certId === 'number' ? data.certifications.find((item) => item.id === certId) ?? null : null),
    [certId, data.certifications],
  )
  const selectedEdu = useMemo(
    () => (typeof eduId === 'number' ? data.education.find((item) => item.id === eduId) ?? null : null),
    [data.education, eduId],
  )
  const avatarSrc = useMemo(
    () => buildAvatarSrc(data.user.id, data.user.username, data.profile.avatarPath),
    [data.profile.avatarPath, data.user.id, data.user.username],
  )
  const websiteUrl = useMemo(() => normalizeWebsiteUrl(profileForm.website), [profileForm.website])
  const isCertComposerOpen = certComposerMode !== null
  const featuredCert = useMemo(
    () =>
      selectedCert ??
      (lastSelectedCertId != null
        ? data.certifications.find((item) => item.id === lastSelectedCertId) ?? null
        : null) ??
      data.certifications[0] ??
      null,
    [data.certifications, lastSelectedCertId, selectedCert],
  )
  const certificationShowcase = useMemo(
    () =>
      featuredCert
        ? [featuredCert, ...data.certifications.filter((item) => item.id !== featuredCert.id).slice(0, 2)]
        : data.certifications.slice(0, 3),
    [data.certifications, featuredCert],
  )

  useEffect(() => setData(initialProfile), [initialProfile])
  useEffect(() => {
    setCanEdit(editable)
    setAuthSyncing(!editable)
  }, [editable])

  useEffect(() => {
    setProfileForm({
      headline: data.profile.headline,
      bio: data.profile.bio,
      location: data.profile.location,
      website: data.profile.website,
      specialties: listToText(data.profile.specialties),
      tools: listToText(data.profile.tools),
    })
  }, [data.profile])

  useEffect(() => {
    setError(null)
    setMessage(null)
  }, [tab])

  useEffect(() => {
    if (typeof certId === 'number') {
      setLastSelectedCertId(certId)
      return
    }

    if (!isCertComposerOpen && data.certifications[0]?.id) {
      const fallbackId =
        (lastSelectedCertId != null &&
        data.certifications.some((item) => item.id === lastSelectedCertId)
          ? lastSelectedCertId
          : data.certifications[0]?.id) ?? null
      if (fallbackId != null) {
        setCertId(fallbackId)
        setLastSelectedCertId(fallbackId)
      }
    }
  }, [certId, data.certifications, isCertComposerOpen, lastSelectedCertId])

  useEffect(() => {
    let active = true

    const syncEditableMode = async () => {
      if (editable) {
        try {
          const response = await fetch('/api/profile/me', {
            method: 'GET',
            credentials: 'include',
            cache: 'no-store',
          })

          if (!active) return

          if (response.ok) {
            const payload = (await response.json()) as { profile: PortfolioProfileRecord }
            setData(payload.profile)
          }
        } catch {
          // Keep the server-rendered profile as a safe fallback.
        } finally {
          if (active) {
            setCanEdit(true)
            setAuthSyncing(false)
          }
        }
        return
      }

      try {
        const session = await getAuthSession(false)
        if (!active) return
        if (!session.authenticated) {
          setAuthSyncing(false)
          return
        }

        const response = await fetch('/api/profile/me', {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        })

        if (!active) return
        if (!response.ok) {
          setAuthSyncing(false)
          return
        }

        const payload = (await response.json()) as { profile: PortfolioProfileRecord }
        setData(payload.profile)
        setCanEdit(true)
      } catch {
        if (active) {
          setCanEdit(false)
        }
      } finally {
        if (active) {
          setAuthSyncing(false)
        }
      }
    }

    void syncEditableMode()
    return () => {
      active = false
    }
  }, [editable])

  useEffect(() => {
    if (certId === 'new') return setCertForm({ ...emptyCert, sortOrder: data.certifications.length })
    if (selectedCert) {
      setCertForm({
        title: selectedCert.title,
        issuer: selectedCert.issuer,
        issueDate: selectedCert.issueDate,
        expiryDate: selectedCert.expiryDate,
        credentialId: selectedCert.credentialId,
        verifyUrl: selectedCert.verifyUrl,
        status: selectedCert.status,
        notes: selectedCert.notes,
        sortOrder: selectedCert.sortOrder,
      })
    }
  }, [certId, data.certifications, selectedCert])

  useEffect(() => {
    if (eduId === 'new') return setEduForm({ ...emptyEdu, sortOrder: data.education.length })
    if (selectedEdu) {
      setEduForm({
        institution: selectedEdu.institution,
        program: selectedEdu.program,
        degree: selectedEdu.degree,
        startDate: selectedEdu.startDate,
        endDate: selectedEdu.endDate,
        status: selectedEdu.status,
        description: selectedEdu.description,
        sortOrder: selectedEdu.sortOrder,
      })
    }
  }, [data.education.length, eduId, selectedEdu])

  async function saveProfile() {
    if (!canEdit || saving) return
    setSaving(true); setError(null); setMessage(null)
    try {
      const response = await fetch('/api/profile/me', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...profileForm,
          specialties: textToList(profileForm.specialties),
          tools: textToList(profileForm.tools),
        }),
      })
      if (!response.ok) return setError(await readError(response, 'Profil kaydedilemedi.'))
      const payload = (await response.json()) as { profile: PortfolioProfileRecord }
      setData((current) => ({
        ...payload.profile,
        profile: {
          ...payload.profile.profile,
          avatarPath: payload.profile.profile.avatarPath ?? current.profile.avatarPath ?? null,
          avatarName: payload.profile.profile.avatarName ?? current.profile.avatarName ?? null,
          avatarMimeType:
            payload.profile.profile.avatarMimeType ?? current.profile.avatarMimeType ?? null,
        },
      }))
      setMessage('Profil guncellendi.')
    } finally { setSaving(false) }
  }

  async function uploadAvatar(file: File | null) {
    if (!canEdit || !file || avatarUploading) return

    setAvatarUploading(true)
    setError(null)
    setMessage(null)

    try {
      const formData = new FormData()
      formData.set('avatar', file)
      const response = await fetch('/api/profile/avatar', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      if (!response.ok) {
        setError(await readError(response, 'Profil fotografisi yuklenemedi.'))
        return
      }

      const payload = (await response.json()) as { profile: PortfolioProfileRecord }
      setData(payload.profile)
      setMessage('Profil fotografisi guncellendi.')
    } finally {
      setAvatarUploading(false)
      if (avatarFileRef.current) {
        avatarFileRef.current.value = ''
      }
    }
  }

  async function removeAvatar() {
    if (!canEdit || avatarUploading || !data.profile.avatarPath) return

    setAvatarUploading(true)
    setError(null)
    setMessage(null)

    try {
      const response = await fetch('/api/profile/avatar', {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        setError(await readError(response, 'Profil fotografisi kaldirilamadi.'))
        return
      }

      const payload = (await response.json()) as { profile: PortfolioProfileRecord }
      setData(payload.profile)
      setMessage('Profil fotografisi kaldirildi.')
    } finally {
      setAvatarUploading(false)
      if (avatarFileRef.current) {
        avatarFileRef.current.value = ''
      }
    }
  }

  async function saveCertification() {
    if (!canEdit || saving) return
    setSaving(true); setError(null); setMessage(null)
    try {
      const formData = new FormData()
      Object.entries(certForm).forEach(([key, value]) => formData.set(key, String(value ?? '')))
      if (certFile) formData.set('asset', certFile)
      if (removeCertAsset) formData.set('removeAsset', 'true')
      const isNew = certComposerMode === 'create' || certId === 'new'
      const response = await fetch(isNew ? '/api/profile/certifications' : `/api/profile/certifications/${certId}`, {
        method: isNew ? 'POST' : 'PATCH',
        credentials: 'include',
        body: formData,
      })
      if (!response.ok) return setError(await readError(response, 'Sertifika kaydedilemedi.'))
      const payload = (await response.json()) as { certification: PortfolioCertificationRecord }
      setData((current) => ({
        ...current,
        certifications: (isNew ? [payload.certification, ...current.certifications] : current.certifications.map((item) => item.id === payload.certification.id ? payload.certification : item)).sort((a, b) => a.sortOrder - b.sortOrder || b.id - a.id),
      }))
      setCertId(payload.certification.id); setLastSelectedCertId(payload.certification.id); setCertFile(null); setRemoveCertAsset(false); setCertComposerMode(null); setMessage(isNew ? 'Sertifika eklendi.' : 'Sertifika guncellendi.')
      if (fileRef.current) fileRef.current.value = ''
    } finally { setSaving(false) }
  }

  async function deleteCertification() {
    if (!canEdit || certId === 'new' || saving) return
    setSaving(true); setError(null); setMessage(null)
    try {
      const response = await fetch(`/api/profile/certifications/${certId}`, { method: 'DELETE', credentials: 'include' })
      if (!response.ok) return setError(await readError(response, 'Sertifika silinemedi.'))
      const nextCertifications = data.certifications.filter((item) => item.id !== certId)
      const nextSelectedId = nextCertifications[0]?.id ?? 'new'
      setData((current) => ({ ...current, certifications: current.certifications.filter((item) => item.id !== certId) }))
      setCertId(nextSelectedId)
      setLastSelectedCertId(typeof nextSelectedId === 'number' ? nextSelectedId : null)
      setCertComposerMode(null)
      setMessage('Sertifika kaldirildi.')
    } finally { setSaving(false) }
  }

  function openNewCertificationComposer() {
    if (!canEdit) return
    if (typeof certId === 'number') {
      setLastSelectedCertId(certId)
    }
    setCertId('new')
    setCertForm({ ...emptyCert, sortOrder: data.certifications.length })
    setCertFile(null)
    setRemoveCertAsset(false)
    setCertComposerMode('create')
    setError(null)
    setMessage(null)
    if (fileRef.current) {
      fileRef.current.value = ''
    }
  }

  function openEditCertificationComposer() {
    if (!canEdit || !featuredCert) return
    setCertId(featuredCert.id)
    setLastSelectedCertId(featuredCert.id)
    setCertForm({
      title: featuredCert.title,
      issuer: featuredCert.issuer,
      issueDate: featuredCert.issueDate,
      expiryDate: featuredCert.expiryDate,
      credentialId: featuredCert.credentialId,
      verifyUrl: featuredCert.verifyUrl,
      status: featuredCert.status,
      notes: featuredCert.notes,
      sortOrder: featuredCert.sortOrder,
    })
    setCertFile(null)
    setRemoveCertAsset(false)
    setCertComposerMode('edit')
    setError(null)
    setMessage(null)
    if (fileRef.current) {
      fileRef.current.value = ''
    }
  }

  function closeCertificationComposer() {
    setCertComposerMode(null)
    setCertFile(null)
    setRemoveCertAsset(false)
    if (fileRef.current) {
      fileRef.current.value = ''
    }
    if (certId === 'new') {
      setCertId(lastSelectedCertId ?? data.certifications[0]?.id ?? 'new')
    }
  }

  async function saveEducation() {
    if (!canEdit || saving) return
    setSaving(true); setError(null); setMessage(null)
    try {
      const isNew = eduId === 'new'
      const response = await fetch(isNew ? '/api/profile/education' : `/api/profile/education/${eduId}`, {
        method: isNew ? 'POST' : 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eduForm),
      })
      if (!response.ok) return setError(await readError(response, 'Egitim kaydedilemedi.'))
      const payload = (await response.json()) as { education: PortfolioEducationRecord }
      setData((current) => ({
        ...current,
        education: (isNew ? [payload.education, ...current.education] : current.education.map((item) => item.id === payload.education.id ? payload.education : item)).sort((a, b) => a.sortOrder - b.sortOrder || b.id - a.id),
      }))
      setEduId(payload.education.id); setMessage(isNew ? 'Egitim eklendi.' : 'Egitim guncellendi.')
    } finally { setSaving(false) }
  }

  async function deleteEducation() {
    if (!canEdit || eduId === 'new' || saving) return
    setSaving(true); setError(null); setMessage(null)
    try {
      const response = await fetch(`/api/profile/education/${eduId}`, { method: 'DELETE', credentials: 'include' })
      if (!response.ok) return setError(await readError(response, 'Egitim silinemedi.'))
      setData((current) => ({ ...current, education: current.education.filter((item) => item.id !== eduId) }))
      setEduId('new'); setMessage('Egitim kaldirildi.')
    } finally { setSaving(false) }
  }

  return (
    <div className="mx-auto max-w-[1680px] px-4 py-8 md:px-6 lg:px-8 xl:px-10 md:py-10">
      <section className="overflow-hidden rounded-[32px] border border-emerald-400/12 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.09),rgba(4,8,7,0.94)_55%,rgba(1,4,3,0.98)_100%)] shadow-[0_20px_70px_rgba(0,0,0,0.32)]">
        <div className="border-b border-emerald-400/10 px-5 py-6 md:px-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.42em] text-emerald-300/65">Portfolio Control Surface</p>
          <div className="mt-4 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-slate-100 md:text-5xl">Profil merkezi</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300/75">Profil, sertifika ve egitimlerini burada tek merkezden yonetebilirsin.</p>
            </div>
            <div className="min-w-0 rounded-[28px] border border-emerald-400/12 bg-black/30 p-4 shadow-[0_18px_45px_rgba(0,0,0,0.18)] md:min-w-[360px]">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[22px] border border-emerald-400/20 bg-emerald-400/8">
                  {avatarSrc ? (
                    <img src={avatarSrc} alt={data.user.displayName} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center font-mono text-lg tracking-[0.18em] text-emerald-200/85">
                      {getInitials(data.user.displayName)}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold text-slate-100">{data.user.displayName}</p>
                  <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.24em] text-emerald-300/60">
                    @{data.user.username}
                  </p>
                  <p className="mt-2 truncate text-xs text-slate-400">
                    {profileForm.headline || data.profile.headline || 'Operator profile active'}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <span className="rounded-full border border-emerald-400/20 px-3 py-1 text-[11px] text-emerald-200/80">
                    {data.user.role.toUpperCase()}
                  </span>
                  <span className="rounded-full border border-emerald-400/20 px-3 py-1 text-[11px] text-emerald-200/80">
                    {authSyncing ? 'SESSION SYNC' : canEdit ? 'EDIT MODE' : 'READ ONLY'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-b border-emerald-400/10 px-5 py-4 md:px-8">
          <div className="flex flex-wrap gap-3">{tabs.map((item) => <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`rounded-2xl border px-4 py-3 font-mono text-xs tracking-[0.25em] transition ${tab === item.id ? 'border-emerald-300/45 bg-emerald-400/10 text-emerald-100' : 'border-white/10 bg-black/20 text-slate-400 hover:border-emerald-400/25 hover:text-emerald-100'}`}>{item.label}</button>)}</div>
        </div>

        <div className="px-5 py-6 md:px-8">
          {!canEdit && !authSyncing && (
            <div className="mb-6 flex flex-col gap-4 rounded-[26px] border border-amber-300/15 bg-amber-400/[0.04] px-5 py-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-amber-200/75">
                  Duzenleme kilidi
                </p>
                <p className="mt-2 text-sm leading-7 text-slate-300/80">
                  Profili duzenlemek, sertifika eklemek ve egitim kayitlarini yonetmek icin giris yapman veya yeni hesap olusturman gerekiyor.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/login"
                  className="rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.28em] text-emerald-200 transition hover:bg-emerald-400/16"
                >
                  Giris Yap
                </Link>
                <Link
                  href="/register"
                  className="rounded-2xl border border-emerald-300/25 bg-transparent px-4 py-3 font-mono text-[11px] uppercase tracking-[0.28em] text-emerald-200 transition hover:bg-emerald-400/10"
                >
                  Kayit Ol
                </Link>
              </div>
            </div>
          )}

          {authSyncing && (
            <div className="mb-6 rounded-[24px] border border-emerald-400/10 bg-emerald-400/[0.04] px-5 py-4 font-mono text-[11px] uppercase tracking-[0.32em] text-emerald-200/70">
              Oturum senkronize ediliyor...
            </div>
          )}

          {tab === 'profile' && (
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[28px] border border-white/8 bg-black/30 p-5 md:p-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2 rounded-[24px] border border-white/8 bg-black/20 p-4">
                    <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-emerald-300/55">
                      Profil fotografisi ve kisisellestirme
                    </p>
                    <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-center">
                      <div className="h-24 w-24 shrink-0 overflow-hidden rounded-[28px] border border-emerald-400/18 bg-emerald-400/8">
                        {avatarSrc ? (
                          <img src={avatarSrc} alt={data.user.displayName} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center font-mono text-2xl tracking-[0.2em] text-emerald-200/85">
                            {getInitials(data.user.displayName)}
                          </div>
                        )}
                      </div>

                      <div className="flex-1 space-y-3">
                        <input
                          ref={avatarFileRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={(event) => void uploadAvatar(event.target.files?.[0] ?? null)}
                          disabled={!canEdit || avatarUploading}
                          className="hidden"
                        />
                        <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-sm text-slate-300">
                          {data.profile.avatarName ?? 'JPG, PNG veya WEBP - maksimum 5 MB'}
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => avatarFileRef.current?.click()}
                            disabled={!canEdit || avatarUploading}
                            className="rounded-2xl border border-emerald-300/25 bg-emerald-400/8 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.28em] text-emerald-200 transition hover:bg-emerald-400/14 disabled:opacity-60"
                          >
                            {avatarUploading ? 'Yukleniyor' : data.profile.avatarPath ? 'Fotografi Degistir' : 'Fotograf Yukle'}
                          </button>
                          {data.profile.avatarPath && (
                            <button
                              type="button"
                              onClick={() => void removeAvatar()}
                              disabled={!canEdit || avatarUploading}
                              className="rounded-2xl border border-rose-300/25 bg-rose-400/10 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.28em] text-rose-200 transition hover:bg-rose-400/14 disabled:opacity-60"
                            >
                              Fotografi Kaldir
                            </button>
                          )}
                        </div>
                        <p className="text-xs leading-6 text-slate-400">
                          Bu fotograf, sag ustteki operator kartinda ve profil alaninda kimligini daha profesyonel gostermek icin kullanilir.
                        </p>
                      </div>
                    </div>
                  </div>

                  <input value={profileForm.headline} onChange={(event) => setProfileForm((v) => ({ ...v, headline: event.target.value }))} disabled={!canEdit} className={`${fieldClass} md:col-span-2`} placeholder="Profil basligi" />
                  <input value={profileForm.location} onChange={(event) => setProfileForm((v) => ({ ...v, location: event.target.value }))} disabled={!canEdit} className={fieldClass} placeholder="Lokasyon" />
                  <input value={profileForm.website} onChange={(event) => setProfileForm((v) => ({ ...v, website: event.target.value }))} disabled={!canEdit} className={fieldClass} placeholder="Website" />
                  <textarea value={profileForm.bio} onChange={(event) => setProfileForm((v) => ({ ...v, bio: event.target.value }))} disabled={!canEdit} rows={5} className={`${fieldClass} md:col-span-2`} placeholder="Biyografi" />
                  <textarea value={profileForm.specialties} onChange={(event) => setProfileForm((v) => ({ ...v, specialties: event.target.value }))} disabled={!canEdit} rows={5} className={fieldClass} placeholder="Uzmanlik alanlari" />
                  <textarea value={profileForm.tools} onChange={(event) => setProfileForm((v) => ({ ...v, tools: event.target.value }))} disabled={!canEdit} rows={5} className={fieldClass} placeholder="Araclar" />
                </div>
                {canEdit && <button type="button" onClick={() => void saveProfile()} disabled={saving} className="mt-4 rounded-2xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.28em] text-emerald-200">{saving ? 'Kaydediliyor' : 'Profili Kaydet'}</button>}
              </div>
              <div className="rounded-[28px] border border-white/8 bg-black/20 p-6">
                <div className="flex items-start gap-4">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-[24px] border border-emerald-400/18 bg-emerald-400/8">
                    {avatarSrc ? (
                      <img src={avatarSrc} alt={data.user.displayName} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center font-mono text-2xl tracking-[0.2em] text-emerald-200/85">
                        {getInitials(data.user.displayName)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-2xl font-semibold text-slate-100">{profileForm.headline || 'Profil basligi'}</h2>
                    <p className="mt-2 text-sm text-slate-400">{profileForm.location || 'Lokasyon bilgisi'}</p>
                    <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.24em] text-emerald-300/55">
                      @{data.user.username}
                    </p>
                  </div>
                </div>
                {websiteUrl && (
                  <div className="mt-5 rounded-[22px] border border-emerald-400/14 bg-emerald-400/[0.05] p-4">
                    <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-emerald-300/55">
                      Website
                    </p>
                    <a
                      href={websiteUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex max-w-full items-center rounded-2xl border border-emerald-300/20 bg-black/25 px-4 py-3 text-sm text-emerald-100 transition hover:border-emerald-300/35 hover:bg-emerald-400/[0.08]"
                    >
                      <span className="truncate">{profileForm.website.trim()}</span>
                    </a>
                  </div>
                )}
                <p className="mt-5 text-sm leading-7 text-slate-300/85">{profileForm.bio || 'Biyografi burada gorunur.'}</p>
                <div className="mt-6 flex flex-wrap gap-2">{textToList(profileForm.specialties).map((item) => <span key={item} className="rounded-full border border-emerald-400/18 bg-emerald-400/6 px-3 py-1 text-xs text-emerald-100/80">{item}</span>)}</div>
                <div className="mt-6 flex flex-wrap gap-2">{textToList(profileForm.tools).map((item) => <span key={item} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">{item}</span>)}</div>
              </div>
            </div>
          )}

          {tab === 'certifications' && (
            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-[28px] border border-white/8 bg-black/25 p-5 md:p-6">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  {canEdit && (
                    <button
                      type="button"
                      onClick={openNewCertificationComposer}
                      className="rounded-2xl border border-emerald-300/25 bg-emerald-400/8 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.28em] text-emerald-200 transition hover:bg-emerald-400/14"
                    >
                      Yeni sertifika
                    </button>
                  )}
                  <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-slate-500">
                    Sol panel kayitlar, sag panel vitrin
                  </p>
                </div>
                {data.certifications.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {data.certifications.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => { setCertId(item.id); setLastSelectedCertId(item.id) }}
                        className={`overflow-hidden rounded-[28px] border text-left transition ${item.id === featuredCert?.id ? 'border-emerald-300/40 bg-emerald-400/7 shadow-[0_18px_45px_rgba(16,185,129,0.08)]' : 'border-white/8 bg-black/30 hover:-translate-y-1 hover:border-emerald-300/20'}`}
                      >
                        <div className="h-[220px] bg-black">
                          <CertificationPreview item={item} />
                        </div>
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="text-base font-semibold text-slate-100">{item.title}</h3>
                              <p className="mt-1 text-sm text-slate-400">{item.issuer}</p>
                            </div>
                            <span className="rounded-full border border-emerald-400/18 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-emerald-200/75">
                              {item.status}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex min-h-[420px] items-center justify-center rounded-[28px] border border-dashed border-emerald-400/12 bg-black/20 px-8 text-center">
                    <div className="max-w-md">
                      <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-emerald-300/55">
                        Sertifika vitrini hazir
                      </p>
                      <p className="mt-4 text-sm leading-7 text-slate-300/78">
                        Ilk sertifikani eklediginde sol tarafa kayit karti, sag tarafa da gorsel sertifika vitrini otomatik duscek.
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <div className="rounded-[28px] border border-white/8 bg-black/30 p-5 md:p-6">
                {featuredCert ? (
                  <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,14,12,0.95),rgba(3,7,6,0.98))] p-5">
                    <div className="pointer-events-none absolute -right-14 -top-12 h-40 w-40 rounded-full bg-emerald-400/12 blur-3xl animate-pulse" />
                    <div className="pointer-events-none absolute -left-8 bottom-6 h-28 w-28 rounded-full bg-cyan-400/8 blur-3xl animate-pulse" />
                    <div className="relative">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-emerald-300/55">
                            Sertifika vitrini
                          </p>
                          <h3 className="mt-3 text-2xl font-semibold text-slate-100">{featuredCert.title}</h3>
                          <p className="mt-2 text-sm text-slate-400">{featuredCert.issuer}</p>
                        </div>
                        <span className="rounded-full border border-emerald-400/18 bg-emerald-400/8 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.24em] text-emerald-200/80">
                          {featuredCert.status}
                        </span>
                      </div>

                      <div className="mt-5 overflow-hidden rounded-[26px] border border-white/10 bg-black">
                        <div className="relative h-[320px]">
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.16),transparent_52%)] animate-pulse" />
                          <CertificationPreview item={featuredCert} />
                        </div>
                      </div>

                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <div className="rounded-[22px] border border-white/8 bg-black/25 p-4">
                          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-emerald-300/55">
                            Credential ID
                          </p>
                          <p className="mt-3 text-sm text-slate-200">
                            {featuredCert.credentialId || 'Belirtilmedi'}
                          </p>
                        </div>
                        <div className="rounded-[22px] border border-white/8 bg-black/25 p-4">
                          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-emerald-300/55">
                            Gecerlilik
                          </p>
                          <p className="mt-3 text-sm text-slate-200">
                            {featuredCert.issueDate || 'Tarih bekleniyor'}
                            {featuredCert.expiryDate ? ` - ${featuredCert.expiryDate}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 rounded-[22px] border border-white/8 bg-black/25 p-4">
                        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-emerald-300/55">
                          Aciklama
                        </p>
                        <p className="mt-3 text-sm leading-7 text-slate-300/80">
                          {featuredCert.notes || 'Bu sertifika icin aciklama eklenmedi.'}
                        </p>
                      </div>

                      <div className="mt-5 flex flex-wrap gap-3">
                        {featuredCert.verifyUrl && (
                          <a
                            href={featuredCert.verifyUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center rounded-2xl border border-emerald-300/25 bg-emerald-400/8 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.28em] text-emerald-200 transition hover:bg-emerald-400/14"
                          >
                            Sertifikayi Dogrula
                          </a>
                        )}
                        {canEdit && (
                          <button
                            type="button"
                            onClick={openEditCertificationComposer}
                            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.28em] text-slate-200 transition hover:border-emerald-300/20 hover:text-emerald-100"
                          >
                            Duzenle
                          </button>
                        )}
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => void deleteCertification()}
                            disabled={saving}
                            className="rounded-2xl border border-rose-300/25 bg-rose-400/10 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.28em] text-rose-200 transition hover:bg-rose-400/14 disabled:opacity-60"
                          >
                            Sil
                          </button>
                        )}
                      </div>

                      {certificationShowcase.length > 1 && (
                        <div className="mt-6 grid gap-3 md:grid-cols-3">
                          {certificationShowcase.map((item, index) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => { setCertId(item.id); setLastSelectedCertId(item.id) }}
                              className={`overflow-hidden rounded-[22px] border bg-black/35 text-left transition hover:-translate-y-1 ${item.id === featuredCert.id ? 'border-emerald-300/35' : 'border-white/8'}`}
                              style={{ transform: `translateY(${index * 2}px)` }}
                            >
                              <div className="h-[120px] bg-black">
                                <CertificationPreview item={item} />
                              </div>
                              <div className="px-3 py-3">
                                <p className="truncate text-sm font-medium text-slate-100">{item.title}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="relative flex min-h-[620px] items-center justify-center overflow-hidden rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(3,7,6,0.95),rgba(2,4,3,0.98))] p-8 text-center">
                    <div className="pointer-events-none absolute inset-x-10 top-10 h-24 rounded-full bg-emerald-400/8 blur-3xl animate-pulse" />
                    <div className="relative max-w-md">
                      <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-emerald-300/55">
                        Gorsel sertifika alani
                      </p>
                      <h3 className="mt-4 text-2xl font-semibold text-slate-100">
                        Sertifika ekledigin anda vitrin canlanacak
                      </h3>
                      <p className="mt-4 text-sm leading-7 text-slate-300/78">
                        Yeni sertifika paneli sagdan acilacak, kaydettiginde otomatik kapanacak ve belge burada gorsel olarak gorunecek.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'education' && (
            <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="rounded-[28px] border border-white/8 bg-black/25 p-5 md:p-6">
                {canEdit && <button type="button" onClick={() => setEduId('new')} className="mb-5 rounded-2xl border border-emerald-300/25 bg-emerald-400/8 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.28em] text-emerald-200">Yeni egitim</button>}
                <div className="space-y-4">{data.education.map((item) => <button key={item.id} type="button" onClick={() => setEduId(item.id)} className={`w-full rounded-[24px] border px-5 py-4 text-left ${item.id === eduId ? 'border-emerald-300/40 bg-emerald-400/8' : 'border-white/8 bg-black/20'}`}><h3 className="text-lg font-semibold text-slate-100">{item.program}</h3><p className="mt-1 text-sm text-slate-400">{item.institution}</p><p className="mt-3 text-sm leading-7 text-slate-300/80">{item.description}</p></button>)}</div>
              </div>
              <div className="rounded-[28px] border border-white/8 bg-black/30 p-5 md:p-6">
                {canEdit ? (
                  <div className="space-y-4">
                    <input value={eduForm.institution} onChange={(event) => setEduForm((v) => ({ ...v, institution: event.target.value }))} className={fieldClass} placeholder="Kurum" />
                    <input value={eduForm.program} onChange={(event) => setEduForm((v) => ({ ...v, program: event.target.value }))} className={fieldClass} placeholder="Program" />
                    <div className="grid gap-4 md:grid-cols-2">
                      <input value={eduForm.degree} onChange={(event) => setEduForm((v) => ({ ...v, degree: event.target.value }))} className={fieldClass} placeholder="Derece / Track" />
                      <select value={eduForm.status} onChange={(event) => setEduForm((v) => ({ ...v, status: event.target.value as PortfolioEducationRecord['status'] }))} className={fieldClass}><option value="completed">completed</option><option value="active">active</option><option value="planned">planned</option><option value="paused">paused</option></select>
                      <input value={eduForm.startDate} onChange={(event) => setEduForm((v) => ({ ...v, startDate: event.target.value }))} className={fieldClass} placeholder="Baslangic" />
                      <input value={eduForm.endDate} onChange={(event) => setEduForm((v) => ({ ...v, endDate: event.target.value }))} className={fieldClass} placeholder="Bitis" />
                    </div>
                    <textarea value={eduForm.description} onChange={(event) => setEduForm((v) => ({ ...v, description: event.target.value }))} rows={6} className={fieldClass} placeholder="Aciklama" />
                    <div className="flex flex-wrap gap-3"><button type="button" onClick={() => void saveEducation()} disabled={saving} className="rounded-2xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.28em] text-emerald-200">{saving ? 'Kaydediliyor' : eduId === 'new' ? 'Egitim Ekle' : 'Guncelle'}</button>{eduId !== 'new' && <button type="button" onClick={() => void deleteEducation()} disabled={saving} className="rounded-2xl border border-rose-300/25 bg-rose-400/10 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.28em] text-rose-200">Sil</button>}</div>
                  </div>
                ) : selectedEdu ? <div className="space-y-3 text-sm text-slate-300"><p>{selectedEdu.institution}</p><p>{selectedEdu.description}</p></div> : null}
              </div>
            </div>
          )}

          {canEdit && isCertComposerOpen && (
            <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
              <div
                className="absolute inset-0"
                onClick={closeCertificationComposer}
                aria-hidden="true"
              />
              <div className="relative h-full w-full max-w-2xl overflow-y-auto border-l border-emerald-400/12 bg-[linear-gradient(180deg,#040807,#020403)] p-6 shadow-[-24px_0_80px_rgba(0,0,0,0.45)] md:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-emerald-300/55">
                      Certificate Composer
                    </p>
                    <h3 className="mt-3 text-2xl font-semibold text-slate-100">
                      {certComposerMode === 'create' ? 'Yeni sertifika ekle' : 'Sertifikayi guncelle'}
                    </h3>
                    <p className="mt-3 max-w-xl text-sm leading-7 text-slate-300/78">
                      Bu panel sekme degil, gecici bir ekleme ekrani. Kaydedince kapanir ve sertifika vitrinde hemen yerini alir.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeCertificationComposer}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.28em] text-slate-200 transition hover:border-emerald-300/25 hover:text-emerald-100"
                  >
                    Kapat
                  </button>
                </div>

                <div className="mt-8 space-y-4 rounded-[28px] border border-white/8 bg-black/25 p-5 md:p-6">
                  <input value={certForm.title} onChange={(event) => setCertForm((v) => ({ ...v, title: event.target.value }))} className={fieldClass} placeholder="Sertifika basligi" />
                  <input value={certForm.issuer} onChange={(event) => setCertForm((v) => ({ ...v, issuer: event.target.value }))} className={fieldClass} placeholder="Veren kurum" />
                  <div className="grid gap-4 md:grid-cols-2">
                    <input value={certForm.issueDate} onChange={(event) => setCertForm((v) => ({ ...v, issueDate: event.target.value }))} className={fieldClass} placeholder="Verilis tarihi" />
                    <input value={certForm.expiryDate} onChange={(event) => setCertForm((v) => ({ ...v, expiryDate: event.target.value }))} className={fieldClass} placeholder="Son gecerlilik" />
                    <input value={certForm.credentialId} onChange={(event) => setCertForm((v) => ({ ...v, credentialId: event.target.value }))} className={fieldClass} placeholder="Credential ID" />
                    <select value={certForm.status} onChange={(event) => setCertForm((v) => ({ ...v, status: event.target.value as PortfolioCertificationRecord['status'] }))} className={fieldClass}><option value="verified">verified</option><option value="active">active</option><option value="planned">planned</option><option value="expired">expired</option></select>
                  </div>
                  <input value={certForm.verifyUrl} onChange={(event) => setCertForm((v) => ({ ...v, verifyUrl: event.target.value }))} className={fieldClass} placeholder="Dogrulama linki" />
                  <input ref={fileRef} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(event) => setCertFile(event.target.files?.[0] ?? null)} className={`${fieldClass} file:mr-4 file:rounded-xl file:border-0 file:bg-emerald-400/12 file:px-3 file:py-2 file:text-xs file:font-mono file:uppercase file:tracking-[0.22em] file:text-emerald-200`} />
                  {featuredCert?.assetPath && certComposerMode === 'edit' && <label className="flex items-center gap-3 rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-sm text-slate-300"><input type="checkbox" checked={removeCertAsset} onChange={(event) => setRemoveCertAsset(event.target.checked)} className="h-4 w-4" />Mevcut belgeyi kaldir</label>}
                  <textarea value={certForm.notes} onChange={(event) => setCertForm((v) => ({ ...v, notes: event.target.value }))} rows={6} className={fieldClass} placeholder="Notlar" />

                  <div className="flex flex-wrap gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => void saveCertification()}
                      disabled={saving}
                      className="rounded-2xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.28em] text-emerald-200 disabled:opacity-60"
                    >
                      {saving ? 'Kaydediliyor' : certComposerMode === 'create' ? 'Sertifika Ekle' : 'Guncelle'}
                    </button>
                    <button
                      type="button"
                      onClick={closeCertificationComposer}
                      disabled={saving}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.28em] text-slate-200 disabled:opacity-60"
                    >
                      Vazgec
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && <p className="mt-5 text-sm text-rose-300">{error}</p>}
          {message && <p className="mt-5 text-sm text-emerald-300">{message}</p>}
        </div>
      </section>
    </div>
  )
}
