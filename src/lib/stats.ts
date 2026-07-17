import type { Question, QuestionProgress, TopicId } from '../types'
import { getQuestionProgress } from '../store/useStatsStore'

export interface AccuracySummary {
  seen: number
  correct: number
  accuracy: number | null
}

function summarize(questions: Question[], progress: Record<string, QuestionProgress>): AccuracySummary {
  let seen = 0
  let correct = 0
  for (const q of questions) {
    const p = getQuestionProgress(progress, q.id)
    seen += p.seen
    correct += p.correct
  }
  return { seen, correct, accuracy: seen > 0 ? correct / seen : null }
}

export function overallAccuracy(allQuestions: Question[], progress: Record<string, QuestionProgress>): AccuracySummary {
  return summarize(allQuestions, progress)
}

export function topicAccuracy(
  questionsByTopic: Map<string, Question[]>,
  topicId: TopicId,
  progress: Record<string, QuestionProgress>,
): AccuracySummary {
  return summarize(questionsByTopic.get(topicId) ?? [], progress)
}

export function cardsMastered(allQuestions: Question[], progress: Record<string, QuestionProgress>): number {
  return allQuestions.filter((q) => {
    const p = getQuestionProgress(progress, q.id)
    return p.streak >= 3
  }).length
}

export function weakestSubtopics(
  questions: Question[],
  progress: Record<string, QuestionProgress>,
  limit = 3,
): { subtopic: string; accuracy: number; seen: number }[] {
  const bySubtopic = new Map<string, Question[]>()
  for (const q of questions) {
    const list = bySubtopic.get(q.subtopic) ?? []
    list.push(q)
    bySubtopic.set(q.subtopic, list)
  }

  const rows = [...bySubtopic.entries()]
    .map(([subtopic, qs]) => {
      const s = summarize(qs, progress)
      return { subtopic, accuracy: s.accuracy ?? -1, seen: s.seen }
    })
    .filter((r) => r.seen > 0)

  rows.sort((a, b) => a.accuracy - b.accuracy)
  return rows.slice(0, limit)
}

/** Consecutive-day practice streak ending today or yesterday (still "alive" if today hasn't happened yet). */
export function currentStreak(practiceDays: string[]): number {
  if (practiceDays.length === 0) return 0
  const days = new Set(practiceDays)
  const cursor = new Date()
  let streak = 0

  const todayStr = cursor.toISOString().slice(0, 10)
  if (!days.has(todayStr)) {
    // allow streak to still count if yesterday was practiced; otherwise it's broken
    cursor.setDate(cursor.getDate() - 1)
  }

  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}
