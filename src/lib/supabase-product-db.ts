import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

let supabaseClient: SupabaseClient | null = null

async function noStoreSupabaseFetch(input: RequestInfo | URL, init?: RequestInit) {
  const nextConfig = {
    ...((init as RequestInit & { next?: Record<string, unknown> } | undefined)?.next ?? {}),
    revalidate: 0,
  }

  return fetch(input, {
    ...init,
    cache: 'no-store',
    next: nextConfig,
  } as RequestInit)
}

export function isSupabaseProductDbEnabled() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
}

export function getSupabaseProductDbClient() {
  if (!isSupabaseProductDbEnabled()) return null

  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        fetch: noStoreSupabaseFetch,
      },
    })
  }

  return supabaseClient
}
