import type { QuestionProgress } from '../types'

export function emptyProgress(): QuestionProgress {
  return { seen: 0, correct: 0, incorrect: 0, lastSeen: null, streak: 0, easeFactor: 2.5, intervalDays: 0, dueAt: null }
}

export function getQuestionProgress(progress: Record<string, QuestionProgress>, questionId: string): QuestionProgress {
  return progress[questionId] ?? emptyProgress()
}
