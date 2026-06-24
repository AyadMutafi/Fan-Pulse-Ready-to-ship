'use client'

import { useState } from 'react'
import { Download, Share2, Loader2, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'

interface FanCardButtonProps {
  teamCode: string
  score: number
  className?: string
}

/**
 * FanCardButton — fetches a branded PNG fan card from /api/fan-card and either:
 *   1. Shares it via the Web Share API (mobile — native share sheet with file),
 *   2. Downloads it directly (desktop fallback).
 *
 * This is the #1 organic growth loop from the marketing plan: every fan who
 * votes gets a screenshot-worthy, branded image they can post to their stories
 * or feeds. Each share = free distribution with a Fan Pulse watermark + URL.
 */
export function FanCardButton({ teamCode, score, className = '' }: FanCardButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleGetCard = async () => {
    setLoading(true)
    try {
      // Fetch the PNG from the API
      const res = await fetch(`/api/fan-card?team=${teamCode}&score=${score}`)
      if (!res.ok) throw new Error(`Failed to generate card (${res.status})`)

      const blob = await res.blob()
      const fileName = `fan-pulse-${teamCode.toLowerCase()}-${score}.png`

      // Try Web Share API with file (mobile — opens native share sheet)
      if (navigator.canShare && navigator.canShare({ files: [new File([blob], fileName, { type: 'image/png' })] })) {
        try {
          await navigator.share({
            title: `My Fan Pulse — ${teamCode}`,
            text: `I voted for ${teamCode} on Fan Pulse. See live fan mood for World Cup 2026!`,
            files: [new File([blob], fileName, { type: 'image/png' })],
          })
          toast.success('Shared!', { description: 'Your Fan Card has been shared.' })
          return
        } catch (err) {
          // User cancelled share — fall through to download
          if (err instanceof Error && err.name === 'AbortError') return
        }
      }

      // Desktop fallback: trigger download
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success('Fan Card downloaded!', {
        description: `Share ${fileName} to your stories or feed.`,
      })
    } catch (err) {
      console.error('Fan card generation failed:', err)
      toast.error('Could not generate Fan Card', {
        description: 'Please try again in a moment.',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleGetCard}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 rounded-full bg-[#6C2BD9] hover:bg-[#5A1FBF] text-white px-3 py-1.5 text-[11px] font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
    >
      {loading ? (
        <>
          <Loader2 className="size-3 animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <ImageIcon className="size-3" />
          Get Fan Card
        </>
      )}
    </button>
  )
}
