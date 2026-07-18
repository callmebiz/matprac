import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Question } from '../types'

interface QuestionBankStore {
  questions: Record<string, Question>
  addQuestions: (questions: Question[]) => void
  removeQuestion: (id: string) => void
  clearAll: () => void
}

// Kept in its own localStorage key (separate from stats/settings) so accumulating a generated
// question bank never bloats the write on every single practice attempt.
export const useQuestionBankStore = create<QuestionBankStore>()(
  persist(
    (set) => ({
      questions: {},

      addQuestions: (newQuestions) =>
        set((state) => {
          const questions = { ...state.questions }
          for (const q of newQuestions) questions[q.id] = q
          return { questions }
        }),

      removeQuestion: (id) =>
        set((state) => {
          const questions = { ...state.questions }
          delete questions[id]
          return { questions }
        }),

      clearAll: () => set({ questions: {} }),
    }),
    { name: 'matprac-question-bank' },
  ),
)
