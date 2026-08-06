'use client'

import type { Trend } from '@/types'

// Sentiment trend is ALWAYS conveyed with an emoji (no bare icon/number).
export function TrendIcon({ trend }: { trend: Trend }) {
  if (trend === 'rising') return <span className="text-sm leading-none" title="Rising">📈</span>
  if (trend === 'falling') return <span className="text-sm leading-none" title="Falling">📉</span>
  return <span className="text-sm leading-none" title="Stable">➡️</span>
}
