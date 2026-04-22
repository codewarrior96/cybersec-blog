import { randomUUID } from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import {
  deleteObject as deleteSupabaseObject,
  isSupabaseAppStateEnabled,
  readBinaryObject,
  uploadBinaryObject,
} from '@/lib/supabase-app-state'

const PROFILE_ASSET_ROOT = path.join(process.cwd(), 'data', 'profile-assets')
const CERTIFICATION_ASSET_ROOT = path.join(PROFILE_ASSET_ROOT, 'certifications')
const AVATAR_ASSET_ROOT = path.join(PROFILE_ASSET_ROOT, 'avatars')

const MIME_EXTENSION_MAP: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
}

const ALLOWED_CERTIFICATION_MIME_TYPES = new Set(Object.keys(MIME_EXTENSION_MAP))
const ALLOWED_AVATAR_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_CERTIFICATION_ASSET_BYTES = 10 * 1024 * 1024
const MAX_AVATAR_ASSET_BYTES = 5 * 1024 * 1024

function detectMagicMimeType(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg'
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png'
  }
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp'
  }
  if (
    buffer.length >= 5 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d
  ) {
    return 'application/pdf'
  }
  return null
}

function assertMagicMatches(buffer: Buffer, declaredMime: string, allowed: Set<string>): void {
  const actualMime = detectMagicMimeType(buffer)
  if (!actualMime || !allowed.has(actualMime) || actualMime !== declaredMime) {
    throw new Error('Dosya icerigi beyan edilen turle eslesmiyor.')
  }
}

export interface StoredCertificationAsset {
  assetPath: string
  assetName: string
  assetMimeType: string
  assetSize: number
}

export interface StoredAvatarAsset {
  assetPath: string
  assetName: string
  assetMimeType: string
}

function sanitizePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9-_]/g, '-')
}

function sanitizeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '-')
}

function getFileExtension(fileName: string, mimeType: string): string {
  const parsed = path.extname(fileName).toLowerCase()
  if (parsed) return parsed
  return MIME_EXTENSION_MAP[mimeType] ?? ''
}

export function isSupportedCertificationMimeType(mimeType: string): boolean {
  return ALLOWED_CERTIFICATION_MIME_TYPES.has(mimeType)
}

export function getCertificationAssetUrl(certificationId: number): string {
  return `/api/profile/certifications/assets/${certificationId}`
}

export function getAvatarAssetUrl(userId: number): string {
  return `/api/profile/avatar/${userId}`
}

export async function saveCertificationAsset(
  userId: number,
  file: File,
): Promise<StoredCertificationAsset> {
  const mimeType = file.type || 'application/octet-stream'
  if (!isSupportedCertificationMimeType(mimeType)) {
    throw new Error('Desteklenmeyen sertifika dosya turu.')
  }
  if (file.size <= 0) {
    throw new Error('Bos dosya yuklenemez.')
  }
  if (file.size > MAX_CERTIFICATION_ASSET_BYTES) {
    throw new Error('Sertifika dosyasi en fazla 10 MB olabilir.')
  }

  const userSegment = sanitizePathSegment(`user-${userId}`)
  const directory = path.join(CERTIFICATION_ASSET_ROOT, userSegment)

  const safeBaseName = sanitizeFileName(path.basename(file.name, path.extname(file.name))) || 'certificate'
  const extension = getFileExtension(file.name, mimeType)
  const fileName = `${Date.now()}-${randomUUID()}-${safeBaseName}${extension}`
  const buffer = Buffer.from(await file.arrayBuffer())
  assertMagicMatches(buffer, mimeType, ALLOWED_CERTIFICATION_MIME_TYPES)
  const assetPath = path.posix.join('certifications', userSegment, fileName)

  if (isSupabaseAppStateEnabled()) {
    await uploadBinaryObject(assetPath, buffer, mimeType)
  } else {
    await fs.mkdir(directory, { recursive: true })
    const absolutePath = path.join(directory, fileName)
    await fs.writeFile(absolutePath, buffer)
  }

  return {
    assetPath,
    assetName: file.name,
    assetMimeType: mimeType,
    assetSize: file.size,
  }
}

export async function saveAvatarAsset(
  userId: number,
  file: File,
): Promise<StoredAvatarAsset> {
  const mimeType = file.type || 'application/octet-stream'
  if (!ALLOWED_AVATAR_MIME_TYPES.has(mimeType)) {
    throw new Error('Profil fotografisi yalnizca JPG, PNG veya WEBP olabilir.')
  }
  if (file.size <= 0) {
    throw new Error('Bos dosya yuklenemez.')
  }
  if (file.size > MAX_AVATAR_ASSET_BYTES) {
    throw new Error('Profil fotografisi en fazla 5 MB olabilir.')
  }

  const userSegment = sanitizePathSegment(`user-${userId}`)
  const directory = path.join(AVATAR_ASSET_ROOT, userSegment)

  const safeBaseName = sanitizeFileName(path.basename(file.name, path.extname(file.name))) || 'avatar'
  const extension = getFileExtension(file.name, mimeType)
  const fileName = `${Date.now()}-${randomUUID()}-${safeBaseName}${extension}`
  const buffer = Buffer.from(await file.arrayBuffer())
  assertMagicMatches(buffer, mimeType, ALLOWED_AVATAR_MIME_TYPES)
  const assetPath = path.posix.join('avatars', userSegment, fileName)

  if (isSupabaseAppStateEnabled()) {
    await uploadBinaryObject(assetPath, buffer, mimeType)
  } else {
    await fs.mkdir(directory, { recursive: true })
    const absolutePath = path.join(directory, fileName)
    await fs.writeFile(absolutePath, buffer)
  }

  return {
    assetPath,
    assetName: file.name,
    assetMimeType: mimeType,
  }
}

export function resolveStoredAssetPath(assetPath: string): string {
  const normalized = assetPath.replace(/\\/g, '/').replace(/^\/+/, '')
  const absolutePath = path.resolve(PROFILE_ASSET_ROOT, normalized)
  const rootWithSep = `${PROFILE_ASSET_ROOT}${path.sep}`
  if (absolutePath !== PROFILE_ASSET_ROOT && !absolutePath.startsWith(rootWithSep)) {
    throw new Error('Gecersiz asset yolu.')
  }
  return absolutePath
}

export async function readStoredAsset(assetPath: string): Promise<Buffer | null> {
  if (isSupabaseAppStateEnabled()) {
    return readBinaryObject(assetPath)
  }

  try {
    return await fs.readFile(resolveStoredAssetPath(assetPath))
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
    if (code === 'ENOENT') {
      return null
    }
    throw error
  }
}

export async function deleteStoredAsset(assetPath: string | null | undefined): Promise<void> {
  if (!assetPath) return

  if (isSupabaseAppStateEnabled()) {
    await deleteSupabaseObject(assetPath)
    return
  }

  try {
    await fs.unlink(resolveStoredAssetPath(assetPath))
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
    if (code !== 'ENOENT') {
      throw error
    }
  }
}
