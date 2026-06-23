'use client'

import { useState } from 'react'
import { Share2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface SharePulseButtonProps {
  className?: string
  /** Optional override for the URL to share. Defaults to current page URL. */
  url?: string
  /** Optional share text (used as the Web Share API `text` and appended to copied URL). */
  text?: string
  /** Optional override for the share title. */
  title?: string
}

/**
 * SharePulseButton — the #1 organic growth loop in the marketing plan.
 *
 * Uses the Web Share API on mobile (native share sheet) with a clipboard
 * fallback on desktop. Shows a toast confirmation either way.
 *
 * Previously this was a dead button with no onClick. Now every tap either
 * opens the native share sheet or copies a branded link — feeding the
 * "share → visit → vote" funnel.
 */
export function SharePulseButton({
  className = '',
  url,
  text = 'Check out the live Fan Mood for World Cup 2026 on Fan Pulse',
  title = 'Fan Pulse — Real-Time Fan Sentiment',
}: SharePulseButtonProps) {
  const [shared, setShared] = useState(false)

  const handleShare = async () => {
    const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '')
    const shareData = { title, text, url: shareUrl }

    try {
      // Native share sheet (mobile + browsers that support Web Share API)
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share(shareData)
        setShared(true)
        setTimeout(() => setShared(false), 2000)
        return
      }

      // Clipboard fallback (desktop)
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(`${shareUrl}\n${text}`)
        toast.success('Link copied to clipboard!', {
          description: 'Paste it anywhere to share the Fan Pulse.',
        })
        setShared(true)
        setTimeout(() => setShared(false), 2000)
        return
      }

      // Last-resort: legacy execCommand
      const ta = document.createElement('textarea')
      ta.value = `${shareUrl}\n${text}`
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      toast.success('Link copied!')
      setShared(true)
      setTimeout(() => setShared(false), 2000)
    } catch (err) {
      // navigator.share throws AbortError if user cancels — that's fine, no toast.
      if (err instanceof Error && err.name !== 'AbortError') {
        toast.error('Could not share — please copy the URL manually.')
      }
    }
  }

  return (
    <Button
      size="sm"
      onClick={handleShare}
      className={`bg-[#6C2BD9] hover:bg-[#5A1FBF] text-white gap-1.5 text-[11px] font-bold h-8 rounded-lg ${className}`}
    >
      {shared ? <Check className="size-3" /> : <Share2 className="size-3" />}
      {shared ? 'Shared' : 'Share Pulse'}
    </Button>
  )
}
