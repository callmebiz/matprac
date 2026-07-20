import { useState } from 'react'
import { MarkdownText } from './MarkdownText'
import { activePath, siblingInfo } from '../lib/chatTree'
import type { ChatTree, ChatNode } from '../lib/chatTree'

interface ChatBubbleListProps {
  tree: ChatTree
  loading: boolean
  onEdit: (node: ChatNode, newText: string) => void
  onRegenerate: (assistantNodeId: string) => void
  onSwitchBranch: (key: string, index: number) => void
  /** When provided, assistant messages get a "save as flashcard" action. */
  onSaveAsFlashcard?: (node: ChatNode) => void
  savedNodeIds?: Set<string>
}

/**
 * Renders a chat tree's active branch as bubbles, with per-message edit (user) / regenerate
 * (assistant) actions and a ‹ i/n › nav for any message that has sibling versions -- shared between
 * the per-flashcard follow-up thread and the standalone Chat tab so both behave identically.
 */
export function ChatBubbleList({ tree, loading, onEdit, onRegenerate, onSwitchBranch, onSaveAsFlashcard, savedNodeIds }: ChatBubbleListProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')

  const path = activePath(tree)
  if (path.length === 0) return null

  function submitEdit(node: ChatNode) {
    const text = editDraft.trim()
    if (!text || loading) return
    setEditingId(null)
    onEdit(node, text)
  }

  return (
    <div className="flex flex-col gap-1.5">
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
                      onClick={() => {
                        setEditingId(node.id)
                        setEditDraft(node.message.content)
                      }}
                      disabled={loading}
                      className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 disabled:opacity-40"
                    >
                      Edit
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => onRegenerate(node.id)}
                        disabled={loading}
                        className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 disabled:opacity-40"
                      >
                        ↻ Regenerate
                      </button>
                      {onSaveAsFlashcard && (
                        <button
                          onClick={() => onSaveAsFlashcard(node)}
                          disabled={loading || savedNodeIds?.has(node.id)}
                          className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 disabled:opacity-40"
                        >
                          {savedNodeIds?.has(node.id) ? '✓ Saved' : '+ Flashcard'}
                        </button>
                      )}
                    </>
                  )}
                  {siblings && (
                    <div className="flex items-center gap-1 text-[11px] text-neutral-400 dark:text-neutral-500">
                      <button
                        onClick={() => onSwitchBranch(siblings.key, siblings.index - 1)}
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
                        onClick={() => onSwitchBranch(siblings.key, siblings.index + 1)}
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
  )
}
