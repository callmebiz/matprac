import type { Question } from '../../types'
import { percentages } from './percentages'
import { linearAlgebra } from './linearAlgebra'
import { probability } from './probability'
import { calculusML } from './calculusML'

export const allQuestions: Question[] = [...percentages, ...linearAlgebra, ...probability, ...calculusML]

export const questionsByTopic = new Map<string, Question[]>(
  [...new Set(allQuestions.map((q) => q.topicId))].map((topicId) => [
    topicId,
    allQuestions.filter((q) => q.topicId === topicId),
  ]),
)

export const questionById = new Map(allQuestions.map((q) => [q.id, q]))
