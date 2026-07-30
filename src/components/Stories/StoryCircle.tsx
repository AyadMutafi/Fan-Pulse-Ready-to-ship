'use client'

import { motion } from 'framer-motion'
import type { PulseStory } from '@/lib/story-generator'

interface StoryCircleProps {
  stories: PulseStory[]
  viewedIds: Set<string>
  onOpen: (startIndex: number) => void
}

/**
 * Horizontal row of circular story thumbnails — the entry point to Story Mode.
 *
 * - Unviewed stories: full-color gradient border (purple → orange).
 * - Viewed stories: muted gray border.
 * - Each circle shows the story's emoji; the label below shows a short title.
 * - Click → opens StoryViewer at that story's index.
 *
 * Positioned at the top of the Home tab (above Match Sentiments).
 */
export default function StoryCircle({ stories, viewedIds, onOpen }: StoryCircleProps) {
  if (!stories || stories.length === 0) return null

  return (
    <section aria-label="Today's Pulse Stories">
      {/* Header */}
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#666] dark:text-[#CCCCCC] flex items-center gap-1.5">
            <span className="inline-block size-1.5 rounded-full bg-gradient-to-br from-[#6C2BD9] to-[#FF6B35]" />
            Today&apos;s Pulse Stories
          </h3>
          <p className="mt-0.5 text-[11px] text-[#6B7280] dark:text-gray-400">Tap to play · auto-refresh daily</p>
        </div>
        <span className="text-[10px] font-semibold text-[#FF6B35]">
          {stories.length} stories
        </span>
      </div>

      {/* Horizontal scroll of story circles */}
      <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1 -mx-1 px-1">
        {stories.map((story, i) => {
          const viewed = viewedIds.has(story.id)
          return (
            <motion.button
              key={story.id}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              onClick={() => onOpen(i)}
              aria-label={`Open story: ${story.title}`}
              className="group relative flex shrink-0 flex-col items-center focus-visible:ring-2 focus-visible:ring-[#6C2BD9] focus-visible:ring-offset-2 rounded-xl"
            >
              {/* Circle with gradient border (unviewed) or gray border (viewed) */}
              <div
                className={`relative size-16 rounded-full p-[2.5px] transition-transform group-hover:scale-105 group-active:scale-95 ${
                  viewed
                    ? 'bg-gray-300 dark:bg-gray-700'
                    : 'bg-gradient-to-tr from-[#6C2BD9] via-[#8B5CF6] to-[#FF6B35]'
                }`}
              >
                {/* Inner circle — frosted glass with emoji */}
                <div className="flex size-full items-center justify-center rounded-full bg-white dark:bg-[#1A1A1A] overflow-hidden">
                  <span className="text-2xl leading-none">{story.emoji}</span>
                </div>

                {/* Unviewed indicator dot (top-right) */}
                {!viewed && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-[#FF6B35] ring-2 ring-white dark:ring-[#1A1A1A]"
                  />
                )}
              </div>

              {/* Label below */}
              <span className="mt-1.5 max-w-[64px] truncate text-center text-[10px] font-semibold text-[#666] dark:text-[#CCCCCC]">
                {story.title}
              </span>
            </motion.button>
          )
        })}

        {/* Trailing spacer so the last circle isn't flush against the edge */}
        <div className="shrink-0 w-1" aria-hidden="true" />
      </div>
    </section>
  )
}
