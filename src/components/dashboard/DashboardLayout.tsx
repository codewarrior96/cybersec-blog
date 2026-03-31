'use client'

import DashboardLayoutLegacy from '@/components/dashboard/DashboardLayoutLegacy'
import DashboardLayoutV3 from '@/components/dashboard/DashboardLayoutV3'

const SOC_RUNTIME_V3 = process.env.NEXT_PUBLIC_SOC_RUNTIME_V3 !== '0'

export default function DashboardLayout() {
  if (!SOC_RUNTIME_V3) {
    return <DashboardLayoutLegacy />
  }
  return <DashboardLayoutV3 />
}

