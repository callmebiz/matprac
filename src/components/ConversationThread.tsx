import { useEffect, useState } from 'react'
import type { Question } from '../types'
import { ChatBubbleList } from './ChatBubbleList'
import { getLocalProvider, LlmError } from '../llm'
import type { ChatMessage, GradeResult } from '../llm'
import { useSettingsStore } from '../store/useSettingsStore'
import { emptyTree, appendNode, setActiveIndex, activePath, pathTo } from '../lib/chatTree'
import type { ChatTree, ChatNode } from '../lib/chatTree'

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
  const [tree, setTree] = useState<ChatTree>(emptyTree())
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const patienceMinutes = useSettingsStore((s) => s.patienceMinutes)

  const path = activePath(tree)

  async function requestReply(fromTree: ChatTree, parentId: string) {
    setLoading(true)
    setError('')
    try {
      const context = [...buildContext(question, typedAnswer, gradeResult), ...pathTo(fromTree, parentId)]
      const reply = await getLocalProvider(endpoint, model, patienceMinutes * 60_000).chat(context)
      setTree((t) => appendNode(t, parentId, { role: 'assistant', content: reply }).tree)
    } catch (err) {
      setError(err instanceof LlmError ? err.message : 'Something went wrong reaching the model.')
    } finally {
      setLoading(false)
    }
  }

  async function send(overrideText?: string) {
    const text = (overrideText ?? draft).trim()
    if (!text || loading) return

    const leaf = path.at(-1)
    const { tree: next, nodeId } = appendNode(tree, leaf?.id ?? null, { role: 'user', content: text })
    setTree(next)
    if (overrideText === undefined) setDraft('')
    await requestReply(next, nodeId)
  }

  function handleEdit(node: ChatNode, newText: string) {
    const { tree: next, nodeId } = appendNode(tree, node.parentId, { role: 'user', content: newText })
    setTree(next)
    void requestReply(next, nodeId)
  }

  function regenerate(assistantNodeId: string) {
    if (loading) return
    const parentId = tree.nodes[assistantNodeId].parentId
    if (!parentId) return
    void requestReply(tree, parentId)
  }

  function switchBranch(key: string, index: number) {
    if (loading) return
    setTree((t) => setActiveIndex(t, key, index))
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

      {path.length > 0 && (
        <div className="mb-3">
          <ChatBubbleList tree={tree} loading={loading} onEdit={handleEdit} onRegenerate={regenerate} onSwitchBranch={switchBranch} />
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
