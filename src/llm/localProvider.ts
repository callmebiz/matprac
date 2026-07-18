import type {
  ChatMessage,
  GenerateQuestionParams,
  GeneratedQuestion,
  GradeAnswerParams,
  GradeResult,
  LlmProvider,
} from './types'
import { LlmError } from './types'

async function chatCompletion(
  endpoint: string,
  model: string,
  messages: ChatMessage[],
  { temperature = 0.4, timeoutMs = 60_000 }: { temperature?: number; timeoutMs?: number } = {},
): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let res: Response
  try {
    res = await fetch(`${endpoint.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, temperature, messages }),
      signal: controller.signal,
    })
  } catch (err) {
    if (controller.signal.aborted) {
      throw new LlmError('The local model took too long to respond (timed out).', 'network')
    }
    throw new LlmError(
      `Could not reach the local model at ${endpoint}. Make sure it's running and reachable from this device (check CORS / OLLAMA_ORIGINS if using Ollama).`,
      'network',
    )
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new LlmError(`Local model server returned an error (HTTP ${res.status}). ${body.slice(0, 200)}`, 'http')
  }

  const data = await res.json().catch(() => null)
  const content: string | undefined = data?.choices?.[0]?.message?.content
  if (!content) {
    throw new LlmError('The local model returned an unexpected response shape.', 'parse')
  }
  return content
}

/**
 * Extracts a labeled field (e.g. "FEEDBACK: ...") from free-form model output. Deliberately not
 * JSON: asking a small local model to nest real LaTeX (backslash-heavy) inside a JSON string is
 * fragile -- `\dfrac`, `\sqrt`, etc. aren't valid JSON escapes, and models routinely emit them
 * unescaped, breaking JSON.parse. Plain tagged text sidesteps that entirely.
 */
function extractField(text: string, field: string, laterFields: string[]): string | undefined {
  const startMatch = new RegExp(`${field}\\s*:\\s*`, 'i').exec(text)
  if (!startMatch) return undefined

  const valueStart = startMatch.index + startMatch[0].length
  let valueEnd = text.length
  for (const later of laterFields) {
    const laterMatch = new RegExp(`\\n\\s*${later}\\s*:`, 'i').exec(text.slice(valueStart))
    if (laterMatch) valueEnd = Math.min(valueEnd, valueStart + laterMatch.index)
  }
  return text.slice(valueStart, valueEnd).trim()
}

const GRADE_SYSTEM_PROMPT = `You are a strict but encouraging tutor grading a technical flashcard answer for a data scientist studying the math behind AI/ML. Compare the student's typed answer to the expected answer and explanation.

Judge mathematical and conceptual correctness, not exact formatting. Treat equivalent notations as identical -- "n x m", "nxm", "n*m", "(n × m)", and "n by m" all mean the same thing; missing parentheses, spacing, or writing "x" instead of "×" never make an answer wrong on their own. Only grade "partial" or "incorrect" if the answer is actually mathematically or conceptually wrong or incomplete.

Respond in EXACTLY this format and nothing else -- no markdown fences, no extra commentary before or after:

VERDICT: correct, partial, or incorrect
FEEDBACK: 2-3 sentences on what was right or wrong
FOLLOWUP: one short question that deepens understanding (omit this line entirely if it wouldn't add anything)

Use LaTeX ($...$ inline, $$...$$ block) for any math in FEEDBACK or FOLLOWUP, written as plain, normal LaTeX -- do not escape backslashes.`

const GENERATE_SYSTEM_PROMPT = (topicName: string, subtopics: string[], difficulty: number) => `You are writing a new flashcard question for a math practice app aimed at a data scientist with a master's in AI engineering, staying sharp on "${topicName}".

Respond in EXACTLY this format and nothing else -- no markdown fences, no extra commentary before or after:

PROMPT: the question text
ANSWER: the correct answer
EXPLANATION: 1-2 sentences on why, or the key insight

Use LaTeX ($...$ inline, $$...$$ block) for any math, written as plain, normal LaTeX -- do not escape backslashes. Target difficulty ${difficulty} of 3. Prefer these subtopics if relevant: ${subtopics.join(', ')}. Make it precise and exam-style; avoid restating a generic textbook definition verbatim.`

const CHAT_SYSTEM_PROMPT = `You are a sharp, friendly tutor helping a data scientist with a master's in AI engineering go deeper on the math behind ML. You're mid-conversation about a specific flashcard they just answered. Answer their follow-up directly and technically -- don't repeat things already established in the conversation. Use LaTeX ($...$ inline, $$...$$ block) for any math. Keep replies focused: a few sentences unless the question genuinely calls for more.`

export async function testLocalConnection(endpoint: string, model: string): Promise<void> {
  // Generous timeout: the first request after starting a local model server often has to
  // cold-load the model into memory/VRAM before it can respond, which can take a while.
  const content = await chatCompletion(endpoint, model, [{ role: 'user', content: 'Reply with the single word: OK' }])
  if (!content.trim()) {
    throw new LlmError('The local model returned an empty response.', 'parse')
  }
}

export class LocalProvider implements LlmProvider {
  private endpoint: string
  private model: string

  constructor(endpoint: string, model: string) {
    this.endpoint = endpoint
    this.model = model
  }

  async gradeAnswer({ prompt, expectedAnswer, explanation, userAnswer }: GradeAnswerParams): Promise<GradeResult> {
    const userPrompt = [
      `Question: ${prompt}`,
      `Expected answer: ${expectedAnswer}`,
      explanation ? `Explanation: ${explanation}` : null,
      `Student's answer: ${userAnswer}`,
      '',
      "Grade the student's answer now.",
    ]
      .filter(Boolean)
      .join('\n')

    const content = await chatCompletion(
      this.endpoint,
      this.model,
      [
        { role: 'system', content: GRADE_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.2 },
    )

    const verdictField = extractField(content, 'VERDICT', ['FEEDBACK', 'FOLLOWUP'])
    const feedbackField = extractField(content, 'FEEDBACK', ['FOLLOWUP'])
    const followUpField = extractField(content, 'FOLLOWUP', [])

    // If the model ignored the format entirely, fall back to showing its raw reply as feedback
    // rather than surfacing a parse error -- a degraded but still useful result.
    if (verdictField === undefined && feedbackField === undefined) {
      return { verdict: 'partial', feedback: content.trim() || 'The model did not return feedback.' }
    }

    const v = (verdictField ?? '').toLowerCase()
    const verdict = v.includes('incorrect') ? 'incorrect' : v.includes('partial') ? 'partial' : v.includes('correct') ? 'correct' : 'partial'

    return {
      verdict,
      feedback: feedbackField || 'The model did not return feedback.',
      followUp: followUpField || undefined,
    }
  }

  async generateQuestion({ topicName, subtopics, difficulty }: GenerateQuestionParams): Promise<GeneratedQuestion> {
    const content = await chatCompletion(
      this.endpoint,
      this.model,
      [
        { role: 'system', content: GENERATE_SYSTEM_PROMPT(topicName, subtopics, difficulty) },
        { role: 'user', content: 'Generate one new flashcard question now.' },
      ],
      { temperature: 0.8 },
    )

    const prompt = extractField(content, 'PROMPT', ['ANSWER', 'EXPLANATION'])
    const answer = extractField(content, 'ANSWER', ['EXPLANATION'])
    const explanation = extractField(content, 'EXPLANATION', [])

    if (!prompt || !answer) {
      throw new LlmError(`The model response didn't include both a question and an answer. Got: "${content.slice(0, 160)}"`, 'parse')
    }
    return { prompt, answer, explanation: explanation || undefined }
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    const hasSystemPrompt = messages.some((m) => m.role === 'system')
    const fullMessages = hasSystemPrompt ? messages : [{ role: 'system' as const, content: CHAT_SYSTEM_PROMPT }, ...messages]

    const content = await chatCompletion(this.endpoint, this.model, fullMessages, { temperature: 0.6 })
    return content.trim()
  }
}
