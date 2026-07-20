import type { Question, QuestionProgress } from '../types'
import { getQuestionProgress } from './progress'

const MS_PER_DAY = 86_400_000
const MIN_EASE = 1.3
const DEFAULT_EASE = 2.5

/**
 * Simplified binary SM-2: the app only has a two-way "Missed it / Got it" grade (also what the
 * swipe gesture maps to), so this collapses SM-2's 0-5 quality scale to two points -- fail (1) and
 * good (4) -- rather than adding Hard/Easy buttons the rest of the UI doesn't have. Still real
 * spaced repetition: ease and interval genuinely grow on success and reset on failure.
 */
export function sm2Update(
  prev: QuestionProgress,
  correct: boolean,
  now: number,
): Pick<QuestionProgress, 'easeFactor' | 'intervalDays' | 'dueAt'> {
  const quality = correct ? 4 : 1
  const prevEase = prev.easeFactor ?? DEFAULT_EASE
  const easeFactor = Math.max(MIN_EASE, prevEase + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)))

  const prevInterval = prev.intervalDays ?? 0
  let intervalDays: number
  if (!correct) {
    intervalDays = 0 // due again immediately -- failing resets the schedule
  } else if (prevInterval === 0) {
    intervalDays = 1
  } else if (prevInterval === 1) {
    intervalDays = 6
  } else {
    intervalDays = Math.round(prevInterval * easeFactor)
  }

  return { easeFactor, intervalDays, dueAt: now + intervalDays * MS_PER_DAY }
}

/** True if a question has never been seen, or its SM-2 schedule says it's due now. */
export function isDue(question: Question, progress: Record<string, QuestionProgress>, now = Date.now()): boolean {
  const p = getQuestionProgress(progress, question.id)
  if (p.seen === 0) return true
  return p.dueAt == null || p.dueAt <= now
}

function weightedSample<T>(items: T[], weightFn: (item: T) => number, count: number): T[] {
  const pool = items.map((item) => ({ item, weight: Math.max(weightFn(item), 0.01) }))
  const result: T[] = []
  while (pool.length > 0 && result.length < count) {
    const total = pool.reduce((sum, x) => sum + x.weight, 0)
    let roll = Math.random() * total
    let pickIndex = 0
    for (let i = 0; i < pool.length; i++) {
      roll -= pool[i].weight
      if (roll <= 0) {
        pickIndex = i
        break
      }
    }
    result.push(pool[pickIndex].item)
    pool.splice(pickIndex, 1)
  }
  return result
}

/**
 * Builds a session prioritizing what's actually due (unseen or past its SM-2 due date), weighted
 * toward the most overdue and away from cards on a hot streak. Only backfills with not-yet-due
 * cards (soonest-due first) if there aren't enough due cards to fill the requested count -- a
 * session should reflect what's actually due, not just shuffle the whole pool every time.
 */
export function buildSession(questions: Question[], progress: Record<string, QuestionProgress>, count: number): Question[] {
  const now = Date.now()
  const withState = questions.map((q) => {
    const p = getQuestionProgress(progress, q.id)
    return { q, p, unseen: p.seen === 0, due: isDue(q, progress, now) }
  })

  const due = withState.filter((x) => x.due)
  const notDue = withState.filter((x) => !x.due)

  const session = weightedSample(due, (x) => {
    if (x.unseen) return 100 + Math.random() * 20
    const overdueDays = x.p.dueAt ? Math.max(0, (now - x.p.dueAt) / MS_PER_DAY) : 14
    return 20 + Math.min(overdueDays, 14) * 5 - x.p.streak * 2 + Math.random() * 10
  }, count)

  if (session.length < count) {
    const backfill = [...notDue].sort((a, b) => (a.p.dueAt ?? Infinity) - (b.p.dueAt ?? Infinity)).slice(0, count - session.length)
    session.push(...backfill)
  }

  return session.map((x) => x.q)
}
