import type { Question, QuestionProgress } from '../types'
import { getQuestionProgress } from '../store/useStatsStore'

const MS_PER_DAY = 86_400_000

/** Higher score = higher priority to review next. */
function priorityScore(question: Question, progress: Record<string, QuestionProgress>): number {
  const p = getQuestionProgress(progress, question.id)

  if (p.seen === 0) {
    return 100 + Math.random() * 20
  }

  const accuracy = p.correct / p.seen
  const daysSinceSeen = p.lastSeen ? (Date.now() - p.lastSeen) / MS_PER_DAY : 30
  const score = (1 - accuracy) * 50 + Math.min(daysSinceSeen, 14) * 4 - p.streak * 6
  return Math.max(score, 1) + Math.random() * 10
}

/** Weighted random sample without replacement, favoring unseen / weak / stale questions. */
export function buildSession(
  questions: Question[],
  progress: Record<string, QuestionProgress>,
  count: number,
): Question[] {
  const pool = questions.map((q) => ({ q, weight: priorityScore(q, progress) }))
  const session: Question[] = []

  while (pool.length > 0 && session.length < count) {
    const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0)
    let roll = Math.random() * totalWeight
    let pickIndex = 0
    for (let i = 0; i < pool.length; i++) {
      roll -= pool[i].weight
      if (roll <= 0) {
        pickIndex = i
        break
      }
    }
    session.push(pool[pickIndex].q)
    pool.splice(pickIndex, 1)
  }

  return session
}
