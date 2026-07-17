import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { topics } from '../data/topics'
import { allQuestions, questionsByTopic } from '../data/questions'
import { useStatsStore } from '../store/useStatsStore'
import { overallAccuracy, topicAccuracy, currentStreak } from '../lib/stats'
import { TopicCard } from '../components/TopicCard'
import type { TopicId } from '../types'

export function Home() {
  const navigate = useNavigate()
  const progress = useStatsStore((s) => s.progress)
  const practiceDays = useStatsStore((s) => s.practiceDays)
  const [selected, setSelected] = useState<Set<TopicId>>(new Set(topics.map((t) => t.id)))

  const overall = useMemo(() => overallAccuracy(allQuestions, progress), [progress])
  const streak = useMemo(() => currentStreak(practiceDays), [practiceDays])

  function toggleTopic(id: TopicId) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        if (next.size > 1) next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function startSession() {
    navigate('/practice', { state: { topicIds: [...selected] } })
  }

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-28">
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">MatPrac</h1>
          {streak > 0 && (
            <div className="flex items-center gap-1.5 rounded-full bg-orange-500/10 text-orange-500 px-3 py-1 text-sm font-semibold">
              🔥 {streak} day{streak === 1 ? '' : 's'}
            </div>
          )}
        </div>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          {overall.seen > 0
            ? `${overall.seen} cards reviewed · ${Math.round((overall.accuracy ?? 0) * 100)}% lifetime accuracy`
            : 'Stay sharp on the math behind the models.'}
        </p>
      </header>

      <div className="mb-4">
        <h2 className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 mb-3">Topics</h2>
        <div className="grid grid-cols-2 gap-3">
          {topics.map((topic) => (
            <TopicCard
              key={topic.id}
              topic={topic}
              stats={topicAccuracy(questionsByTopic, topic.id, progress)}
              total={questionsByTopic.get(topic.id)?.length ?? 0}
              selected={selected.has(topic.id)}
              onToggle={() => toggleTopic(topic.id)}
            />
          ))}
        </div>
      </div>

      <button
        onClick={startSession}
        className="fixed bottom-20 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md rounded-2xl bg-indigo-600 text-white font-semibold py-4 text-base shadow-lg shadow-indigo-600/25 active:scale-[0.98] transition-transform"
      >
        Start practice ({selected.size} topic{selected.size === 1 ? '' : 's'})
      </button>
    </div>
  )
}
