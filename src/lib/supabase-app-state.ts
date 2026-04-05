import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const SUPABASE_APP_STATE_BUCKET = process.env.SUPABASE_APP_STATE_BUCKET ?? 'cybersec-app-state'

let supabaseClient: SupabaseClient | null = null
let ensureBucketPromise: Promise<void> | null = null

export function isSupabaseAppStateEnabled() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
}

function getSupabaseClient() {
  if (!isSupabaseAppStateEnabled()) return null
  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  }
  return supabaseClient
}

export function getSupabaseAppStateBucket() {
  return SUPABASE_APP_STATE_BUCKET
}

export async function ensureSupabaseAppStateBucket(): Promise<void> {
  const client = getSupabaseClient()
  if (!client) {
    throw new Error('Supabase app state store is not configured.')
  }

  if (!ensureBucketPromise) {
    ensureBucketPromise = (async () => {
      const { data: existing, error: getError } = await client.storage.getBucket(SUPABASE_APP_STATE_BUCKET)
      if (existing && !getError) return

      const { error: createError } = await client.storage.createBucket(SUPABASE_APP_STATE_BUCKET, {
        public: false,
        fileSizeLimit: '50MB',
      })

      if (createError && !/already exists/i.test(createError.message)) {
        throw new Error(`supabase bucket create failed: ${createError.message}`)
      }
    })()
  }

  return ensureBucketPromise
}

function normalizeObjectPath(objectPath: string) {
  return objectPath.replace(/\\/g, '/').replace(/^\/+/, '')
}

export async function uploadJsonObject<T>(objectPath: string, value: T): Promise<void> {
  const client = getSupabaseClient()
  if (!client) {
    throw new Error('Supabase app state store is not configured.')
  }

  await ensureSupabaseAppStateBucket()
  const normalized = normalizeObjectPath(objectPath)
  const payload = Buffer.from(JSON.stringify(value, null, 2), 'utf8')

  const { error } = await client.storage
    .from(SUPABASE_APP_STATE_BUCKET)
    .upload(normalized, payload, {
      upsert: true,
      contentType: 'application/json; charset=utf-8',
      cacheControl: '0',
    })

  if (error) {
    throw new Error(`supabase json upload failed: ${error.message}`)
  }
}

export async function readJsonObject<T>(objectPath: string): Promise<T | null> {
  const client = getSupabaseClient()
  if (!client) return null

  await ensureSupabaseAppStateBucket()
  const normalized = normalizeObjectPath(objectPath)
  const { data, error } = await client.storage.from(SUPABASE_APP_STATE_BUCKET).download(normalized)

  if (error) {
    if (/not found|404/i.test(error.message)) {
      return null
    }
    throw new Error(`supabase json read failed: ${error.message}`)
  }

  const text = await data.text()
  return JSON.parse(text) as T
}

export async function uploadBinaryObject(
  objectPath: string,
  value: Buffer,
  contentType: string,
): Promise<void> {
  const client = getSupabaseClient()
  if (!client) {
    throw new Error('Supabase app state store is not configured.')
  }

  await ensureSupabaseAppStateBucket()
  const normalized = normalizeObjectPath(objectPath)
  const { error } = await client.storage
    .from(SUPABASE_APP_STATE_BUCKET)
    .upload(normalized, value, {
      upsert: true,
      contentType,
      cacheControl: '3600',
    })

  if (error) {
    throw new Error(`supabase binary upload failed: ${error.message}`)
  }
}

export async function readBinaryObject(objectPath: string): Promise<Buffer | null> {
  const client = getSupabaseClient()
  if (!client) return null

  await ensureSupabaseAppStateBucket()
  const normalized = normalizeObjectPath(objectPath)
  const { data, error } = await client.storage.from(SUPABASE_APP_STATE_BUCKET).download(normalized)

  if (!error) {
    const arrayBuffer = await data.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  const { data: signedData, error: signedError } = await client.storage
    .from(SUPABASE_APP_STATE_BUCKET)
    .createSignedUrl(normalized, 60)

  if (signedError || !signedData?.signedUrl) {
    if (/not found|404/i.test(error.message)) {
      return null
    }
    throw new Error(`supabase binary read failed: ${signedError?.message ?? error.message}`)
  }

  const response = await fetch(signedData.signedUrl, { cache: 'no-store' })
  if (response.status === 404) {
    return null
  }
  if (!response.ok) {
    throw new Error(`supabase signed fetch failed: ${response.status}`)
  }

  return Buffer.from(await response.arrayBuffer())
}

export async function createSignedObjectUrl(
  objectPath: string,
  expiresInSeconds = 60,
): Promise<string | null> {
  const client = getSupabaseClient()
  if (!client) return null

  await ensureSupabaseAppStateBucket()
  const normalized = normalizeObjectPath(objectPath)
  const { data, error } = await client.storage
    .from(SUPABASE_APP_STATE_BUCKET)
    .createSignedUrl(normalized, expiresInSeconds)

  if (error) {
    if (/not found|404/i.test(error.message)) {
      return null
    }
    throw new Error(`supabase signed url failed: ${error.message}`)
  }

  return data?.signedUrl ?? null
}

export async function deleteObject(objectPath: string | null | undefined): Promise<void> {
  if (!objectPath) return

  const client = getSupabaseClient()
  if (!client) return

  await ensureSupabaseAppStateBucket()
  const normalized = normalizeObjectPath(objectPath)
  const { error } = await client.storage.from(SUPABASE_APP_STATE_BUCKET).remove([normalized])
  if (error && !/not found|404/i.test(error.message)) {
    throw new Error(`supabase delete failed: ${error.message}`)
  }
}

export async function listObjectPaths(prefix: string): Promise<string[]> {
  const client = getSupabaseClient()
  if (!client) return []

  await ensureSupabaseAppStateBucket()
  const normalizedPrefix = normalizeObjectPath(prefix).replace(/\/+$/, '')
  const segments = normalizedPrefix.split('/').filter(Boolean)
  const parentPath = segments.slice(0, -1).join('/')
  const leaf = segments.at(-1) ?? ''

  const { data, error } = await client.storage.from(SUPABASE_APP_STATE_BUCKET).list(normalizedPrefix, {
    limit: 1000,
    sortBy: { column: 'name', order: 'asc' },
  })

  if (error) {
    const { data: parentData, error: parentError } = await client.storage
      .from(SUPABASE_APP_STATE_BUCKET)
      .list(parentPath, {
        limit: 1000,
        sortBy: { column: 'name', order: 'asc' },
      })

    if (parentError) {
      if (/not found|404/i.test(parentError.message)) {
        return []
      }
      throw new Error(`supabase list failed: ${parentError.message}`)
    }

    return (parentData ?? [])
      .filter((item) => item.name)
      .filter((item) => item.name.endsWith('.json'))
      .filter((item) => item.name.startsWith(`${leaf}/`) === false)
      .map((item) => (parentPath ? `${parentPath}/${item.name}` : item.name))
      .filter((item) => item.startsWith(`${normalizedPrefix}/`) || item === normalizedPrefix)
  }

  return (data ?? [])
    .filter((item) => item.name)
    .map((item) => `${normalizedPrefix}/${item.name}`)
}
