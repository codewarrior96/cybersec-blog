'use client'

interface OperatorSidebarProps {
  initialAuth?: boolean | null
}

export default function OperatorSidebar(_props: OperatorSidebarProps) {
  // Sidebar intentionally disabled in V3. Navigation is handled inside the dashboard shell.
  return null
}
