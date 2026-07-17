import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { questionsByTopic } from '../data/questions'
import { topicById } from '../data/topics'
import { useStatsStore } from '../store/useStatsStore'
import { useSettingsStore } from '../store/useSettingsStore'
import { buildSession } from '../lib/srs'
import { getLocalProvider, LlmError } from '../llm'
import { Flashcard } from '../components/Flashcard'
import type { Question, TopicId } from '../types'

const SESSION_SIZE = 15

export function Practice() {
  const location = useLocation()
  const navigate = useNavigate()
  const progress = useStatsStore((s) => s.progress)
  const recordAttempt = useStatsStore((s) => s.recordAttempt)
  const aiTutorEnabled = useSettingsStore((s) => s.aiTutorEnabled)
  const endpoint = useSettingsStore((s) => s.endpoint)
  const model = useSettingsStore((s) => s.model)

  const topicIds = (location.state as { topicIds?: TopicId[] } | null)?.topicIds ?? null

  const [session, setSession] = useState(() => {
    if (!topicIds || topicIds.length === 0) return []
    const pool = topicIds.flatMap((id) => questionsByTopic.get(id) ?? [])
    return buildSession(pool, progress, Math.min(SESSION_SIZE, pool.length))
  })

  const [index, setIndex] = useState(0)
  const [sessionCorrect, setSessionCorrect] = useState(0)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')

  const current = session[index]
  const done = index >= session.length

  function handleGrade(correct: boolean) {
    if (!current) return
    recordAttempt(current.id, correct)
    if (correct) setSessionCorrect((c) => c + 1)
    setIndex((i) => i + 1)
  }

  async function handleGenerate() {
    if (!topicIds || topicIds.length === 0) return
    setGenerating(true)
    setGenerateError('')
    try {
      const topicId = topicIds[Math.floor(Math.random() * topicIds.length)]
      const topic = topicById.get(topicId)
      const subtopics = [...new Set((questionsByTopic.get(topicId) ?? []).map((q) => q.subtopic))]
      const difficulty = (Math.floor(Math.random() * 3) + 1) as 1 | 2 | 3

      const generated = await getLocalProvider(endpoint, model).generateQuestion({
        topicName: topic?.name ?? topicId,
        subtopics,
        difficulty,
      })

      const newQuestion: Question = {
        id: `gen-${Date.now()}`,
        topicId,
        subtopic: 'AI-generated',
        difficulty,
        prompt: generated.prompt,
        answer: generated.answer,
        explanation: generated.explanation,
      }

      setSession((s) => {
        const next = [...s]
        next.splice(index, 0, newQuestion)
        return next
      })
    } catch (err) {
      setGenerateError(err instanceof LlmError ? err.message : 'Could not generate a question.')
    } finally {
      setGenerating(false)
    }
  }

  if (!topicIds || session.length === 0) {
    return (
      <div className="max-w-md mx-auto px-4 pt-8 pb-28 text-center">
        <p className="text-neutral-500 dark:text-neutral-400 mb-4">No session to show. Pick a topic first.</p>
        <button
          onClick={() => navigate('/')}
          className="rounded-2xl bg-indigo-600 text-white font-semibold px-6 py-3"
        >
          Back home
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 pt-6 pb-10 min-h-full flex flex-col">
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={() => navigate('/')}
          aria-label="Exit session"
          className="h-9 w-9 rounded-full flex items-center justify-center text-neutral-500 dark:text-neutral-400 bg-neutral-900/5 dark:bg-white/10"
        >
          ✕
        </button>
        <div className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
          {done ? session.length : index + 1} / {session.length}
        </div>
        {aiTutorEnabled && !done ? (
          <button
            onClick={handleGenerate}
            disabled={generating}
            aria-label="Generate a new question"
            className="h-9 w-9 rounded-full flex items-center justify-center text-indigo-500 bg-indigo-500/10 disabled:opacity-40"
          >
            {generating ? '…' : '✨'}
          </button>
        ) : (
          <div className="w-9" />
        )}
      </div>

      <div className="h-1.5 rounded-full bg-neutral-900/10 dark:bg-white/10 mb-3 overflow-hidden">
        <div
          className="h-full rounded-full bg-indigo-600 transition-all duration-300"
          style={{ width: `${(Math.min(index, session.length) / session.length) * 100}%` }}
        />
      </div>

      {generateError && <p className="text-xs text-red-500 mb-3">{generateError}</p>}

      {done ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
          <div className="text-5xl">{sessionCorrect / session.length >= 0.8 ? '🎯' : '💪'}</div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">Session complete</h2>
          <p className="text-neutral-500 dark:text-neutral-400">
            {sessionCorrect} / {session.length} correct ({Math.round((sessionCorrect / session.length) * 100)}%)
          </p>
          <div className="flex gap-3 mt-2 w-full">
            <button
              onClick={() => navigate('/')}
              className="flex-1 rounded-2xl border border-neutral-900/10 dark:border-white/10 font-semibold py-3.5"
            >
              Home
            </button>
            <button
              onClick={() => navigate('/practice', { state: { topicIds }, replace: true })}
              className="flex-1 rounded-2xl bg-indigo-600 text-white font-semibold py-3.5"
            >
              Practice again
            </button>
          </div>
        </div>
      ) : (
        <Flashcard key={current.id} question={current} onGrade={handleGrade} />
      )}
    </div>
  )
}
