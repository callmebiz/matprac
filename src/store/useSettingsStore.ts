import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsStore {
  aiTutorEnabled: boolean
  endpoint: string
  model: string
  /** How long to wait for the model to start responding before giving up -- see localProvider.ts. */
  patienceMinutes: number
  setAiTutorEnabled: (enabled: boolean) => void
  setEndpoint: (endpoint: string) => void
  setModel: (model: string) => void
  setPatienceMinutes: (minutes: number) => void
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
      patienceMinutes: 10,
      setAiTutorEnabled: (aiTutorEnabled) => set({ aiTutorEnabled }),
      setEndpoint: (endpoint) => set({ endpoint }),
      setModel: (model) => set({ model }),
      setPatienceMinutes: (patienceMinutes) => set({ patienceMinutes }),
    }),
    { name: 'matprac-settings' },
  ),
)
