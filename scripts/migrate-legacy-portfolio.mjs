import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { createClient } from '@supabase/supabase-js'

const DEFAULT_BUCKET = 'cybersec-app-state'
const DEMO_USERNAMES = ['ghost', 'analyst1', 'viewer1']

function parseArgs(argv) {
  const args = {
    source: 'ghost',
    target: '',
    apply: false,
    purgeDemoUsers: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const part = argv[index]
    if (part === '--source') args.source = argv[index + 1] ?? args.source
    if (part === '--target') args.target = argv[index + 1] ?? args.target
    if (part === '--apply') args.apply = true
    if (part === '--purge-demo-users') args.purgeDemoUsers = true
  }

  if (!args.target) {
    throw new Error('Hedef kullanici gerekli. Ornek: --target salimaybasti')
  }

  return args
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  const text = fs.readFileSync(filePath, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue
    const separatorIndex = line.indexOf('=')
    if (separatorIndex < 0) continue

    const key = line.slice(0, separatorIndex).trim()
    let value = line.slice(separatorIndex + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}

function normalizeObjectPath(objectPath) {
  return objectPath.replace(/\\/g, '/').replace(/^\/+/, '')
}

function makeId() {
  return Date.now() * 100 + Math.floor(Math.random() * 100)
}

function inferMimeType(assetPath, fallbackMimeType) {
  if (fallbackMimeType) return fallbackMimeType
  const extension = path.extname(assetPath).toLowerCase()
  if (extension === '.png') return 'image/png'
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg'
  if (extension === '.webp') return 'image/webp'
  if (extension === '.pdf') return 'application/pdf'
  return 'application/octet-stream'
}

async function readJsonObject(supabase, bucket, objectPath) {
  const normalized = normalizeObjectPath(objectPath)
  const { data, error } = await supabase.storage.from(bucket).download(normalized)
  if (error) {
    if (/not found|404/i.test(error.message)) return null
    throw new Error(`JSON okuma hatasi (${normalized}): ${error.message}`)
  }
  return JSON.parse(await data.text())
}

async function uploadJsonObject(supabase, bucket, objectPath, value) {
  const normalized = normalizeObjectPath(objectPath)
  const payload = Buffer.from(JSON.stringify(value, null, 2), 'utf8')
  const { error } = await supabase.storage.from(bucket).upload(normalized, payload, {
    upsert: true,
    contentType: 'application/json; charset=utf-8',
    cacheControl: '0',
  })
  if (error) {
    throw new Error(`JSON yazma hatasi (${normalized}): ${error.message}`)
  }
}

async function readBinaryObject(supabase, bucket, objectPath) {
  const normalized = normalizeObjectPath(objectPath)
  const { data, error } = await supabase.storage.from(bucket).download(normalized)
  if (error) {
    if (/not found|404/i.test(error.message)) return null
    throw new Error(`Binary okuma hatasi (${normalized}): ${error.message}`)
  }
  return Buffer.from(await data.arrayBuffer())
}

async function uploadBinaryObject(supabase, bucket, objectPath, buffer, contentType) {
  const normalized = normalizeObjectPath(objectPath)
  const { error } = await supabase.storage.from(bucket).upload(normalized, buffer, {
    upsert: true,
    contentType,
    cacheControl: '3600',
  })
  if (error) {
    throw new Error(`Binary yazma hatasi (${normalized}): ${error.message}`)
  }
}

async function deleteObject(supabase, bucket, objectPath) {
  const normalized = normalizeObjectPath(objectPath)
  const { error } = await supabase.storage.from(bucket).remove([normalized])
  if (error && !/not found|404/i.test(error.message)) {
    throw new Error(`Obje silme hatasi (${normalized}): ${error.message}`)
  }
}

async function listObjectPaths(supabase, bucket, prefix) {
  const normalizedPrefix = normalizeObjectPath(prefix).replace(/\/+$/, '')
  const segments = normalizedPrefix.split('/').filter(Boolean)
  const parentPath = segments.slice(0, -1).join('/')

  const { data, error } = await supabase.storage.from(bucket).list(normalizedPrefix, {
    limit: 1000,
    sortBy: { column: 'name', order: 'asc' },
  })

  if (!error) {
    return (data ?? [])
      .filter((item) => item.name)
      .map((item) => `${normalizedPrefix}/${item.name}`)
  }

  const { data: parentData, error: parentError } = await supabase.storage.from(bucket).list(parentPath, {
    limit: 1000,
    sortBy: { column: 'name', order: 'asc' },
  })
  if (parentError) {
    if (/not found|404/i.test(parentError.message)) return []
    throw new Error(`Listeleme hatasi (${normalizedPrefix}): ${parentError.message}`)
  }

  return (parentData ?? [])
    .filter((item) => item.name)
    .map((item) => (parentPath ? `${parentPath}/${item.name}` : item.name))
    .filter((item) => item.startsWith(`${normalizedPrefix}/`) || item === normalizedPrefix)
}

async function deletePrefix(supabase, bucket, prefix) {
  const paths = await listObjectPaths(supabase, bucket, prefix)
  for (const item of paths) {
    await deleteObject(supabase, bucket, item)
  }
  return paths
}

function makeAvatarPath(userId, originalName, mimeType) {
  const extension = path.extname(originalName).toLowerCase() || (
    mimeType === 'image/png'
      ? '.png'
      : mimeType === 'image/webp'
        ? '.webp'
        : '.jpg'
  )
  const safeName = path.basename(originalName, path.extname(originalName)).replace(/[^a-zA-Z0-9._-]/g, '-') || 'avatar'
  return `avatars/user-${userId}/${Date.now()}-${randomUUID()}-${safeName}${extension}`
}

function makeCertificationPath(userId, originalName, mimeType) {
  const extension = path.extname(originalName).toLowerCase() || (
    mimeType === 'application/pdf'
      ? '.pdf'
      : mimeType === 'image/png'
        ? '.png'
        : mimeType === 'image/webp'
          ? '.webp'
          : '.jpg'
  )
  const safeName = path.basename(originalName, path.extname(originalName)).replace(/[^a-zA-Z0-9._-]/g, '-') || 'certificate'
  return `certifications/user-${userId}/${Date.now()}-${randomUUID()}-${safeName}${extension}`
}

async function cloneAssetIfNeeded(supabase, bucket, userId, input, kind) {
  if (!input?.assetPath) return null

  const buffer = await readBinaryObject(supabase, bucket, input.assetPath)
  if (!buffer) return null

  const mimeType = inferMimeType(input.assetPath, input.assetMimeType)
  const originalName = input.assetName ?? path.basename(input.assetPath)
  const targetPath =
    kind === 'avatar'
      ? makeAvatarPath(userId, originalName, mimeType)
      : makeCertificationPath(userId, originalName, mimeType)

  await uploadBinaryObject(supabase, bucket, targetPath, buffer, mimeType)
  return {
    assetPath: targetPath,
    assetName: originalName,
    assetMimeType: mimeType,
    assetSize: kind === 'certification' ? buffer.byteLength : undefined,
  }
}

async function readUserBundle(supabase, bucket, username) {
  const user = await readJsonObject(supabase, bucket, `state/users/by-username/${username.toLowerCase()}.json`)
  if (!user) return null

  const profile = await readJsonObject(supabase, bucket, `state/profiles/${user.id}/profile.json`)
  const certificationPaths = await listObjectPaths(supabase, bucket, `state/profiles/${user.id}/certifications`)
  const educationPaths = await listObjectPaths(supabase, bucket, `state/profiles/${user.id}/education`)
  const avatarPaths = await listObjectPaths(supabase, bucket, `avatars/user-${user.id}`)

  const certifications = (
    await Promise.all(
      certificationPaths
        .filter((item) => item.endsWith('.json'))
        .map((item) => readJsonObject(supabase, bucket, item)),
    )
  ).filter(Boolean)

  const education = (
    await Promise.all(
      educationPaths
        .filter((item) => item.endsWith('.json'))
        .map((item) => readJsonObject(supabase, bucket, item)),
    )
  ).filter(Boolean)

  return {
    user,
    profile,
    certifications,
    education,
    avatarPaths,
    certificationPaths,
    educationPaths,
  }
}

async function main() {
  loadEnvFile(path.join(process.cwd(), '.env.local'))

  const args = parseArgs(process.argv.slice(2))
  const bucket = process.env.SUPABASE_APP_STATE_BUCKET || DEFAULT_BUCKET
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase baglantisi icin gerekli env degiskenleri eksik.')
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const sourceBundle = await readUserBundle(supabase, bucket, args.source)
  const targetBundle = await readUserBundle(supabase, bucket, args.target)

  if (!targetBundle) {
    throw new Error(`Hedef kullanici bulunamadi: ${args.target}`)
  }

  const backupDir = path.join(process.cwd(), 'tmp')
  fs.mkdirSync(backupDir, { recursive: true })
  const backupPath = path.join(
    backupDir,
    `portfolio-migration-${Date.now()}-${args.source}-to-${args.target}.json`,
  )

  fs.writeFileSync(
    backupPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: sourceBundle,
        target: targetBundle,
      },
      null,
      2,
    ),
    'utf8',
  )

  const summary = {
    backupPath,
    sourceUserId: sourceBundle?.user?.id ?? null,
    targetUserId: targetBundle.user.id,
    copiedSpecialties: false,
    copiedTools: false,
    copiedAvatar: false,
    copiedCertifications: 0,
    copiedEducation: 0,
    removedUsers: [],
  }

  if (!args.apply) {
    console.log(JSON.stringify({ dryRun: true, ...summary }, null, 2))
    return
  }

  const targetProfile = targetBundle.profile ?? {
    headline: `${targetBundle.user.displayName} / Profil`,
    bio: `${targetBundle.user.displayName} icin olusturulmus duzenlenebilir profil alani.`,
    location: '',
    website: '',
    specialties: [],
    tools: [],
    avatarPath: null,
    avatarName: null,
    avatarMimeType: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  if (sourceBundle?.profile) {
    if ((targetProfile.specialties?.length ?? 0) === 0 && sourceBundle.profile.specialties?.length) {
      targetProfile.specialties = [...sourceBundle.profile.specialties]
      summary.copiedSpecialties = true
    }
    if ((targetProfile.tools?.length ?? 0) === 0 && sourceBundle.profile.tools?.length) {
      targetProfile.tools = [...sourceBundle.profile.tools]
      summary.copiedTools = true
    }
    if (!targetProfile.avatarPath && sourceBundle.profile.avatarPath) {
      const clonedAvatar = await cloneAssetIfNeeded(
        supabase,
        bucket,
        targetBundle.user.id,
        {
          assetPath: sourceBundle.profile.avatarPath,
          assetName: sourceBundle.profile.avatarName,
          assetMimeType: sourceBundle.profile.avatarMimeType,
        },
        'avatar',
      )
      if (clonedAvatar) {
        targetProfile.avatarPath = clonedAvatar.assetPath
        targetProfile.avatarName = clonedAvatar.assetName
        targetProfile.avatarMimeType = clonedAvatar.assetMimeType
        summary.copiedAvatar = true
      }
    }
  }

  targetProfile.updatedAt = new Date().toISOString()
  await uploadJsonObject(supabase, bucket, `state/profiles/${targetBundle.user.id}/profile.json`, targetProfile)

  if ((targetBundle.certifications?.length ?? 0) === 0 && sourceBundle?.certifications?.length) {
    for (const certification of sourceBundle.certifications) {
      const nextId = makeId()
      const clonedAsset = await cloneAssetIfNeeded(
        supabase,
        bucket,
        targetBundle.user.id,
        {
          assetPath: certification.assetPath,
          assetName: certification.assetName,
          assetMimeType: certification.assetMimeType,
        },
        'certification',
      )

      const createdAt = new Date().toISOString()
      const nextRecord = {
        ...certification,
        id: nextId,
        userId: targetBundle.user.id,
        assetPath: clonedAsset?.assetPath ?? certification.assetPath ?? null,
        assetName: clonedAsset?.assetName ?? certification.assetName ?? null,
        assetMimeType: clonedAsset?.assetMimeType ?? certification.assetMimeType ?? null,
        assetSize: clonedAsset?.assetSize ?? certification.assetSize ?? null,
        createdAt,
        updatedAt: createdAt,
      }
      await uploadJsonObject(
        supabase,
        bucket,
        `state/profiles/${targetBundle.user.id}/certifications/${nextId}.json`,
        nextRecord,
      )
      await uploadJsonObject(
        supabase,
        bucket,
        `state/indexes/certifications/${nextId}.json`,
        { id: nextId, userId: targetBundle.user.id },
      )
      summary.copiedCertifications += 1
    }
  }

  if ((targetBundle.education?.length ?? 0) === 0 && sourceBundle?.education?.length) {
    for (const item of sourceBundle.education) {
      const nextId = makeId()
      const createdAt = new Date().toISOString()
      const nextRecord = {
        ...item,
        id: nextId,
        userId: targetBundle.user.id,
        createdAt,
        updatedAt: createdAt,
      }
      await uploadJsonObject(
        supabase,
        bucket,
        `state/profiles/${targetBundle.user.id}/education/${nextId}.json`,
        nextRecord,
      )
      summary.copiedEducation += 1
    }
  }

  await uploadJsonObject(
    supabase,
    bucket,
    `state/audit/${Date.now()}-${randomUUID()}-portfolio-legacy-migration.json`,
    {
      action: 'portfolio.legacy.migrate',
      createdAt: new Date().toISOString(),
      details: {
        sourceUsername: args.source,
        targetUsername: args.target,
        copiedSpecialties: summary.copiedSpecialties,
        copiedTools: summary.copiedTools,
        copiedAvatar: summary.copiedAvatar,
        copiedCertifications: summary.copiedCertifications,
        copiedEducation: summary.copiedEducation,
      },
    },
  )

  if (args.purgeDemoUsers) {
    for (const username of DEMO_USERNAMES) {
      const demoBundle = await readUserBundle(supabase, bucket, username)
      if (!demoBundle) continue

      await deletePrefix(supabase, bucket, `state/profiles/${demoBundle.user.id}/certifications`)
      await deletePrefix(supabase, bucket, `state/profiles/${demoBundle.user.id}/education`)
      await deletePrefix(supabase, bucket, `avatars/user-${demoBundle.user.id}`)
      await deleteObject(supabase, bucket, `state/profiles/${demoBundle.user.id}/profile.json`)
      await deleteObject(supabase, bucket, `state/users/by-id/${demoBundle.user.id}.json`)
      await deleteObject(supabase, bucket, `state/users/by-username/${username.toLowerCase()}.json`)
      summary.removedUsers.push(username)
    }
  }

  console.log(JSON.stringify(summary, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
