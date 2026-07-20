import { useRef, useState } from 'react'
import type { Question } from '../types'
import { MathText } from './MathText'
import { getTopicTheme } from '../lib/theme'
import { questionTopicLabel } from '../data/topics'
import { useSettingsStore, isAiTutorReady } from '../store/useSettingsStore'
import { getLocalProvider, LlmError } from '../llm'
import type { GradeResult } from '../llm'
import { ConversationThread } from './ConversationThread'

interface FlashcardProps {
  question: Question
  onGrade: (correct: boolean) => void
}

const difficultyDots = { 1: 1, 2: 2, 3: 3 } as const

type CardState = 'question' | 'grading' | 'graded' | 'revealed' | 'error'

const verdictStyle: Record<GradeResult['verdict'], { label: string; className: string }> = {
  correct: { label: 'Correct', className: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30' },
  partial: { label: 'Partially right', className: 'text-amber-500 bg-amber-500/10 border-amber-500/30' },
  incorrect: { label: 'Not quite', className: 'text-red-500 bg-red-500/10 border-red-500/30' },
}

const SWIPE_THRESHOLD = 80

function vibrate(pattern: number | number[]) {
  navigator.vibrate?.(pattern)
}

export function Flashcard({ question, onGrade }: FlashcardProps) {
  const [state, setState] = useState<CardState>('question')
  const [typedAnswer, setTypedAnswer] = useState('')
  const [gradeResult, setGradeResult] = useState<GradeResult | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [pendingFollowUp, setPendingFollowUp] = useState<string | null>(null)
  const [dragX, setDragX] = useState(0)
  const dragStart = useRef<{ x: number; y: number } | null>(null)

  const aiTutorEnabled = useSettingsStore(isAiTutorReady)
  const endpoint = useSettingsStore((s) => s.endpoint)
  const model = useSettingsStore((s) => s.model)
  const patienceMinutes = useSettingsStore((s) => s.patienceMinutes)

  const theme = getTopicTheme(question.topicId)
  const topicLabel = questionTopicLabel(question)

  function grade(correct: boolean) {
    vibrate(15)
    onGrade(correct)
    setState('question')
    setTypedAnswer('')
    setGradeResult(null)
    setPendingFollowUp(null)
    setDragX(0)
  }

  // Swipe-to-grade, active only once the answer/grade buttons are showing. Tracks both axes so a
  // mostly-vertical drag (page scroll) never gets hijacked into a horizontal card-swipe.
  function handleTouchStart(e: React.TouchEvent) {
    if (!showAnswerBlock) return
    const t = e.touches[0]
    dragStart.current = { x: t.clientX, y: t.clientY }
  }
  function handleTouchMove(e: React.TouchEvent) {
    if (!dragStart.current) return
    const t = e.touches[0]
    const dx = t.clientX - dragStart.current.x
    const dy = t.clientY - dragStart.current.y
    if (Math.abs(dx) > Math.abs(dy)) setDragX(dx)
  }
  function handleTouchEnd() {
    if (!dragStart.current) return
    dragStart.current = null
    if (dragX > SWIPE_THRESHOLD) grade(true)
    else if (dragX < -SWIPE_THRESHOLD) grade(false)
    else setDragX(0)
  }

  // Skipping straight to the answer shouldn't also lock you out of the chat -- seed a minimal,
  // never-displayed grade result so ConversationThread has context to work with.
  function showAnswer() {
    setState('revealed')
    if (aiTutorEnabled) {
      setGradeResult({ verdict: 'incorrect', feedback: 'Skipped straight to the answer without attempting it.' })
    }
  }

  async function checkAnswer() {
    setState('grading')
    try {
      const result = await getLocalProvider(endpoint, model, patienceMinutes * 60_000).gradeAnswer({
        prompt: question.prompt,
        expectedAnswer: question.answer,
        explanation: question.explanation,
        userAnswer: typedAnswer,
      })
      setGradeResult(result)
      setState('graded')
    } catch (err) {
      setErrorMessage(err instanceof LlmError ? err.message : 'Something went wrong reaching the model.')
      setState('error')
    }
  }

  const showAnswerBlock = state === 'graded' || state === 'revealed'

  return (
    <div className="flex flex-col gap-4">
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `translateX(${dragX}px) rotate(${dragX / 24}deg)`,
          transition: dragStart.current ? 'none' : 'transform 0.25s ease',
        }}
        className={`relative rounded-3xl border ${theme.border} ${theme.bgSoft} p-6 min-h-[280px] flex flex-col`}
      >
        {showAnswerBlock && dragX !== 0 && (
          <div
            className={`pointer-events-none absolute inset-0 rounded-3xl flex items-center justify-center text-lg font-bold ${
              dragX > 0 ? 'text-emerald-500' : 'text-red-500'
            }`}
            style={{ opacity: Math.min(Math.abs(dragX) / SWIPE_THRESHOLD, 1) * 0.85 }}
          >
            <div className={`rounded-2xl px-6 py-3 ${dragX > 0 ? 'bg-emerald-500/15' : 'bg-red-500/15'}`}>
              {dragX > 0 ? 'Got it' : 'Missed it'}
            </div>
          </div>
        )}
        <div className="flex items-start justify-between gap-3 mb-4">
          <span className={`text-xs font-semibold uppercase tracking-wide ${theme.text}`}>
            {topicLabel} · {question.subtopic}
          </span>
          <span className="flex gap-1 shrink-0 mt-0.5" aria-label={`Difficulty ${question.difficulty} of 3`}>
            {[1, 2, 3].map((d) => (
              <span
                key={d}
                className={`h-1.5 w-1.5 rounded-full ${
                  d <= difficultyDots[question.difficulty] ? theme.bg : 'bg-neutral-300 dark:bg-neutral-700'
                }`}
              />
            ))}
          </span>
        </div>

        <div className="flex-1 flex items-center justify-center text-center px-1">
          <div className="text-lg leading-relaxed text-neutral-900 dark:text-neutral-100">
            <MathText text={question.prompt} />
          </div>
        </div>

        {aiTutorEnabled && state === 'question' && (
          <textarea
            value={typedAnswer}
            onChange={(e) => setTypedAnswer(e.target.value)}
            placeholder="Type your answer…"
            rows={3}
            className="mt-4 w-full rounded-xl border border-neutral-900/10 dark:border-white/10 bg-white/60 dark:bg-black/20 px-3.5 py-2.5 text-sm text-neutral-900 dark:text-neutral-100 resize-none"
          />
        )}

        {state !== 'question' && typedAnswer.trim() && (
          <div className="mt-4 pt-4 border-t border-neutral-900/10 dark:border-white/10 text-left">
            <div className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 mb-1">Your answer</div>
            <div className="text-sm text-neutral-700 dark:text-neutral-300">
              <MathText text={typedAnswer} />
            </div>
          </div>
        )}

        {state === 'graded' && gradeResult && (
          <div className="mt-5 pt-5 border-t border-neutral-900/10 dark:border-white/10 text-left">
            <div className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold mb-3 ${verdictStyle[gradeResult.verdict].className}`}>
              {verdictStyle[gradeResult.verdict].label}
            </div>
            <div className="text-sm text-neutral-700 dark:text-neutral-300 mb-3">
              <MathText text={gradeResult.feedback} />
            </div>
            {gradeResult.followUp && (
              <button
                onClick={() => setPendingFollowUp(gradeResult.followUp ?? null)}
                className="block w-full text-left text-sm text-neutral-500 dark:text-neutral-400 italic mb-3 underline decoration-dotted underline-offset-4"
              >
                <MathText text={gradeResult.followUp} /> <span className="not-italic">— tap to ask</span>
              </button>
            )}
          </div>
        )}

        {showAnswerBlock && (
          <div
            className={`text-left ${state === 'graded' ? '' : 'mt-5 pt-5 border-t border-neutral-900/10 dark:border-white/10'}`}
          >
            <div className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 mb-1">Answer</div>
            <div className="text-base text-neutral-900 dark:text-neutral-100 mb-3">
              <MathText text={question.answer} />
            </div>
            {question.explanation && (
              <>
                <div className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 mb-1">Why</div>
                <div className="text-sm text-neutral-600 dark:text-neutral-400">
                  <MathText text={question.explanation} />
                </div>
              </>
            )}
          </div>
        )}

        {(state === 'graded' || state === 'revealed') && gradeResult && (
          <ConversationThread
            question={question}
            typedAnswer={typedAnswer}
            gradeResult={gradeResult}
            endpoint={endpoint}
            model={model}
            pendingMessage={pendingFollowUp}
            onPendingMessageSent={() => setPendingFollowUp(null)}
          />
        )}

        {state === 'error' && (
          <div className="mt-5 pt-5 border-t border-neutral-900/10 dark:border-white/10 text-left">
            <p className="text-sm text-red-500">{errorMessage}</p>
          </div>
        )}
      </div>

      {state === 'question' &&
        (aiTutorEnabled ? (
          <div className="flex flex-col gap-2">
            <button
              onClick={checkAnswer}
              disabled={!typedAnswer.trim()}
              className="w-full rounded-2xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold py-4 text-base active:scale-[0.98] transition-transform disabled:opacity-40"
            >
              Check answer
            </button>
            <button
              onClick={showAnswer}
              className="w-full rounded-2xl border border-neutral-900/10 dark:border-white/10 text-neutral-600 dark:text-neutral-300 font-semibold py-3.5 text-base active:scale-[0.98] transition-transform"
            >
              I don't know — show me the answer
            </button>
          </div>
        ) : (
          <button
            onClick={showAnswer}
            className="w-full rounded-2xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold py-4 text-base active:scale-[0.98] transition-transform"
          >
            Show answer
          </button>
        ))}

      {state === 'grading' && (
        <button
          disabled
          className="w-full rounded-2xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold py-4 text-base opacity-60"
        >
          Grading…
        </button>
      )}

      {state === 'error' && (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setState('question')}
            className="rounded-2xl border border-neutral-900/10 dark:border-white/10 font-semibold py-4 text-base"
          >
            Try again
          </button>
          <button
            onClick={showAnswer}
            className="rounded-2xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold py-4 text-base"
          >
            Show answer
          </button>
        </div>
      )}

      {showAnswerBlock && (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => grade(false)}
            className="rounded-2xl bg-red-500/10 text-red-500 border border-red-500/30 font-semibold py-4 text-base active:scale-[0.98] transition-transform"
          >
            Missed it
          </button>
          <button
            onClick={() => grade(true)}
            className="rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 font-semibold py-4 text-base active:scale-[0.98] transition-transform"
          >
            Got it
          </button>
        </div>
      )}
    </div>
  )
}
