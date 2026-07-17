import type { Topic } from '../types'
import { topicTheme } from '../lib/theme'
import type { AccuracySummary } from '../lib/stats'

interface TopicCardProps {
  topic: Topic
  stats: AccuracySummary
  total: number
  selected: boolean
  onToggle: () => void
}

export function TopicCard({ topic, stats, total, selected, onToggle }: TopicCardProps) {
  const theme = topicTheme[topic.id]
  const pct = stats.accuracy !== null ? Math.round(stats.accuracy * 100) : null

  return (
    <button
      onClick={onToggle}
      className={`text-left rounded-2xl border p-4 transition-colors ${
        selected
          ? `${theme.border} ${theme.bgSoft}`
          : 'border-neutral-900/10 dark:border-white/10 bg-neutral-900/[0.02] dark:bg-white/[0.02]'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <span className={`h-9 w-9 rounded-xl flex items-center justify-center text-sm font-bold text-white ${theme.bg}`}>
          {topic.icon}
        </span>
        <span
          className={`h-5 w-5 rounded-full border flex items-center justify-center text-[10px] ${
            selected ? `${theme.bg} border-transparent text-white` : 'border-neutral-400 dark:border-neutral-600'
          }`}
        >
          {selected ? '✓' : ''}
        </span>
      </div>
      <div className="font-semibold text-sm text-neutral-900 dark:text-neutral-100 mb-0.5">
        {topic.shortName}
      </div>
      <div className="text-xs text-neutral-500 dark:text-neutral-400">
        {pct !== null ? `${pct}% accuracy · ` : 'Not started · '}
        {total} cards
      </div>
    </button>
  )
}
