import type { TopicId } from '../types'

interface TopicTheme {
  bg: string
  bgSoft: string
  text: string
  border: string
  ring: string
}

// Tailwind needs literal class names (no dynamic `bg-${color}-500`), so this is spelled out per topic.
export const topicTheme: Record<TopicId, TopicTheme> = {
  percentages: {
    bg: 'bg-emerald-500',
    bgSoft: 'bg-emerald-500/10',
    text: 'text-emerald-500',
    border: 'border-emerald-500/30',
    ring: 'ring-emerald-500',
  },
  'linear-algebra': {
    bg: 'bg-blue-500',
    bgSoft: 'bg-blue-500/10',
    text: 'text-blue-500',
    border: 'border-blue-500/30',
    ring: 'ring-blue-500',
  },
  probability: {
    bg: 'bg-amber-500',
    bgSoft: 'bg-amber-500/10',
    text: 'text-amber-500',
    border: 'border-amber-500/30',
    ring: 'ring-amber-500',
  },
  'calculus-ml': {
    bg: 'bg-violet-500',
    bgSoft: 'bg-violet-500/10',
    text: 'text-violet-500',
    border: 'border-violet-500/30',
    ring: 'ring-violet-500',
  },
}

// AI-created categories aren't in the fixed map above -- give each a stable, distinct color instead
// of one flat gray, picked deterministically from its id so it doesn't shift between renders/reloads.
const CUSTOM_TOPIC_PALETTE: TopicTheme[] = [
  { bg: 'bg-rose-500', bgSoft: 'bg-rose-500/10', text: 'text-rose-500', border: 'border-rose-500/30', ring: 'ring-rose-500' },
  { bg: 'bg-cyan-500', bgSoft: 'bg-cyan-500/10', text: 'text-cyan-500', border: 'border-cyan-500/30', ring: 'ring-cyan-500' },
  { bg: 'bg-fuchsia-500', bgSoft: 'bg-fuchsia-500/10', text: 'text-fuchsia-500', border: 'border-fuchsia-500/30', ring: 'ring-fuchsia-500' },
  { bg: 'bg-lime-500', bgSoft: 'bg-lime-500/10', text: 'text-lime-500', border: 'border-lime-500/30', ring: 'ring-lime-500' },
  { bg: 'bg-sky-500', bgSoft: 'bg-sky-500/10', text: 'text-sky-500', border: 'border-sky-500/30', ring: 'ring-sky-500' },
  { bg: 'bg-orange-500', bgSoft: 'bg-orange-500/10', text: 'text-orange-500', border: 'border-orange-500/30', ring: 'ring-orange-500' },
]

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** Theme for any topicId, built-in or AI-created -- falls back to a deterministic palette pick. */
export function getTopicTheme(topicId: string): TopicTheme {
  return topicTheme[topicId as TopicId] ?? CUSTOM_TOPIC_PALETTE[hashString(topicId) % CUSTOM_TOPIC_PALETTE.length]
}
