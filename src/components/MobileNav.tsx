'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { logoutAuth, useAuthStatus } from '@/lib/auth-client'

const mobileItems = [
  { label: 'Home', href: '/' },
  { label: 'Blog', href: '/blog' },
  { label: 'Community', href: '/community' },
  { label: 'CVE', href: '/cve-radar' },
]

interface MobileNavProps {
  initialAuth?: boolean | null
}

export default function MobileNav({ initialAuth = null }: MobileNavProps) {
  return null
}
