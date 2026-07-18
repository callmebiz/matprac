import { useEffect, useState } from 'react'
import type { Question } from '../types'
import { MathText } from './MathText'
import { getLocalProvider, LlmError } from '../llm'
import type { ChatMessage, GradeResult } from '../llm'

interface ConversationThreadProps {
  question: Question
  typedAnswer: string
  gradeResult: GradeResult
  endpoint: string
  model: string
  /** Set to ask this on the user's behalf (e.g. tapping the suggested follow-up). */
  pendingMessage?: string | null
  onPendingMessageSent?: () => void
}

function buildContext(question: Question, typedAnswer: string, gradeResult: GradeResult): ChatMessage[] {
  const contextText = [
    `Flashcard question: ${question.prompt}`,
    `Expected answer: ${question.answer}`,
    question.explanation ? `Explanation: ${question.explanation}` : null,
    `My answer: ${typedAnswer}`,
  ]
    .filter(Boolean)
    .join('\n')

  const openingReply = [gradeResult.feedback, gradeResult.followUp].filter(Boolean).join('\n\n')

  return [
    { role: 'user', content: contextText },
    { role: 'assistant', content: openingReply },
  ]
}

export function ConversationThread({
  question,
  typedAnswer,
  gradeResult,
  endpoint,
  model,
  pendingMessage,
  onPendingMessageSent,
}: ConversationThreadProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function send(overrideText?: string) {
    const text = (overrideText ?? draft).trim()
    if (!text || loading) return

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(nextMessages)
    if (overrideText === undefined) setDraft('')
    setLoading(true)
    setError('')

    try {
      const context = buildContext(question, typedAnswer, gradeResult)
      const reply = await getLocalProvider(endpoint, model).chat([...context, ...nextMessages])
      setMessages([...nextMessages, { role: 'assistant', content: reply }])
    } catch (err) {
      setError(err instanceof LlmError ? err.message : 'Something went wrong reaching the model.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (pendingMessage) {
      void send(pendingMessage)
      onPendingMessageSent?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMessage])

  return (
    <div className="mt-5 pt-5 border-t border-neutral-900/10 dark:border-white/10 text-left">
      <div className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 mb-3">Ask a follow-up</div>

      {messages.length > 0 && (
        <div className="flex flex-col gap-2 mb-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${
                  m.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-sm'
                    : 'bg-neutral-900/[0.06] dark:bg-white/10 text-neutral-800 dark:text-neutral-200 rounded-bl-sm'
                }`}
              >
                <MathText text={m.content} />
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl rounded-bl-sm px-3.5 py-2 text-sm bg-neutral-900/[0.06] dark:bg-white/10 text-neutral-400 dark:text-neutral-500">
                …
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-500 mb-2">{error}</p>}

      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void send()
          }}
          placeholder="Ask why, or push back…"
          disabled={loading}
          className="flex-1 min-w-0 rounded-xl border border-neutral-900/10 dark:border-white/10 bg-white/60 dark:bg-black/20 px-3.5 py-2.5 text-sm text-neutral-900 dark:text-neutral-100 disabled:opacity-60"
        />
        <button
          onClick={() => send()}
          disabled={loading || !draft.trim()}
          className="rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold px-4 text-sm disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  )
}
