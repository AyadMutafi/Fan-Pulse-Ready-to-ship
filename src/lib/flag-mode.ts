import { create } from 'zustand'

type FlagMode = 'flag' | 'emoji'

interface FlagModeState {
  mode: FlagMode
  toggle: () => void
  setMode: (mode: FlagMode) => void
}

export const useFlagMode = create<FlagModeState>((set) => ({
  mode: 'flag',
  toggle: () => set((s) => ({ mode: s.mode === 'flag' ? 'emoji' : 'flag' })),
  setMode: (mode) => set({ mode }),
}))
