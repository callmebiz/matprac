import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { QuestionProgress, StatsState } from '../types'
import { sm2Update } from '../lib/srs'
import { emptyProgress } from '../lib/progress'

export { getQuestionProgress } from '../lib/progress'

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

interface StatsStore extends StatsState {
  recordAttempt: (questionId: string, correct: boolean) => void
  resetAll: () => void
}

export const useStatsStore = create<StatsStore>()(
  persist(
    (set, get) => ({
      progress: {},
      practiceDays: [],

      recordAttempt: (questionId, correct) => {
        const state = get()
        const prev = state.progress[questionId] ?? emptyProgress()
        const now = Date.now()
        const next: QuestionProgress = {
          seen: prev.seen + 1,
          correct: prev.correct + (correct ? 1 : 0),
          incorrect: prev.incorrect + (correct ? 0 : 1),
          lastSeen: now,
          streak: correct ? prev.streak + 1 : 0,
          ...sm2Update(prev, correct, now),
        }
        const today = todayKey()
        const practiceDays = state.practiceDays.includes(today)
          ? state.practiceDays
          : [...state.practiceDays, today].sort()

        set({
          progress: { ...state.progress, [questionId]: next },
          practiceDays,
        })
      },

      resetAll: () => set({ progress: {}, practiceDays: [] }),
    }),
    { name: 'matprac-stats' },
  ),
)
