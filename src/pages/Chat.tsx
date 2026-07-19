import { useMemo, useState } from 'react'
import { useSettingsStore, isAiTutorReady } from '../store/useSettingsStore'
import { useChatStore } from '../store/useChatStore'
import { getLocalProvider, LlmError, STANDALONE_CHAT_SYSTEM_PROMPT } from '../llm'
import { ChatBubbleList } from '../components/ChatBubbleList'
import { appendNode, setActiveIndex, activePath, pathTo } from '../lib/chatTree'
import type { ChatTree, ChatNode } from '../lib/chatTree'

function timeAgo(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export function Chat() {
  const aiTutorEnabled = useSettingsStore(isAiTutorReady)
  const endpoint = useSettingsStore((s) => s.endpoint)
  const model = useSettingsStore((s) => s.model)
  const patienceMinutes = useSettingsStore((s) => s.patienceMinutes)

  const sessions = useChatStore((s) => s.sessions)
  const createSession = useChatStore((s) => s.createSession)
  const deleteSession = useChatStore((s) => s.deleteSession)
  const setSessionTree = useChatStore((s) => s.setSessionTree)
  const setSessionTitle = useChatStore((s) => s.setSessionTitle)

  const [activeId, setActiveId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const sessionList = useMemo(() => Object.values(sessions).sort((a, b) => b.updatedAt - a.updatedAt), [sessions])
  const active = activeId ? sessions[activeId] : null

  function openNew() {
    setActiveId(createSession())
  }

  async function requestReply(sessionId: string, fromTree: ChatTree, parentId: string) {
    setLoading(true)
    setError('')
    try {
      const context = [{ role: 'system' as const, content: STANDALONE_CHAT_SYSTEM_PROMPT }, ...pathTo(fromTree, parentId)]
      const reply = await getLocalProvider(endpoint, model, patienceMinutes * 60_000).chat(context)
      setSessionTree(sessionId, appendNode(fromTree, parentId, { role: 'assistant', content: reply }).tree)
    } catch (err) {
      setError(err instanceof LlmError ? err.message : 'Something went wrong reaching the model.')
    } finally {
      setLoading(false)
    }
  }

  async function send() {
    const text = draft.trim()
    if (!text || loading || !active) return
    const leaf = activePath(active.tree).at(-1)
    const { tree: next, nodeId } = appendNode(active.tree, leaf?.id ?? null, { role: 'user', content: text })
    setSessionTree(active.id, next)
    if (active.title === 'New chat') setSessionTitle(active.id, text.slice(0, 48))
    setDraft('')
    await requestReply(active.id, next, nodeId)
  }

  function handleEdit(node: ChatNode, newText: string) {
    if (!active) return
    const { tree: next, nodeId } = appendNode(active.tree, node.parentId, { role: 'user', content: newText })
    setSessionTree(active.id, next)
    void requestReply(active.id, next, nodeId)
  }

  function regenerate(assistantNodeId: string) {
    if (!active || loading) return
    const parentId = active.tree.nodes[assistantNodeId].parentId
    if (!parentId) return
    void requestReply(active.id, active.tree, parentId)
  }

  function switchBranch(key: string, index: number) {
    if (!active || loading) return
    setSessionTree(active.id, setActiveIndex(active.tree, key, index))
  }

  if (!aiTutorEnabled) {
    return (
      <div className="max-w-md mx-auto px-4 pt-8 pb-28">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-6">Chat</h1>
        <div className="rounded-2xl bg-neutral-900/[0.03] dark:bg-white/[0.04] p-4 text-sm text-neutral-500 dark:text-neutral-400">
          Enable the AI tutor in Settings first — this needs a local model to chat with.
        </div>
      </div>
    )
  }

  if (!active) {
    return (
      <div className="max-w-md mx-auto px-4 pt-8 pb-28">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Chat</h1>
          <button onClick={openNew} className="rounded-full bg-indigo-600 text-white text-sm font-semibold px-4 py-2">
            + New
          </button>
        </div>

        {sessionList.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            No conversations yet — start one above. Ask about anything math, ML, or AI-engineering related, no
            flashcard required.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {sessionList.map((s) => {
              const lastNode = activePath(s.tree).at(-1)
              const preview = lastNode ? (lastNode.message.role === 'user' ? 'You: ' : '') + lastNode.message.content : 'No messages yet'
              return (
                <div
                  key={s.id}
                  className="rounded-xl border border-neutral-900/10 dark:border-white/10 p-3.5 flex items-start justify-between gap-3"
                >
                  <button onClick={() => setActiveId(s.id)} className="min-w-0 flex-1 text-left">
                    <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">{s.title}</div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">{preview}</div>
                    <div className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1">{timeAgo(s.updatedAt)}</div>
                  </button>
                  <button
                    onClick={() => deleteSession(s.id)}
                    aria-label="Delete chat"
                    className="shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-neutral-400 dark:text-neutral-500 bg-neutral-900/5 dark:bg-white/10"
                  >
                    ✕
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const path = activePath(active.tree)

  return (
    <div className="max-w-md mx-auto px-4 pt-6 pb-28">
      <div className="flex items-center justify-between mb-5 gap-3">
        <button
          onClick={() => setActiveId(null)}
          aria-label="Back to chats"
          className="shrink-0 h-9 w-9 rounded-full flex items-center justify-center text-neutral-500 dark:text-neutral-400 bg-neutral-900/5 dark:bg-white/10"
        >
          ←
        </button>
        <div className="min-w-0 flex-1 text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate text-center">
          {active.title}
        </div>
        <button
          onClick={() => {
            deleteSession(active.id)
            setActiveId(null)
          }}
          aria-label="Delete chat"
          className="shrink-0 h-9 w-9 rounded-full flex items-center justify-center text-neutral-400 dark:text-neutral-500 bg-neutral-900/5 dark:bg-white/10"
        >
          ✕
        </button>
      </div>

      {path.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center mt-10 mb-6">
          Ask anything — math, ML theory, whatever you're working through.
        </p>
      ) : (
        <div className="mb-4">
          <ChatBubbleList tree={active.tree} loading={loading} onEdit={handleEdit} onRegenerate={regenerate} onSwitchBranch={switchBranch} />
        </div>
      )}

      {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void send()
          }}
          placeholder="Message…"
          disabled={loading}
          className="flex-1 min-w-0 rounded-xl border border-neutral-900/10 dark:border-white/10 bg-transparent px-3.5 py-2.5 text-sm text-neutral-900 dark:text-neutral-100 disabled:opacity-60"
        />
        <button
          onClick={() => void send()}
          disabled={loading || !draft.trim()}
          className="rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold px-4 text-sm disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  )
}
