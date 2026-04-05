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
const actionButtonBaseClass = 'route-action-btn'
const primaryButtonClass = `${actionButtonBaseClass} route-action-btn--primary`
const secondaryButtonClass = `${actionButtonBaseClass} route-action-btn--secondary`
const dangerButtonClass = `${actionButtonBaseClass} route-action-btn--danger`
const fileInputClass = `${fieldClass} route-file-input`
const tokenInputClass =
  'w-full rounded-2xl border border-white/10 bg-[#050807] px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-emerald-300/50'
const compactPrimaryButtonClass = `${primaryButtonClass} min-w-[124px] justify-center tracking-[0.18em]`

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

function TokenBoardEditor({
  label,
  caption,
  items,
  draft,
  placeholder,
  canEdit,
  onDraftChange,
  onAdd,
  onRemove,
}: {
  label: string
  caption: string
  items: string[]
  draft: string
  placeholder: string
  canEdit: boolean
  onDraftChange: (value: string) => void
  onAdd: () => void
  onRemove: (value: string) => void
}) {
  return (
    <div className="relative flex h-full min-h-[360px] flex-col overflow-hidden rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,14,12,0.78),rgba(4,8,7,0.92))] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.18)]">
      <div className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-emerald-400/10 blur-3xl" />
      <div className="relative flex h-full flex-col">
        <div className="grid min-h-[86px] grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
          <div className="pr-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-emerald-300/55">
              {label}
            </p>
            <p className="mt-3 max-w-[30ch] text-sm leading-6 text-slate-400/88">
              {caption}
            </p>
          </div>
          <span className="inline-flex min-h-[44px] min-w-[86px] items-center justify-center rounded-full border border-emerald-400/16 bg-emerald-400/8 px-4 py-1 text-center font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-100/80">
            {items.length} kayit
          </span>
        </div>

        <div className="mt-5 flex-1 rounded-[22px] border border-white/8 bg-black/20 p-3.5">
          {items.length > 0 ? (
            <div className="flex flex-wrap content-start gap-2.5">
              {items.map((item) => (
                <div
                  key={item}
                  className="group inline-flex min-h-[40px] items-center gap-2 rounded-full border border-emerald-400/16 bg-emerald-400/[0.07] px-3.5 py-2 text-[13px] text-emerald-50/92 transition hover:-translate-y-0.5 hover:border-emerald-300/28 hover:bg-emerald-400/[0.12]"
                >
                  <span className="leading-none">{item}</span>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => onRemove(item)}
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-transparent text-[10px] text-emerald-200/75 transition hover:border-rose-300/25 hover:bg-rose-400/12 hover:text-rose-200"
                      aria-label={`${item} kaldir`}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-full min-h-[140px] items-center justify-center rounded-[18px] border border-dashed border-emerald-400/12 bg-black/20 px-6 text-center">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-emerald-300/50">
                  Bekleyen alan
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-400">
                  Ilk kayit eklendiginde bu alan chip tabanli bir uzmanlik panosuna donusecek.
                </p>
              </div>
            </div>
          )}
        </div>

        {canEdit && (
          <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_128px] md:items-end">
            <input
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  onAdd()
                }
              }}
              className={tokenInputClass}
              placeholder={placeholder}
            />
            <button
              type="button"
              onClick={onAdd}
              disabled={!draft.trim()}
              className={compactPrimaryButtonClass}
            >
              Ekle
            </button>
          </div>
        )}
      </div>
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
  const [specialtyDraft, setSpecialtyDraft] = useState('')
  const [toolDraft, setToolDraft] = useState('')
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
  const [eduComposerMode, setEduComposerMode] = useState<'create' | 'edit' | null>(null)
  const [lastSelectedCertId, setLastSelectedCertId] = useState<number | null>(
    initialProfile.certifications[0]?.id ?? null,
  )
  const [lastSelectedEduId, setLastSelectedEduId] = useState<number | null>(
    initialProfile.education[0]?.id ?? null,
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
  const specialtiesList = useMemo(() => textToList(profileForm.specialties), [profileForm.specialties])
  const toolsList = useMemo(() => textToList(profileForm.tools), [profileForm.tools])
  const isCertComposerOpen = certComposerMode !== null
  const isEduComposerOpen = eduComposerMode !== null
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
  const featuredEdu = useMemo(
    () =>
      selectedEdu ??
      (lastSelectedEduId != null
        ? data.education.find((item) => item.id === lastSelectedEduId) ?? null
        : null) ??
      data.education[0] ??
      null,
    [data.education, lastSelectedEduId, selectedEdu],
  )
  const educationShowcase = useMemo(
    () =>
      featuredEdu
        ? [featuredEdu, ...data.education.filter((item) => item.id !== featuredEdu.id).slice(0, 2)]
        : data.education.slice(0, 3),
    [data.education, featuredEdu],
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
    if (typeof eduId === 'number') {
      setLastSelectedEduId(eduId)
      return
    }

    if (!isEduComposerOpen && data.education[0]?.id) {
      const fallbackId =
        (lastSelectedEduId != null &&
        data.education.some((item) => item.id === lastSelectedEduId)
          ? lastSelectedEduId
          : data.education[0]?.id) ?? null
      if (fallbackId != null) {
        setEduId(fallbackId)
        setLastSelectedEduId(fallbackId)
      }
    }
  }, [data.education, eduId, isEduComposerOpen, lastSelectedEduId])

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
      const isNew = eduComposerMode === 'create' || eduId === 'new'
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
      setEduId(payload.education.id)
      setLastSelectedEduId(payload.education.id)
      setEduComposerMode(null)
      setMessage(isNew ? 'Egitim eklendi.' : 'Egitim guncellendi.')
    } finally { setSaving(false) }
  }

  async function deleteEducation() {
    if (!canEdit || eduId === 'new' || saving) return
    setSaving(true); setError(null); setMessage(null)
    try {
      const response = await fetch(`/api/profile/education/${eduId}`, { method: 'DELETE', credentials: 'include' })
      if (!response.ok) return setError(await readError(response, 'Egitim silinemedi.'))
      const nextEducation = data.education.filter((item) => item.id !== eduId)
      const nextSelectedId = nextEducation[0]?.id ?? 'new'
      setData((current) => ({ ...current, education: current.education.filter((item) => item.id !== eduId) }))
      setEduId(nextSelectedId)
      setLastSelectedEduId(typeof nextSelectedId === 'number' ? nextSelectedId : null)
      setEduComposerMode(null)
      setMessage('Egitim kaldirildi.')
    } finally { setSaving(false) }
  }

  function openNewEducationComposer() {
    if (!canEdit) return
    if (typeof eduId === 'number') {
      setLastSelectedEduId(eduId)
    }
    setEduId('new')
    setEduForm({ ...emptyEdu, sortOrder: data.education.length })
    setEduComposerMode('create')
    setError(null)
    setMessage(null)
  }

  function openEditEducationComposer() {
    if (!canEdit || !featuredEdu) return
    setEduId(featuredEdu.id)
    setLastSelectedEduId(featuredEdu.id)
    setEduForm({
      institution: featuredEdu.institution,
      program: featuredEdu.program,
      degree: featuredEdu.degree,
      startDate: featuredEdu.startDate,
      endDate: featuredEdu.endDate,
      status: featuredEdu.status,
      description: featuredEdu.description,
      sortOrder: featuredEdu.sortOrder,
    })
    setEduComposerMode('edit')
    setError(null)
    setMessage(null)
  }

  function closeEducationComposer() {
    setEduComposerMode(null)
    if (eduId === 'new') {
      setEduId(lastSelectedEduId ?? data.education[0]?.id ?? 'new')
    }
  }

  function updateProfileListField(field: 'specialties' | 'tools', items: string[]) {
    setProfileForm((current) => ({
      ...current,
      [field]: listToText(items),
    }))
  }

  function addProfileToken(field: 'specialties' | 'tools', draft: string) {
    const candidate = draft.trim()
    if (!candidate) return

    const source = field === 'specialties' ? specialtiesList : toolsList
    const exists = source.some((item) => item.toLowerCase() === candidate.toLowerCase())
    if (exists) return

    updateProfileListField(field, [...source, candidate])
    if (field === 'specialties') {
      setSpecialtyDraft('')
      return
    }
    setToolDraft('')
  }

  function removeProfileToken(field: 'specialties' | 'tools', value: string) {
    const source = field === 'specialties' ? specialtiesList : toolsList
    updateProfileListField(
      field,
      source.filter((item) => item !== value),
    )
  }

  return (
    <div className="route-page-frame py-6 md:py-8">
      <section className="route-hero">
        <div className="border-b px-5 py-6 md:px-8" style={{ borderColor: 'rgb(var(--route-accent-rgb) / 0.12)' }}>
          <p className="route-kicker">Portfolio Control Surface</p>
          <div className="mt-4 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="route-title text-3xl md:text-5xl">Profil merkezi</h1>
              <p className="route-copy mt-3 max-w-3xl text-sm">Profil, sertifika ve egitimlerini burada tek merkezden yonetebilirsin.</p>
            </div>
            <div className="route-panel min-w-0 p-4 md:min-w-[360px]">
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

              </div>
            </div>
          </div>
        </div>

        <div className="border-b px-5 py-4 md:px-8" style={{ borderColor: 'rgb(var(--route-accent-rgb) / 0.12)' }}>
          <div className="route-tabs">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className="route-tab-btn"
                data-active={tab === item.id}
              >
                {item.label}
              </button>
            ))}
          </div>
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
                  className={primaryButtonClass}
                >
                  Giris Yap
                </Link>
                <Link
                  href="/register"
                  className={secondaryButtonClass}
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

                      <div className="flex flex-1 flex-col justify-center gap-3">
                        <input
                          ref={avatarFileRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={(event) => void uploadAvatar(event.target.files?.[0] ?? null)}
                          disabled={!canEdit || avatarUploading}
                          className="hidden"
                        />
                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => avatarFileRef.current?.click()}
                            disabled={!canEdit || avatarUploading}
                            className={primaryButtonClass}
                          >
                            {avatarUploading ? 'Yukleniyor' : data.profile.avatarPath ? 'Fotografi Degistir' : 'Fotograf Yukle'}
                          </button>
                          {data.profile.avatarPath && (
                            <button
                              type="button"
                              onClick={() => void removeAvatar()}
                              disabled={!canEdit || avatarUploading}
                              className={dangerButtonClass}
                            >
                              Fotografi Kaldir
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <input value={profileForm.headline} onChange={(event) => setProfileForm((v) => ({ ...v, headline: event.target.value }))} disabled={!canEdit} className={`${fieldClass} md:col-span-2`} placeholder="Profil basligi" />
                  <input value={profileForm.location} onChange={(event) => setProfileForm((v) => ({ ...v, location: event.target.value }))} disabled={!canEdit} className={fieldClass} placeholder="Lokasyon" />
                  <input value={profileForm.website} onChange={(event) => setProfileForm((v) => ({ ...v, website: event.target.value }))} disabled={!canEdit} className={fieldClass} placeholder="Website" />
                  <textarea value={profileForm.bio} onChange={(event) => setProfileForm((v) => ({ ...v, bio: event.target.value }))} disabled={!canEdit} rows={5} className={`${fieldClass} md:col-span-2`} placeholder="Biyografi" />
                  <div className="md:col-span-2 grid gap-4 xl:grid-cols-2">
                    <TokenBoardEditor
                      label="Uzmanlik panosu"
                      caption="Operasyonel kimligini tanimlayan uzmanlik alanlarini vitrin gibi yonet."
                      items={specialtiesList}
                      draft={specialtyDraft}
                      placeholder="Ornek: Malware Analysis"
                      canEdit={canEdit}
                      onDraftChange={setSpecialtyDraft}
                      onAdd={() => addProfileToken('specialties', specialtyDraft)}
                      onRemove={(value) => removeProfileToken('specialties', value)}
                    />
                    <TokenBoardEditor
                      label="Arac vitrini"
                      caption="Kullandigin stack'i tek bakista premium bir arac panosuna donustur."
                      items={toolsList}
                      draft={toolDraft}
                      placeholder="Ornek: Burp Suite"
                      canEdit={canEdit}
                      onDraftChange={setToolDraft}
                      onAdd={() => addProfileToken('tools', toolDraft)}
                      onRemove={(value) => removeProfileToken('tools', value)}
                    />
                  </div>
                </div>
                {canEdit && <button type="button" onClick={() => void saveProfile()} disabled={saving} className={`mt-4 ${primaryButtonClass}`}>{saving ? 'Kaydediliyor' : 'Profili Kaydet'}</button>}
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

                <div className="mt-6 grid gap-4 xl:grid-cols-2">
                  <div className="rounded-[22px] border border-emerald-400/14 bg-emerald-400/[0.04] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-emerald-300/55">
                        Uzmanlik alanlari
                      </p>
                      <span className="rounded-full border border-emerald-400/16 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-100/70">
                        {specialtiesList.length}
                      </span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {specialtiesList.length > 0 ? specialtiesList.map((item) => (
                        <span key={item} className="rounded-full border border-emerald-400/18 bg-emerald-400/6 px-3 py-1 text-xs text-emerald-100/80">{item}</span>
                      )) : (
                        <p className="text-sm text-slate-500">Uzmanlik eklendikce burada gozukur.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-emerald-300/55">
                        Arac seti
                      </p>
                      <span className="rounded-full border border-white/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-300/75">
                        {toolsList.length}
                      </span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {toolsList.length > 0 ? toolsList.map((item) => (
                        <span key={item} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">{item}</span>
                      )) : (
                        <p className="text-sm text-slate-500">Araclar eklendikce burada gozukur.</p>
                      )}
                    </div>
                  </div>
                </div>
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
                      className={primaryButtonClass}
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
                            className={primaryButtonClass}
                          >
                            Sertifikayi Dogrula
                          </a>
                        )}
                        {canEdit && (
                          <button
                            type="button"
                            onClick={openEditCertificationComposer}
                            className={secondaryButtonClass}
                          >
                            Duzenle
                          </button>
                        )}
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => void deleteCertification()}
                            disabled={saving}
                            className={dangerButtonClass}
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
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  {canEdit && (
                    <button
                      type="button"
                      onClick={openNewEducationComposer}
                      className={primaryButtonClass}
                    >
                      Yeni egitim
                    </button>
                  )}
                  <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-slate-500">
                    Sol panel kayitlar, sag panel yolculuk
                  </p>
                </div>
                {data.education.length > 0 ? (
                  <div className="space-y-4">
                    {data.education.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => { setEduId(item.id); setLastSelectedEduId(item.id) }}
                        className={`w-full rounded-[24px] border px-5 py-4 text-left transition ${item.id === featuredEdu?.id ? 'border-emerald-300/40 bg-emerald-400/8 shadow-[0_18px_45px_rgba(16,185,129,0.08)]' : 'border-white/8 bg-black/20 hover:-translate-y-1 hover:border-emerald-300/20'}`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-semibold text-slate-100">{item.program}</h3>
                            <p className="mt-1 text-sm text-slate-400">{item.institution}</p>
                          </div>
                          <span className="rounded-full border border-emerald-400/18 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-emerald-200/75">
                            {item.status}
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-7 text-slate-300/80">{item.description}</p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex min-h-[420px] items-center justify-center rounded-[28px] border border-dashed border-emerald-400/12 bg-black/20 px-8 text-center">
                    <div className="max-w-md">
                      <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-emerald-300/55">
                        Egitim vitrini hazir
                      </p>
                      <p className="mt-4 text-sm leading-7 text-slate-300/78">
                        Ilk egitim kaydinda sol liste dolacak, sag tarafta da profesyonel ogrenim yolculugu gorunmeye baslayacak.
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <div className="rounded-[28px] border border-white/8 bg-black/30 p-5 md:p-6">
                {featuredEdu ? (
                  <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,14,12,0.95),rgba(3,7,6,0.98))] p-5">
                    <div className="pointer-events-none absolute -right-16 top-8 h-44 w-44 rounded-full bg-emerald-400/10 blur-3xl animate-pulse" />
                    <div className="pointer-events-none absolute -left-6 bottom-8 h-32 w-32 rounded-full bg-cyan-400/8 blur-3xl animate-pulse" />
                    <div className="relative">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-emerald-300/55">
                            Egitim yolculugu
                          </p>
                          <h3 className="mt-3 text-2xl font-semibold text-slate-100">{featuredEdu.program}</h3>
                          <p className="mt-2 text-sm text-slate-400">{featuredEdu.institution}</p>
                        </div>
                        <span className="rounded-full border border-emerald-400/18 bg-emerald-400/8 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.24em] text-emerald-200/80">
                          {featuredEdu.status}
                        </span>
                      </div>

                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <div className="rounded-[22px] border border-white/8 bg-black/25 p-4">
                          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-emerald-300/55">
                            Kurum
                          </p>
                          <p className="mt-3 text-sm text-slate-200">
                            {featuredEdu.institution}
                          </p>
                        </div>
                        <div className="rounded-[22px] border border-white/8 bg-black/25 p-4">
                          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-emerald-300/55">
                            Derece / Track
                          </p>
                          <p className="mt-3 text-sm text-slate-200">
                            {featuredEdu.degree || 'Belirtilmedi'}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 rounded-[22px] border border-white/8 bg-black/25 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-emerald-300/55">
                            Zaman cizgisi
                          </p>
                          <p className="text-xs text-slate-400">
                            {featuredEdu.startDate || 'Baslangic yok'}
                            {featuredEdu.endDate ? ` -> ${featuredEdu.endDate}` : ' -> Devam ediyor'}
                          </p>
                        </div>
                        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/6">
                          <div className="h-full w-2/3 rounded-full bg-[linear-gradient(90deg,rgba(16,185,129,0.8),rgba(34,211,238,0.75))] shadow-[0_0_24px_rgba(16,185,129,0.25)]" />
                        </div>
                      </div>

                      <div className="mt-5 rounded-[22px] border border-white/8 bg-black/25 p-4">
                        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-emerald-300/55">
                          Ogrenim ozeti
                        </p>
                        <p className="mt-3 text-sm leading-7 text-slate-300/80">
                          {featuredEdu.description || 'Bu egitim kaydi icin aciklama eklenmedi.'}
                        </p>
                      </div>

                      <div className="mt-5 flex flex-wrap gap-3">
                        {canEdit && (
                          <button
                            type="button"
                            onClick={openEditEducationComposer}
                            className={secondaryButtonClass}
                          >
                            Duzenle
                          </button>
                        )}
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => void deleteEducation()}
                            disabled={saving}
                            className={dangerButtonClass}
                          >
                            Sil
                          </button>
                        )}
                      </div>

                      {educationShowcase.length > 1 && (
                        <div className="mt-6 grid gap-3 md:grid-cols-3">
                          {educationShowcase.map((item, index) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => { setEduId(item.id); setLastSelectedEduId(item.id) }}
                              className={`rounded-[22px] border bg-black/35 px-4 py-4 text-left transition hover:-translate-y-1 ${item.id === featuredEdu.id ? 'border-emerald-300/35' : 'border-white/8'}`}
                              style={{ transform: `translateY(${index * 2}px)` }}
                            >
                              <p className="text-sm font-semibold text-slate-100">{item.program}</p>
                              <p className="mt-2 text-xs text-slate-400">{item.institution}</p>
                              <p className="mt-3 line-clamp-3 text-xs leading-6 text-slate-300/75">{item.description}</p>
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
                        Gorsel egitim alani
                      </p>
                      <h3 className="mt-4 text-2xl font-semibold text-slate-100">
                        Egitim ekledigin anda yolculuk panosu canlanacak
                      </h3>
                      <p className="mt-4 text-sm leading-7 text-slate-300/78">
                        Yeni egitim paneli sagdan acilacak, kaydettiginde otomatik kapanacak ve ogrenim akisin burada gorsel hale gelecek.
                      </p>
                    </div>
                  </div>
                )}
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
                    className={secondaryButtonClass}
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
                  <input ref={fileRef} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(event) => setCertFile(event.target.files?.[0] ?? null)} className={fileInputClass} />
                  {featuredCert?.assetPath && certComposerMode === 'edit' && <label className="flex items-center gap-3 rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-sm text-slate-300"><input type="checkbox" checked={removeCertAsset} onChange={(event) => setRemoveCertAsset(event.target.checked)} className="h-4 w-4" />Mevcut belgeyi kaldir</label>}
                  <textarea value={certForm.notes} onChange={(event) => setCertForm((v) => ({ ...v, notes: event.target.value }))} rows={6} className={fieldClass} placeholder="Notlar" />

                  <div className="flex flex-wrap gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => void saveCertification()}
                      disabled={saving}
                      className={primaryButtonClass}
                    >
                      {saving ? 'Kaydediliyor' : certComposerMode === 'create' ? 'Sertifika Ekle' : 'Guncelle'}
                    </button>
                    <button
                      type="button"
                      onClick={closeCertificationComposer}
                      disabled={saving}
                      className={secondaryButtonClass}
                    >
                      Vazgec
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {canEdit && isEduComposerOpen && (
            <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
              <div
                className="absolute inset-0"
                onClick={closeEducationComposer}
                aria-hidden="true"
              />
              <div className="relative h-full w-full max-w-2xl overflow-y-auto border-l border-emerald-400/12 bg-[linear-gradient(180deg,#040807,#020403)] p-6 shadow-[-24px_0_80px_rgba(0,0,0,0.45)] md:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-emerald-300/55">
                      Education Composer
                    </p>
                    <h3 className="mt-3 text-2xl font-semibold text-slate-100">
                      {eduComposerMode === 'create' ? 'Yeni egitim ekle' : 'Egitimi guncelle'}
                    </h3>
                    <p className="mt-3 max-w-xl text-sm leading-7 text-slate-300/78">
                      Bu panel sekme degil, gecici bir egitim ekrani. Kaydedince kapanir ve egitim yolculugunda hemen yerini alir.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeEducationComposer}
                    className={secondaryButtonClass}
                  >
                    Kapat
                  </button>
                </div>

                <div className="mt-8 space-y-4 rounded-[28px] border border-white/8 bg-black/25 p-5 md:p-6">
                  <input value={eduForm.institution} onChange={(event) => setEduForm((v) => ({ ...v, institution: event.target.value }))} className={fieldClass} placeholder="Kurum" />
                  <input value={eduForm.program} onChange={(event) => setEduForm((v) => ({ ...v, program: event.target.value }))} className={fieldClass} placeholder="Program" />
                  <div className="grid gap-4 md:grid-cols-2">
                    <input value={eduForm.degree} onChange={(event) => setEduForm((v) => ({ ...v, degree: event.target.value }))} className={fieldClass} placeholder="Derece / Track" />
                    <select value={eduForm.status} onChange={(event) => setEduForm((v) => ({ ...v, status: event.target.value as PortfolioEducationRecord['status'] }))} className={fieldClass}><option value="completed">completed</option><option value="active">active</option><option value="planned">planned</option><option value="paused">paused</option></select>
                    <input value={eduForm.startDate} onChange={(event) => setEduForm((v) => ({ ...v, startDate: event.target.value }))} className={fieldClass} placeholder="Baslangic" />
                    <input value={eduForm.endDate} onChange={(event) => setEduForm((v) => ({ ...v, endDate: event.target.value }))} className={fieldClass} placeholder="Bitis" />
                  </div>
                  <textarea value={eduForm.description} onChange={(event) => setEduForm((v) => ({ ...v, description: event.target.value }))} rows={6} className={fieldClass} placeholder="Aciklama" />

                  <div className="flex flex-wrap gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => void saveEducation()}
                      disabled={saving}
                      className={primaryButtonClass}
                    >
                      {saving ? 'Kaydediliyor' : eduComposerMode === 'create' ? 'Egitim Ekle' : 'Guncelle'}
                    </button>
                    <button
                      type="button"
                      onClick={closeEducationComposer}
                      disabled={saving}
                      className={secondaryButtonClass}
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
