'use client'

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { Trend } from '@/types'

export function TrendIcon({ trend }: { trend: Trend }) {
  if (trend === 'rising') return <TrendingUp className="size-3 text-[#10B981]" />
  if (trend === 'falling') return <TrendingDown className="size-3 text-[#EF4444]" />
  return <Minus className="size-3 text-[#FF6B35]" />
}
