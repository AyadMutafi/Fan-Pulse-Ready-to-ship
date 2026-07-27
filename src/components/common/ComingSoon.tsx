'use client'

import { motion } from 'framer-motion'
import { Lock, Construction } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useLanguage } from '@/context/LanguageContext'

interface ComingSoonProps {
  tabName: string
}

export function ComingSoon({ tabName }: ComingSoonProps) {
  const { t } = useLanguage()

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex items-center justify-center min-h-[50vh]"
    >
      <Card className="border-[#E0E0E0]/50 dark:border-white/5 max-w-sm w-full shadow-[0_2px_4px_rgba(0,0,0,0.05)] dark:shadow-none">
        <CardContent className="p-8 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-[#6C2BD9]/10 dark:bg-[#6C2BD9]/20">
            <Construction className="size-7 text-[#6C2BD9] dark:text-[#8B5CF6]" />
          </div>
          <h3 className="text-lg font-bold text-[#1A1A1A] dark:text-white mb-2">
            {tabName}
          </h3>
          <p className="text-sm text-[#666] dark:text-[#CCCCCC] mb-4">
            This section is being built with care. It needs more work to match the FanPulse standard.
          </p>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#F8F9FA] dark:bg-[#2D2D2D] px-3 py-1.5 text-xs font-semibold text-[#6B7280] dark:text-gray-400 border border-[#E0E0E0] dark:border-white/10">
            <Lock className="size-3" />
            COMING SOON
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
