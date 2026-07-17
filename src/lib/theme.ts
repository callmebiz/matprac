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
