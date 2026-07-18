export type TopicId = 'percentages' | 'linear-algebra' | 'probability' | 'calculus-ml'

export interface Topic {
  id: TopicId
  name: string
  shortName: string
  description: string
  /** Tailwind color token, e.g. 'emerald' */
  color: string
  icon: string
}

export type Difficulty = 1 | 2 | 3

export interface Question {
  id: string
  /** A built-in TopicId for curated cards, or an arbitrary slug for an AI-created category. */
  topicId: TopicId | string
  /** Display name for a non-built-in topicId (the LLM's proposed category name). Ignored for built-in topics. */
  topicLabel?: string
  subtopic: string
  difficulty: Difficulty
  /** Prompt text; wrap math in $...$ (inline) or $$...$$ (block) */
  prompt: string
  answer: string
  explanation?: string
  /** Free-form filter tags. Falls back to [topicId, slugified subtopic] when absent -- see questionTags(). */
  tags?: string[]
  source?: 'static' | 'generated'
  createdAt?: number
}

export interface QuestionProgress {
  seen: number
  correct: number
  incorrect: number
  lastSeen: number | null
  streak: number
}

export interface StatsState {
  progress: Record<string, QuestionProgress>
  practiceDays: string[]
}
