export type GradeVerdict = 'correct' | 'partial' | 'incorrect'

export interface GradeResult {
  verdict: GradeVerdict
  feedback: string
  followUp?: string
}

export interface GeneratedQuestion {
  prompt: string
  answer: string
  explanation?: string
}

export interface GradeAnswerParams {
  prompt: string
  expectedAnswer: string
  explanation?: string
  userAnswer: string
}

export interface GenerateQuestionParams {
  topicName: string
  subtopics: string[]
  difficulty: 1 | 2 | 3
}

export class LlmError extends Error {
  readonly cause?: 'network' | 'http' | 'parse'

  constructor(message: string, cause?: 'network' | 'http' | 'parse') {
    super(message)
    this.cause = cause
    this.name = 'LlmError'
  }
}

/** Anything that can grade a typed answer and generate new questions. Local today; a Claude proxy can implement the same shape later. */
export interface LlmProvider {
  gradeAnswer(params: GradeAnswerParams): Promise<GradeResult>
  generateQuestion(params: GenerateQuestionParams): Promise<GeneratedQuestion>
}
