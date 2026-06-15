'use client'

import { Badge } from '@/components/ui/badge'

export function LiveBadge() {
  return (
    <Badge className="bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/30 gap-1 text-[10px] font-bold">
      <span className="live-dot" style={{ width: 6, height: 6 }} />
      LIVE
    </Badge>
  )
}
