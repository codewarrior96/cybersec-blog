import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

let supabaseClient: SupabaseClient | null = null

async function noStoreSupabaseFetch(input: RequestInfo | URL, init?: RequestInit) {
  const typedInit = (init ?? {}) as RequestInit & { next?: Record<string, unknown> }
  const { next, ...requestInit } = typedInit
  const nextConfig: Record<string, unknown> = { ...(next ?? {}) }
  delete nextConfig.revalidate

  const fetchInit: RequestInit & { next?: Record<string, unknown> } = {
    ...requestInit,
    cache: 'no-store',
  }

  if (Object.keys(nextConfig).length > 0) {
    fetchInit.next = nextConfig
  }

  return fetch(input, fetchInit as RequestInit)
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
