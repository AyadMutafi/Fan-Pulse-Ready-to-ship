'use client'

import { useState, useEffect } from 'react'
import { ArrowRight, Share2, X } from 'lucide-react'
import type { TransferSagaSummary } from './TransferPulseCard'

// ── Design tokens (from the design plan) ─────────────────────────────────────
// These are the distinctive tokens for the share card — NOT the app's default
// purple-on-dark theme. This is the "Option B" design direction: pitch green,
// off-white background, condensed sporty type.
const TOKENS = {
  bg: '#FAFAF7',
  text: '#0A0A0A',
  pitch: '#00A862',
  pulse: '#FF4D4F',
  muted: '#9CA3AF',
}

interface ShareableTransferCardProps {
  saga: TransferSagaSummary
  onClose?: () => void
}

/**
 * ShareableTransferCard — a visually distinctive card designed for social sharing.
 *
 * Design direction (from frontend-design skill):
 *   - Pitch green (#00A862) — the color of football itself
 *   - Off-white background (#FAFAF7) — like a fresh pitch line marking
 *   - Pulse red (#FF4D4F) — the live heartbeat
 *   - Condensed sporty type (simulated with font-weight + letter-spacing)
 *   - Signature element: the pulse line (heartbeat-style SVG)
 *
 * This card is shown in a modal when the user clicks "Share" on a transfer.
 * It displays: player name, transfer, fan approval %, Fan Pulse score, vote count.
 * Optimized for screenshot + sharing on X/Reddit/Instagram.
 */
export default function ShareableTransferCard({ saga, onClose }: ShareableTransferCardProps) {
  const [voteCounts, setVoteCounts] = useState(
    saga.voteCounts ?? { good: 0, mixed: 0, bad: 0, total: 0 }
  )
  const [copied, setCopied] = useState(false)

  // Fetch fresh vote counts
  useEffect(() => {
    async function fetchVotes() {
      try {
        const res = await fetch(`/api/transfers?status=all&limit=50`)
        if (res.ok) {
          const data = await res.json()
          const found = data.sagas?.find((s: { id: string }) => s.id === saga.id)
          if (found?.voteCounts) {
            setVoteCounts(found.voteCounts)
          }
        }
      } catch {}
    }
    fetchVotes()
  }, [saga.id])

  const total = voteCounts.total
  const goodPct = total > 0 ? Math.round((voteCounts.good / total) * 100) : 0
  const badPct = total > 0 ? Math.round((voteCounts.bad / total) * 100) : 0
  const mixedPct = total > 0 ? Math.round((voteCounts.mixed / total) * 100) : 0
  const pulseScore = total > 0
    ? Math.round(((voteCounts.good * 10 + voteCounts.mixed * 5) / total) * 10) / 10
    : 0

  const approvalLabel =
    goodPct >= 70 ? 'EXCELLENT'
    : goodPct >= 50 ? 'GOOD'
    : goodPct >= 30 ? 'MIXED'
    : 'POOR'

  const approvalEmoji =
    goodPct >= 70 ? '🔥'
    : goodPct >= 50 ? '👍'
    : goodPct >= 30 ? '😐'
    : '👎'

  // Credibility label
  const credibility =
    saga.status === 'completed' ? 'CONFIRMED'
    : saga.status === 'debunked' ? 'DEBUNKED'
    : 'REPORTED'

  async function handleShare() {
    const text = `${saga.playerName} → ${saga.toClubName}\n${goodPct}% of fans approve\nFan Pulse: ${pulseScore}/10\n${total} votes\nVote on Fan Pulse →`
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Fan Pulse — ${saga.playerName}`,
          text,
          url: window.location.href,
        })
      } else {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {}
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: TOKENS.bg }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 size-8 rounded-full bg-black/10 hover:bg-black/20 flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <X className="size-4" style={{ color: TOKENS.text }} />
          </button>
        )}

        {/* ── Signature element: Pulse Line ────────────────────────────────── */}
        {/* Heartbeat-style SVG line that represents live fan sentiment */}
        <svg
          viewBox="0 0 400 40"
          className="w-full h-10"
          preserveAspectRatio="none"
          style={{ background: TOKENS.pitch }}
        >
          <path
            d="M0,20 L80,20 L90,20 L100,5 L110,35 L120,10 L130,20 L200,20 L210,20 L220,8 L230,32 L240,20 L400,20"
            fill="none"
            stroke="white"
            strokeWidth="2"
            opacity="0.9"
          />
        </svg>

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="px-6 pt-5 pb-4">
          {/* Fan Pulse logo */}
          <div className="flex items-center justify-between mb-4">
            <span
              className="text-[10px] font-black tracking-[0.2em] uppercase"
              style={{ color: TOKENS.pulse }}
            >
              ⚡ Fan Pulse
            </span>
            <span
              className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded"
              style={{
                background: saga.status === 'completed' ? 'rgba(0,168,98,0.1)' : 'rgba(156,163,175,0.15)',
                color: saga.status === 'completed' ? TOKENS.pitch : TOKENS.muted,
              }}
            >
              {credibility}
            </span>
          </div>

          {/* Player name + transfer */}
          <h2
            className="text-2xl font-black leading-tight mb-1"
            style={{ color: TOKENS.text, letterSpacing: '-0.02em' }}
          >
            {saga.playerName}
          </h2>

          {/* From → To */}
          <div className="flex items-center gap-2 text-sm mb-2" style={{ color: TOKENS.muted }}>
            <span className="font-medium">{saga.fromClubName || '—'}</span>
            <ArrowRight className="size-3.5" style={{ color: TOKENS.pitch }} />
            <span className="font-bold" style={{ color: TOKENS.text }}>
              {saga.toClubName}
            </span>
          </div>

          {/* Fee */}
          {saga.feeReported && (
            <p className="text-xs mb-3" style={{ color: TOKENS.muted }}>
              Fee: <span className="font-semibold" style={{ color: TOKENS.text }}>{saga.feeReported}</span>
            </p>
          )}

          {/* Source */}
          {saga.topSources?.[0] && (
            <p className="text-[10px] mb-4" style={{ color: TOKENS.muted }}>
              Source: <span className="font-semibold">{saga.topSources[0].journalistName}</span>
              <span className="mx-1">·</span>
              <span>{saga.topSources[0].outlet}</span>
            </p>
          )}
        </div>

        {/* ── The Vote Result (Hero Section) ─────────────────────────────────── */}
        <div
          className="mx-6 mb-5 rounded-xl p-5"
          style={{ background: 'rgba(0,168,98,0.05)', border: '1px solid rgba(0,168,98,0.15)' }}
        >
          {/* Approval percentage — the hero number */}
          <div className="flex items-baseline justify-between mb-3">
            <span className="text-[10px] font-bold tracking-wider uppercase" style={{ color: TOKENS.muted }}>
              Fan Approval
            </span>
            <span className="text-[10px] font-bold tracking-wider" style={{ color: TOKENS.pulse }}>
              {approvalEmoji} {approvalLabel}
            </span>
          </div>

          <div className="flex items-baseline gap-2 mb-4">
            <span
              className="text-5xl font-black"
              style={{ color: goodPct >= 50 ? TOKENS.pitch : TOKENS.pulse, letterSpacing: '-0.03em' }}
            >
              {goodPct}%
            </span>
            <span className="text-sm" style={{ color: TOKENS.muted }}>
              of fans approve
            </span>
          </div>

          {/* Approval bar */}
          <div className="h-3 rounded-full overflow-hidden mb-2" style={{ background: 'rgba(0,0,0,0.06)' }}>
            <div
              className="h-full transition-all duration-700"
              style={{ width: `${goodPct}%`, background: goodPct >= 50 ? TOKENS.pitch : TOKENS.pulse }}
            />
          </div>

          {/* Vote breakdown */}
          <div className="flex items-center justify-between text-[10px] font-semibold" style={{ color: TOKENS.muted }}>
            <span style={{ color: TOKENS.pitch }}>👍 {goodPct}%</span>
            <span>😐 {mixedPct}%</span>
            <span style={{ color: TOKENS.pulse }}>👎 {badPct}%</span>
          </div>
        </div>

        {/* ── Stats Row ──────────────────────────────────────────────────────── */}
        <div className="px-6 pb-4 flex items-center justify-between">
          {/* Fan Pulse score */}
          <div className="text-center">
            <p className="text-[9px] font-bold tracking-wider uppercase" style={{ color: TOKENS.muted }}>
              Fan Pulse
            </p>
            <p className="text-xl font-black" style={{ color: TOKENS.text }}>
              {pulseScore}<span className="text-sm" style={{ color: TOKENS.muted }}>/10</span>
            </p>
          </div>

          {/* Divider */}
          <div className="w-px h-8" style={{ background: 'rgba(0,0,0,0.08)' }} />

          {/* Vote count */}
          <div className="text-center">
            <p className="text-[9px] font-bold tracking-wider uppercase" style={{ color: TOKENS.muted }}>
              Votes
            </p>
            <p className="text-xl font-black" style={{ color: TOKENS.text }}>
              {total.toLocaleString()}
            </p>
          </div>

          {/* Divider */}
          <div className="w-px h-8" style={{ background: 'rgba(0,0,0,0.08)' }} />

          {/* Trend */}
          <div className="text-center">
            <p className="text-[9px] font-bold tracking-wider uppercase" style={{ color: TOKENS.muted }}>
              Buzz
            </p>
            <p className="text-xl font-black" style={{ color: TOKENS.text }}>
              {saga.buzzVolume > 0 ? saga.buzzVolume : '—'}
            </p>
          </div>
        </div>

        {/* ── Share Button ──────────────────────────────────────────────────── */}
        <div className="px-6 pb-6">
          <button
            onClick={handleShare}
            className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90"
            style={{
              background: TOKENS.pitch,
              color: 'white',
            }}
          >
            <Share2 className="size-4" />
            {copied ? 'Copied to clipboard!' : 'Share this result'}
          </button>
          <p className="text-[10px] text-center mt-2" style={{ color: TOKENS.muted }}>
            fanpls.io · Vote at Fan Pulse
          </p>
        </div>
      </div>
    </div>
  )
}
