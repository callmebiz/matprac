import type { Question } from '../types'

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** A question's effective tags -- explicit tags if it has any, else a topic/subtopic-derived fallback. */
export function questionTags(question: Question): string[] {
  if (question.tags && question.tags.length > 0) return question.tags
  return [question.topicId, slugify(question.subtopic)]
}
