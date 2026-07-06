'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getPulseScoreColor, type PulseScore } from '@/types'

interface PulseScoreRingProps {
  pulseScore: PulseScore
  size?: number
  showBreakdown?: boolean
}

const WEIGHTS = [
  { key: 'matchPerformance', label: 'Match Perf.', weight: '40%', color: '#6C2BD9' },
  { key: 'fanSentiment', label: 'Fan Sent.', weight: '25%', color: '#FF6B35' },
  { key: 'aiNarrative', label: 'AI Narr.', weight: '20%', color: '#10B981' },
  { key: 'momentumTrend', label: 'Momentum', weight: '15%', color: '#F59E0B' },
] as const

export default function PulseScoreRing({ pulseScore, size = 80, showBreakdown = false }: PulseScoreRingProps) {
  const [expanded, setExpanded] = useState(false)
  const score = pulseScore.overall / 10 // Convert 0-100 to 0-10
  const color = getPulseScoreColor(pulseScore.overall)
  const strokeWidth = size * 0.08
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progress = (pulseScore.overall / 100) * circumference

  return (
    <div className="flex flex-col items-center">
      {/* Circular Ring */}
      <div
        className="relative cursor-pointer"
        style={{ width: size, height: size }}
        onClick={() => showBreakdown && setExpanded(!expanded)}
      >
        {/* Background circle */}
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-[#E0E0E0] dark:text-white/10"
          />
          {/* Progress circle */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference - progress }}
            transition={{ duration: 1, ease: 'easeOut' }}
            style={{
              filter: pulseScore.overall >= 90 ? `drop-shadow(0 0 6px ${color})` : undefined,
            }}
          />
        </svg>
        {/* Score text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="font-black leading-none"
            style={{ color, fontSize: size * 0.22 }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            {score.toFixed(1)}
          </motion.span>
          <span className="text-[8px] font-bold text-[#666] dark:text-[#CCCCCC]">PULSE</span>
        </div>
      </div>

      {/* Sub-score bars (always visible when showBreakdown) */}
      {showBreakdown && (
        <div className="mt-3 w-full space-y-2">
          {WEIGHTS.map((w, i) => {
            const value = pulseScore[w.key]
            const note = pulseScore[`${w.key}Note` as keyof PulseScore] as string
            return (
              <motion.div
                key={w.key}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.8 + i * 0.2 }}
                className="group"
              >
                <div className="flex items-center justify-between text-[10px] mb-0.5">
                  <span className="font-semibold text-[#666] dark:text-[#CCCCCC]">
                    {w.label} <span className="text-[#999]">({w.weight})</span>
                  </span>
                  <span className="font-bold" style={{ color: w.color }}>
                    {value}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-[#F0F0F0] dark:bg-white/10 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: w.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${value}%` }}
                    transition={{ duration: 0.6, delay: 1 + i * 0.2 }}
                  />
                </div>
                {/* Expandable note on hover */}
                <AnimatePresence>
                  {expanded && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-[9px] text-[#999] mt-1 leading-relaxed"
                    >
                      {note}
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
