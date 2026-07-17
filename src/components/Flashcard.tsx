import { useState } from 'react'
import type { Question } from '../types'
import { MathText } from './MathText'
import { topicTheme } from '../lib/theme'
import { topicById } from '../data/topics'

interface FlashcardProps {
  question: Question
  onGrade: (correct: boolean) => void
}

const difficultyDots = { 1: 1, 2: 2, 3: 3 } as const

export function Flashcard({ question, onGrade }: FlashcardProps) {
  const [revealed, setRevealed] = useState(false)
  const theme = topicTheme[question.topicId]
  const topic = topicById.get(question.topicId)

  function grade(correct: boolean) {
    onGrade(correct)
    setRevealed(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        className={`rounded-3xl border ${theme.border} ${theme.bgSoft} p-6 min-h-[280px] flex flex-col`}
      >
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

        {revealed && (
          <div className="mt-5 pt-5 border-t border-neutral-900/10 dark:border-white/10 text-left">
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
      </div>

      {!revealed ? (
        <button
          onClick={() => setRevealed(true)}
          className="w-full rounded-2xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold py-4 text-base active:scale-[0.98] transition-transform"
        >
          Show answer
        </button>
      ) : (
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
