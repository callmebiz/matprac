import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsStore {
  aiTutorEnabled: boolean
  endpoint: string
  model: string
  setAiTutorEnabled: (enabled: boolean) => void
  setEndpoint: (endpoint: string) => void
  setModel: (model: string) => void
}

export function isAiTutorReady(state: Pick<SettingsStore, 'aiTutorEnabled' | 'endpoint' | 'model'>): boolean {
  return state.aiTutorEnabled && state.endpoint.trim() !== '' && state.model.trim() !== ''
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      aiTutorEnabled: false,
      endpoint: '',
      model: '',
      setAiTutorEnabled: (aiTutorEnabled) => set({ aiTutorEnabled }),
      setEndpoint: (endpoint) => set({ endpoint }),
      setModel: (model) => set({ model }),
    }),
    { name: 'matprac-settings' },
  ),
)
