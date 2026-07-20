import { useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { topics, topicById, questionTopicLabel } from '../data/topics'
import { getTopicTheme } from '../lib/theme'
import { slugify, questionTags } from '../lib/tags'
import { useQuestionBankStore } from '../store/useQuestionBankStore'
import { useSettingsStore, isAiTutorReady } from '../store/useSettingsStore'
import { getLocalProvider, LlmError } from '../llm'
import { MathText } from '../components/MathText'
import type { Question } from '../types'

const COUNT_OPTIONS = [3, 5, 10] as const

/**
 * Resolves the model's free-text CATEGORY into a stable topicId: reuse a built-in topic if it
 * matches one by name, reuse a previously-created custom category if it matches one already in the
 * bank (so repeated requests on the same subject converge on one bucket instead of near-duplicates),
 * or mint a new slug for a genuinely new category.
 */
function resolveCategory(
  category: string | undefined,
  fallbackText: string,
  bank: Question[],
): { topicId: string; topicLabel?: string } {
  const label = (category || fallbackText).trim()

  const builtin = topics.find((t) => t.name.toLowerCase() === label.toLowerCase() || t.shortName.toLowerCase() === label.toLowerCase())
  if (builtin) return { topicId: builtin.id }

  const existingCustom = bank.find((q) => !topicById.has(q.topicId) && questionTopicLabel(q).toLowerCase() === label.toLowerCase())
  if (existingCustom) return { topicId: existingCustom.topicId, topicLabel: questionTopicLabel(existingCustom) }

  return { topicId: slugify(label) || 'general', topicLabel: label }
}

export function Create() {
  const navigate = useNavigate()
  const location = useLocation()
  const aiTutorEnabled = useSettingsStore(isAiTutorReady)
  const endpoint = useSettingsStore((s) => s.endpoint)
  const model = useSettingsStore((s) => s.model)
  const patienceMinutes = useSettingsStore((s) => s.patienceMinutes)

  const bank = useQuestionBankStore((s) => s.questions)
  const addQuestions = useQuestionBankStore((s) => s.addQuestions)
  const removeQuestion = useQuestionBankStore((s) => s.removeQuestion)

  const [request, setRequest] = useState(() => (location.state as { prefill?: string } | null)?.prefill ?? '')
  const [count, setCount] = useState<(typeof COUNT_OPTIONS)[number]>(5)
  const [generating, setGenerating] = useState(false)
  const [phase, setPhase] = useState<'generating' | 'verifying'>('generating')
  const [progress, setProgress] = useState({ done: 0, total: 0, failed: 0, rejected: 0 })
  const [genError, setGenError] = useState('')
  const cancelRef = useRef(false)

  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())

  const bankList = useMemo(() => Object.values(bank).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)), [bank])
  const allTags = useMemo(() => [...new Set(bankList.flatMap(questionTags))].sort(), [bankList])
  const existingCategories = useMemo(
    () => [...new Set([...topics.map((t) => t.name), ...bankList.map(questionTopicLabel)])],
    [bankList],
  )
  const filtered = useMemo(
    () => (selectedTags.size === 0 ? bankList : bankList.filter((q) => questionTags(q).some((t) => selectedTags.has(t)))),
    [bankList, selectedTags],
  )

  function toggleTag(tag: string) {
    setSelectedTags((prev) => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }

  async function handleGenerate() {
    const text = request.trim()
    if (!text || generating) return

    setGenerating(true)
    setGenError('')
    cancelRef.current = false
    setProgress({ done: 0, total: count, failed: 0, rejected: 0 })

    const provider = getLocalProvider(endpoint, model, patienceMinutes * 60_000)

    // Best-effort: keeps the screen from auto-locking mid-batch. Won't survive switching apps --
    // there's no reliable way for a PWA to keep a fetch alive once it's backgrounded on mobile.
    let wakeLock: WakeLockSentinel | null = null
    try {
      wakeLock = await navigator.wakeLock?.request('screen')
    } catch {
      // Unsupported, denied, or page hidden -- generation still works either way.
    }

    for (let i = 0; i < count; i++) {
      if (cancelRef.current) break
      try {
        setPhase('generating')
        const difficulty = (Math.floor(Math.random() * 3) + 1) as 1 | 2 | 3
        const generated = await provider.generateQuestion({
          topicName: text,
          subtopics: [],
          difficulty,
          existingCategories,
        })

        setPhase('verifying')
        const verification = await provider.verifyQuestion({
          prompt: generated.prompt,
          answer: generated.answer,
          explanation: generated.explanation,
        })

        if (verification.verdict === 'mismatch') {
          setProgress((p) => ({ ...p, done: p.done + 1, rejected: p.rejected + 1 }))
          continue
        }

        const { topicId, topicLabel } = resolveCategory(generated.category, text, bankList)
        const question: Question = {
          id: `gen-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
          topicId,
          topicLabel,
          subtopic: text.slice(0, 60),
          difficulty,
          prompt: generated.prompt,
          answer: generated.answer,
          explanation: generated.explanation,
          tags: generated.tags && generated.tags.length > 0 ? generated.tags : [slugify(text)],
          source: 'generated',
          createdAt: Date.now(),
        }
        addQuestions([question])
        setProgress((p) => ({ ...p, done: p.done + 1 }))
      } catch (err) {
        setProgress((p) => ({ ...p, done: p.done + 1, failed: p.failed + 1 }))
        if (err instanceof LlmError && err.cause === 'network') {
          // Endpoint is unreachable -- no point burning through the rest of the batch.
          setGenError(err.message)
          break
        }
      }
    }

    await wakeLock?.release().catch(() => {})

    setGenerating(false)
  }

  function practiceFiltered() {
    if (filtered.length === 0) return
    navigate('/practice', { state: { questions: filtered } })
  }

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-28">
      <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-1">Create questions</h1>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">
        Ask your local model to write questions on anything — it files each one under the best-fitting
        category itself, creating a new one if nothing existing fits, and tags it for filtering later.
        Each one is independently double-checked before it's saved — roughly doubles generation time in
        exchange for catching wrong answers before they reach your bank.
      </p>

      {!aiTutorEnabled ? (
        <div className="rounded-2xl bg-neutral-900/[0.03] dark:bg-white/[0.04] p-4 text-sm text-neutral-500 dark:text-neutral-400">
          Enable the AI tutor in Settings first — this needs a local model to write questions.
        </div>
      ) : (
        <div className="mb-8">
          <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-1.5">
            What do you want to study?
          </label>
          <textarea
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            placeholder="e.g. attention mechanisms in transformers, or gradient boosting"
            rows={2}
            disabled={generating}
            className="w-full rounded-xl border border-neutral-900/10 dark:border-white/10 bg-transparent px-3.5 py-2.5 text-sm text-neutral-900 dark:text-neutral-100 resize-none mb-3 disabled:opacity-60"
          />

          <div className="flex gap-2 mb-3">
            {COUNT_OPTIONS.map((n) => (
              <button
                key={n}
                onClick={() => setCount(n)}
                disabled={generating}
                className={`flex-1 rounded-xl border py-2 text-sm font-semibold disabled:opacity-60 ${
                  count === n
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'border-neutral-900/10 dark:border-white/10 text-neutral-600 dark:text-neutral-300'
                }`}
              >
                {n} questions
              </button>
            ))}
          </div>

          {generating ? (
            <div className="flex flex-col gap-2">
              <button
                disabled
                className="w-full rounded-2xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold py-3.5 text-base opacity-60"
              >
                {phase === 'generating' ? 'Generating' : 'Verifying'} {progress.done + 1} of {progress.total}…
              </button>
              <button
                onClick={() => {
                  cancelRef.current = true
                }}
                className="text-sm text-neutral-500 dark:text-neutral-400 font-medium py-1"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={!request.trim()}
              className="w-full rounded-2xl bg-indigo-600 text-white font-semibold py-3.5 text-base disabled:opacity-40"
            >
              Generate
            </button>
          )}

          {!generating && progress.total > 0 && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
              {progress.done - progress.failed - progress.rejected} of {progress.total} saved
              {progress.rejected > 0 ? ` · ${progress.rejected} failed verification` : ''}
              {progress.failed > 0 ? ` · ${progress.failed} failed to generate` : ''}
            </p>
          )}
          {genError && <p className="text-xs text-red-500 mt-2">{genError}</p>}
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          Your questions ({bankList.length})
        </h2>
      </div>

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                selectedTags.has(tag)
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'border-neutral-900/10 dark:border-white/10 text-neutral-500 dark:text-neutral-400'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {bankList.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Nothing generated yet — ask for some questions above.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-2 mb-4">
            {filtered.map((q) => {
              const theme = getTopicTheme(q.topicId)
              return (
                <div
                  key={q.id}
                  className={`rounded-xl border ${theme.border} ${theme.bgSoft} p-3.5 flex items-start justify-between gap-3`}
                >
                  <div className="min-w-0">
                    <div className={`text-[11px] font-semibold uppercase tracking-wide mb-1 ${theme.text}`}>
                      {questionTopicLabel(q)}
                    </div>
                    <div className="text-sm text-neutral-800 dark:text-neutral-200 line-clamp-2 mb-1.5">
                      <MathText text={q.prompt} />
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {questionTags(q).map((tag) => (
                        <span key={tag} className={`text-[11px] font-medium ${theme.text}`}>
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => removeQuestion(q.id)}
                    aria-label="Delete question"
                    className="shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-neutral-400 dark:text-neutral-500 bg-neutral-900/5 dark:bg-white/10"
                  >
                    ✕
                  </button>
                </div>
              )
            })}
          </div>

          <button
            onClick={practiceFiltered}
            disabled={filtered.length === 0}
            className="w-full rounded-2xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold py-3.5 text-base disabled:opacity-40"
          >
            Practice {filtered.length} question{filtered.length === 1 ? '' : 's'}
          </button>
        </>
      )}
    </div>
  )
}
