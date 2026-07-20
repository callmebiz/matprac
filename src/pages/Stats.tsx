import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { topics } from '../data/topics'
import { allQuestions, questionsByTopic } from '../data/questions'
import { useStatsStore } from '../store/useStatsStore'
import { overallAccuracy, topicAccuracy, currentStreak, cardsMastered, dueCount, weakestSubtopics } from '../lib/stats'
import { topicTheme } from '../lib/theme'

export function Stats() {
  const navigate = useNavigate()
  const progress = useStatsStore((s) => s.progress)
  const practiceDays = useStatsStore((s) => s.practiceDays)
  const resetAll = useStatsStore((s) => s.resetAll)
  const [confirmingReset, setConfirmingReset] = useState(false)

  const overall = useMemo(() => overallAccuracy(allQuestions, progress), [progress])
  const streak = useMemo(() => currentStreak(practiceDays), [practiceDays])
  const mastered = useMemo(() => cardsMastered(allQuestions, progress), [progress])
  const due = useMemo(() => dueCount(allQuestions, progress), [progress])
  const weakest = useMemo(() => weakestSubtopics(allQuestions, progress, 5), [progress])

  function practiceSubtopic(subtopic: string) {
    const questions = allQuestions.filter((q) => q.subtopic === subtopic)
    if (questions.length === 0) return
    navigate('/practice', { state: { questions } })
  }

  function generateMoreOn(subtopic: string) {
    navigate('/create', { state: { prefill: subtopic } })
  }

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-28">
      <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-6">Stats</h1>

      <div className="grid grid-cols-2 gap-3 mb-8">
        <StatTile label="Streak" value={`${streak}d`} />
        <StatTile
          label="Accuracy"
          value={overall.accuracy !== null ? `${Math.round(overall.accuracy * 100)}%` : '—'}
        />
        <StatTile label="Mastered" value={`${mastered}/${allQuestions.length}`} />
        <StatTile label="Due for review" value={`${due}`} />
      </div>

      <div className="mb-8">
        <h2 className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 mb-3">By topic</h2>
        <div className="flex flex-col gap-3">
          {topics.map((topic) => {
            const stats = topicAccuracy(questionsByTopic, topic.id, progress)
            const theme = topicTheme[topic.id]
            const total = questionsByTopic.get(topic.id)?.length ?? 0
            const pct = stats.accuracy !== null ? Math.round(stats.accuracy * 100) : null
            return (
              <div key={topic.id} className="rounded-2xl border border-neutral-900/10 dark:border-white/10 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    {topic.shortName}
                  </span>
                  <span className="text-sm text-neutral-500 dark:text-neutral-400">
                    {pct !== null ? `${pct}%` : 'Not started'}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-neutral-900/10 dark:bg-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${theme.bg}`}
                    style={{ width: pct !== null ? `${pct}%` : '0%' }}
                  />
                </div>
                <div className="text-xs text-neutral-400 dark:text-neutral-500 mt-1.5">
                  {stats.seen} reviews · {total} cards
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {weakest.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 mb-3">Focus areas</h2>
          <div className="flex flex-col gap-2">
            {weakest.map((row) => (
              <div key={row.subtopic} className="rounded-xl bg-neutral-900/[0.03] dark:bg-white/[0.04] px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-neutral-800 dark:text-neutral-200">{row.subtopic}</span>
                  <span className="text-sm font-semibold text-red-500">{Math.round(row.accuracy * 100)}%</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => practiceSubtopic(row.subtopic)}
                    className="flex-1 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-semibold py-1.5"
                  >
                    Practice
                  </button>
                  <button
                    onClick={() => generateMoreOn(row.subtopic)}
                    className="flex-1 rounded-lg border border-neutral-900/10 dark:border-white/10 text-neutral-600 dark:text-neutral-300 text-xs font-semibold py-1.5"
                  >
                    Generate more →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="pt-4 border-t border-neutral-900/10 dark:border-white/10">
        {confirmingReset ? (
          <div className="flex gap-3">
            <button
              onClick={() => setConfirmingReset(false)}
              className="flex-1 rounded-2xl border border-neutral-900/10 dark:border-white/10 font-semibold py-3 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                resetAll()
                setConfirmingReset(false)
              }}
              className="flex-1 rounded-2xl bg-red-500 text-white font-semibold py-3 text-sm"
            >
              Confirm reset
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmingReset(true)}
            className="text-sm text-red-500 font-medium"
          >
            Reset all progress
          </button>
        )}
      </div>
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-neutral-900/[0.03] dark:bg-white/[0.04] p-4 text-center">
      <div className="text-lg font-bold text-neutral-900 dark:text-neutral-100">{value}</div>
      <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{label}</div>
    </div>
  )
}
