import { useEffect, useState } from 'react'
import type { Question } from '../types'
import { MarkdownText } from './MarkdownText'
import { getLocalProvider, LlmError } from '../llm'
import type { ChatMessage, GradeResult } from '../llm'
import { emptyTree, appendNode, setActiveIndex, activePath, siblingInfo, pathTo } from '../lib/chatTree'
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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const path = activePath(tree)

  async function requestReply(fromTree: ChatTree, parentId: string) {
    setLoading(true)
    setError('')
    try {
      const context = [...buildContext(question, typedAnswer, gradeResult), ...pathTo(fromTree, parentId)]
      const reply = await getLocalProvider(endpoint, model).chat(context)
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

  async function regenerate(assistantNodeId: string) {
    if (loading) return
    const parentId = tree.nodes[assistantNodeId].parentId
    if (!parentId) return
    await requestReply(tree, parentId)
  }

  function startEdit(node: ChatNode) {
    setEditingId(node.id)
    setEditDraft(node.message.content)
  }

  async function submitEdit(node: ChatNode) {
    const text = editDraft.trim()
    if (!text || loading) return
    setEditingId(null)
    const { tree: next, nodeId } = appendNode(tree, node.parentId, { role: 'user', content: text })
    setTree(next)
    await requestReply(next, nodeId)
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
        <div className="flex flex-col gap-1.5 mb-3">
          {path.map((node) => {
            const siblings = siblingInfo(tree, node.id)
            const isUser = node.message.role === 'user'
            const isEditing = editingId === node.id

            return (
              <div key={node.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                {isEditing ? (
                  <div className="w-full max-w-[95%] flex flex-col gap-1.5">
                    <textarea
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      rows={2}
                      autoFocus
                      className="w-full rounded-xl border border-neutral-900/10 dark:border-white/10 bg-white/60 dark:bg-black/20 px-3.5 py-2.5 text-sm text-neutral-900 dark:text-neutral-100 resize-none"
                    />
                    <div className="flex justify-end gap-3">
                      <button onClick={() => setEditingId(null)} className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                        Cancel
                      </button>
                      <button onClick={() => submitEdit(node)} className="text-xs font-semibold text-indigo-500">
                        Save &amp; resend
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${
                        isUser
                          ? 'bg-indigo-600 text-white rounded-br-sm'
                          : 'bg-neutral-900/[0.06] dark:bg-white/10 text-neutral-800 dark:text-neutral-200 rounded-bl-sm'
                      }`}
                    >
                      <MarkdownText text={node.message.content} />
                    </div>
                    <div className="flex items-center gap-2.5 mt-1 px-1">
                      {isUser ? (
                        <button
                          onClick={() => startEdit(node)}
                          disabled={loading}
                          className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 disabled:opacity-40"
                        >
                          Edit
                        </button>
                      ) : (
                        <button
                          onClick={() => regenerate(node.id)}
                          disabled={loading}
                          className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 disabled:opacity-40"
                        >
                          ↻ Regenerate
                        </button>
                      )}
                      {siblings && (
                        <div className="flex items-center gap-1 text-[11px] text-neutral-400 dark:text-neutral-500">
                          <button
                            onClick={() => switchBranch(siblings.key, siblings.index - 1)}
                            disabled={siblings.index === 0 || loading}
                            className="disabled:opacity-30"
                            aria-label="Previous version"
                          >
                            ‹
                          </button>
                          <span>
                            {siblings.index + 1}/{siblings.count}
                          </span>
                          <button
                            onClick={() => switchBranch(siblings.key, siblings.index + 1)}
                            disabled={siblings.index === siblings.count - 1 || loading}
                            className="disabled:opacity-30"
                            aria-label="Next version"
                          >
                            ›
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
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
