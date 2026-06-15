'use client'

import { Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function SharePulseButton({ className = '' }: { className?: string }) {
  return (
    <Button
      size="sm"
      className={`bg-[#6C2BD9] hover:bg-[#5A1FBF] text-white gap-1.5 text-[11px] font-bold h-8 rounded-lg ${className}`}
    >
      <Share2 className="size-3" />
      Share Pulse
    </Button>
  )
}
