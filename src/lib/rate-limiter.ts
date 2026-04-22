interface RateLimitEntry {
  count: number
  resetAt: number
}

interface RateLimitBucket {
  store: Map<string, RateLimitEntry>
}

const GLOBAL_KEY = Symbol.for('soc.rate.limiter.buckets')

type Globals = typeof globalThis & {
  [GLOBAL_KEY]?: Map<string, RateLimitBucket>
}

function buckets(): Map<string, RateLimitBucket> {
  const g = globalThis as Globals
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = new Map()
  }
  return g[GLOBAL_KEY]!
}

function getBucket(name: string): RateLimitBucket {
  const map = buckets()
  let bucket = map.get(name)
  if (!bucket) {
    bucket = { store: new Map() }
    map.set(name, bucket)
  }
  return bucket
}

export interface RateLimitOptions {
  bucket: string
  max: number
  windowMs: number
}

export interface RateLimitResult {
  limited: boolean
  remaining: number
  resetAt: number
}

export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const { store } = getBucket(options.bucket)
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    return { limited: false, remaining: options.max, resetAt: now + options.windowMs }
  }

  return {
    limited: entry.count >= options.max,
    remaining: Math.max(0, options.max - entry.count),
    resetAt: entry.resetAt,
  }
}

export function recordFailure(key: string, options: RateLimitOptions): RateLimitResult {
  const { store } = getBucket(options.bucket)
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    const next: RateLimitEntry = { count: 1, resetAt: now + options.windowMs }
    store.set(key, next)
    return { limited: false, remaining: options.max - 1, resetAt: next.resetAt }
  }

  entry.count++
  return {
    limited: entry.count >= options.max,
    remaining: Math.max(0, options.max - entry.count),
    resetAt: entry.resetAt,
  }
}

export function clearAttempts(key: string, bucketName: string): void {
  getBucket(bucketName).store.delete(key)
}

export function __resetAllForTests(): void {
  const g = globalThis as Globals
  g[GLOBAL_KEY] = new Map()
}
