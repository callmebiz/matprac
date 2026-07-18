import { useState } from 'react'
import type { Question } from '../types'
import { MathText } from './MathText'
import { topicTheme } from '../lib/theme'
import { topicById } from '../data/topics'
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

export function Flashcard({ question, onGrade }: FlashcardProps) {
  const [state, setState] = useState<CardState>('question')
  const [typedAnswer, setTypedAnswer] = useState('')
  const [gradeResult, setGradeResult] = useState<GradeResult | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  const aiTutorEnabled = useSettingsStore(isAiTutorReady)
  const endpoint = useSettingsStore((s) => s.endpoint)
  const model = useSettingsStore((s) => s.model)

  const theme = topicTheme[question.topicId]
  const topic = topicById.get(question.topicId)

  function grade(correct: boolean) {
    onGrade(correct)
    setState('question')
    setTypedAnswer('')
    setGradeResult(null)
  }

  async function checkAnswer() {
    setState('grading')
    try {
      const result = await getLocalProvider(endpoint, model).gradeAnswer({
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
      <div className={`rounded-3xl border ${theme.border} ${theme.bgSoft} p-6 min-h-[280px] flex flex-col`}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <span className={`text-xs font-semibold uppercase tracking-wide ${theme.text}`}>
            {topic?.shortName} · {question.subtopic}
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

        {state === 'graded' && gradeResult && (
          <div className="mt-5 pt-5 border-t border-neutral-900/10 dark:border-white/10 text-left">
            <div className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold mb-3 ${verdictStyle[gradeResult.verdict].className}`}>
              {verdictStyle[gradeResult.verdict].label}
            </div>
            <div className="text-sm text-neutral-700 dark:text-neutral-300 mb-3">
              <MathText text={gradeResult.feedback} />
            </div>
            {gradeResult.followUp && (
              <div className="text-sm text-neutral-500 dark:text-neutral-400 italic mb-3">
                <MathText text={gradeResult.followUp} />
              </div>
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

        {state === 'graded' && gradeResult && (
          <ConversationThread
            question={question}
            typedAnswer={typedAnswer}
            gradeResult={gradeResult}
            endpoint={endpoint}
            model={model}
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
              onClick={() => setState('revealed')}
              className="text-sm text-neutral-500 dark:text-neutral-400 font-medium py-1"
            >
              Skip — just show me the answer
            </button>
          </div>
        ) : (
          <button
            onClick={() => setState('revealed')}
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
            onClick={() => setState('revealed')}
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
