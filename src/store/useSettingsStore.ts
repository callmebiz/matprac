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

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      aiTutorEnabled: false,
      endpoint: 'http://localhost:11434/v1',
      model: 'llama3.1',
      setAiTutorEnabled: (aiTutorEnabled) => set({ aiTutorEnabled }),
      setEndpoint: (endpoint) => set({ endpoint }),
      setModel: (model) => set({ model }),
    }),
    { name: 'matprac-settings' },
  ),
)
