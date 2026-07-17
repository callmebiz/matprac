import type {
  GenerateQuestionParams,
  GeneratedQuestion,
  GradeAnswerParams,
  GradeResult,
  LlmProvider,
} from './types'
import { LlmError } from './types'

interface ChatMessage {
  role: 'system' | 'user'
  content: string
}

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

function extractJson<T>(text: string): T {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) {
    throw new LlmError('Could not find JSON in the model response.', 'parse')
  }
  try {
    return JSON.parse(text.slice(start, end + 1)) as T
  } catch {
    throw new LlmError('Could not parse JSON from the model response.', 'parse')
  }
}

const GRADE_SYSTEM_PROMPT = `You are a strict but encouraging tutor grading a technical flashcard answer for a data scientist studying the math behind AI/ML. Compare the student's typed answer to the expected answer and explanation.

Respond with ONLY a raw JSON object, no markdown fences, no commentary, in this exact shape:
{"verdict": "correct" | "partial" | "incorrect", "feedback": "2-3 sentence explanation of what was right/wrong", "followUp": "one short question that deepens understanding, or omit this key entirely if not useful"}

Preserve LaTeX ($...$ inline, $$...$$ block) faithfully if you use math notation in feedback or followUp.`

const GENERATE_SYSTEM_PROMPT = (topicName: string, subtopics: string[], difficulty: number) => `You are writing a new flashcard question for a math practice app aimed at a data scientist with a master's in AI engineering, staying sharp on "${topicName}".

Respond with ONLY a raw JSON object, no markdown fences, no commentary, in this exact shape:
{"prompt": "the question text", "answer": "the correct answer", "explanation": "1-2 sentences on why, or the key insight"}

Use LaTeX ($...$ inline, $$...$$ block) for any math. Target difficulty ${difficulty} of 3. Prefer these subtopics if relevant: ${subtopics.join(', ')}. Make it precise and exam-style; avoid restating a generic textbook definition verbatim.`

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

    const content = await chatCompletion(this.endpoint, this.model, [
      { role: 'system', content: GRADE_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ])

    const parsed = extractJson<{ verdict?: string; feedback?: string; followUp?: string }>(content)
    const verdict = parsed.verdict === 'correct' || parsed.verdict === 'partial' || parsed.verdict === 'incorrect' ? parsed.verdict : 'partial'

    return {
      verdict,
      feedback: parsed.feedback ?? 'The model did not return feedback.',
      followUp: parsed.followUp,
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

    const parsed = extractJson<{ prompt?: string; answer?: string; explanation?: string }>(content)
    if (!parsed.prompt || !parsed.answer) {
      throw new LlmError('The model response was missing a prompt or answer.', 'parse')
    }
    return { prompt: parsed.prompt, answer: parsed.answer, explanation: parsed.explanation }
  }
}
