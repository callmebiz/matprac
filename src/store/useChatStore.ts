import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { emptyTree } from '../lib/chatTree'
import type { ChatTree } from '../lib/chatTree'

export interface ChatSession {
  id: string
  title: string
  tree: ChatTree
  createdAt: number
  updatedAt: number
}

interface ChatStore {
  sessions: Record<string, ChatSession>
  createSession: () => string
  deleteSession: (id: string) => void
  setSessionTree: (id: string, tree: ChatTree) => void
  setSessionTitle: (id: string, title: string) => void
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

// Kept in its own localStorage key (separate from stats/settings/question-bank) since active
// chatting is the most frequently-written store of the bunch.
export const useChatStore = create<ChatStore>()(
  persist(
    (set) => ({
      sessions: {},

      createSession: () => {
        const id = newId()
        const now = Date.now()
        set((state) => ({
          sessions: {
            ...state.sessions,
            [id]: { id, title: 'New chat', tree: emptyTree(), createdAt: now, updatedAt: now },
          },
        }))
        return id
      },

      deleteSession: (id) =>
        set((state) => {
          const sessions = { ...state.sessions }
          delete sessions[id]
          return { sessions }
        }),

      setSessionTree: (id, tree) =>
        set((state) => {
          const session = state.sessions[id]
          if (!session) return state
          return { sessions: { ...state.sessions, [id]: { ...session, tree, updatedAt: Date.now() } } }
        }),

      setSessionTitle: (id, title) =>
        set((state) => {
          const session = state.sessions[id]
          if (!session) return state
          return { sessions: { ...state.sessions, [id]: { ...session, title } } }
        }),
    }),
    { name: 'matprac-chats' },
  ),
)
