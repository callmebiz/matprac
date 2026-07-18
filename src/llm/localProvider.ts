import type {
  ChatMessage,
  GenerateQuestionParams,
  GeneratedQuestion,
  GradeAnswerParams,
  GradeResult,
  LlmProvider,
  VerifyQuestionParams,
  VerifyResult,
} from './types'
import { LlmError } from './types'

function stripThinking(text: string): string {
  // Reasoning models (e.g. DeepSeek-R1 distills) think out loud in <think>...</think> before the
  // real answer -- strip it so downstream parsing only ever sees the actual response.
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
}

/**
 * A fixed total-duration timeout can't tell "dead" apart from "slow but still producing tokens" --
 * a long, detailed answer on a partially CPU-offloaded model can legitimately take minutes. So this
 * streams the response and only times out on genuine *inactivity* (no bytes at all for a while),
 * resetting the clock on every chunk received. Falls back to a plain non-streaming read if the
 * server ignores `stream: true` (some minimal OpenAI-compatible servers do).
 */
async function chatCompletion(
  endpoint: string,
  model: string,
  messages: ChatMessage[],
  { temperature = 0.4, idleTimeoutMs = 45_000 }: { temperature?: number; idleTimeoutMs?: number } = {},
): Promise<string> {
  const controller = new AbortController()
  let idleTimer: ReturnType<typeof setTimeout> | undefined
  const resetIdleTimer = () => {
    clearTimeout(idleTimer)
    idleTimer = setTimeout(() => controller.abort(), idleTimeoutMs)
  }
  resetIdleTimer()

  let res: Response
  try {
    res = await fetch(`${endpoint.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, temperature, stream: true, messages }),
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(idleTimer)
    if (controller.signal.aborted) {
      throw new LlmError('The local model stopped responding (no output for a while).', 'network')
    }
    throw new LlmError(
      `Could not reach the local model at ${endpoint}. Make sure it's running and reachable from this device (check CORS / OLLAMA_ORIGINS if using Ollama).`,
      'network',
    )
  }

  if (!res.ok) {
    clearTimeout(idleTimer)
    const body = await res.text().catch(() => '')
    throw new LlmError(`Local model server returned an error (HTTP ${res.status}). ${body.slice(0, 200)}`, 'http')
  }

  // Some OpenAI-compatible servers ignore `stream: true` and just return one JSON blob -- handle that too.
  if (!res.body || !(res.headers.get('content-type') ?? '').includes('text/event-stream')) {
    clearTimeout(idleTimer)
    const data = await res.json().catch(() => null)
    const content: string | undefined = data?.choices?.[0]?.message?.content
    if (!content) {
      throw new LlmError('The local model returned an unexpected response shape.', 'parse')
    }
    return stripThinking(content)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let full = ''
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      resetIdleTimer()
      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n')
      buffer = lines.pop() ?? '' // last line may be incomplete -- carry it into the next chunk
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const payload = trimmed.slice(5).trim()
        if (!payload || payload === '[DONE]') continue
        try {
          const delta: string | undefined = JSON.parse(payload)?.choices?.[0]?.delta?.content
          if (delta) full += delta
        } catch {
          // Malformed SSE frame -- skip it and keep reading rather than aborting the whole response.
        }
      }
    }
  } catch (err) {
    if (controller.signal.aborted) {
      throw new LlmError('The local model stopped responding (no output for a while).', 'network')
    }
    throw new LlmError('Lost connection to the local model mid-response.', 'network')
  } finally {
    clearTimeout(idleTimer)
  }

  if (!full.trim()) {
    throw new LlmError('The local model returned an empty response.', 'parse')
  }
  return stripThinking(full)
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

Use LaTeX ($...$ inline, $$...$$ block -- never \\( \\) or \\[ \\]) for any math in FEEDBACK or FOLLOWUP, written as plain, normal LaTeX -- do not escape backslashes.`

const GENERATE_SYSTEM_PROMPT = (topicName: string, subtopics: string[], difficulty: number) => `You are writing a new flashcard question for a math practice app aimed at a data scientist with a master's in AI engineering, staying sharp on "${topicName}".

Respond in EXACTLY this format and nothing else -- no markdown fences, no extra commentary before or after:

PROMPT: the question text
ANSWER: the correct answer
EXPLANATION: 1-2 sentences on why, or the key insight
TAGS: 2-4 short, lowercase, comma-separated topic tags for filtering (e.g. "pca, eigenvectors, dimensionality-reduction")

Use LaTeX ($...$ inline, $$...$$ block -- never \\( \\) or \\[ \\]) for any math, written as plain, normal LaTeX -- do not escape backslashes. Target difficulty ${difficulty} of 3.${subtopics.length > 0 ? ` Prefer these subtopics if relevant: ${subtopics.join(', ')}.` : ''} Make it precise and exam-style; avoid restating a generic textbook definition verbatim.`

const CHAT_SYSTEM_PROMPT = `You are a sharp, friendly tutor helping a data scientist with a master's in AI engineering go deeper on the math behind ML. You're mid-conversation about a specific flashcard they just answered. Answer their follow-up directly and technically -- don't repeat things already established in the conversation. Use LaTeX ($...$ inline, $$...$$ block -- never \\( \\) or \\[ \\]) for any math. Keep replies focused: a few sentences unless the question genuinely calls for more.`

const VERIFY_SYSTEM_PROMPT = `You are a rigorous, skeptical checker reviewing a math/AI flashcard before it enters a permanent study bank. You'll be given a question and its proposed answer.

First, solve the question yourself from scratch, briefly. Then compare your own result to the proposed answer.

Judge mathematical and conceptual equivalence, not exact wording -- equivalent notations or phrasings that convey the same correct idea should be treated as matching. Only call it a mismatch if the proposed answer is actually wrong or misleading.

Respond in EXACTLY this format and nothing else -- no markdown fences, no extra commentary before or after:

REASONING: your own brief independent derivation (1-3 sentences)
VERDICT: match or mismatch
NOTE: if mismatch, a one-sentence explanation of the discrepancy (omit this line if match)

Use LaTeX ($...$ inline, $$...$$ block -- never \\( \\) or \\[ \\]) for any math.`

export async function testLocalConnection(endpoint: string, model: string): Promise<void> {
  // Idle-timeout (not total-duration) covers cold model loads gracefully -- see chatCompletion.
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

    const prompt = extractField(content, 'PROMPT', ['ANSWER', 'EXPLANATION', 'TAGS'])
    const answer = extractField(content, 'ANSWER', ['EXPLANATION', 'TAGS'])
    const explanation = extractField(content, 'EXPLANATION', ['TAGS'])
    const tagsField = extractField(content, 'TAGS', [])

    if (!prompt || !answer) {
      throw new LlmError(`The model response didn't include both a question and an answer. Got: "${content.slice(0, 160)}"`, 'parse')
    }

    const tags = tagsField
      ?.split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)

    return { prompt, answer, explanation: explanation || undefined, tags: tags && tags.length > 0 ? tags : undefined }
  }

  async verifyQuestion({ prompt, answer, explanation }: VerifyQuestionParams): Promise<VerifyResult> {
    const userPrompt = [
      `Question: ${prompt}`,
      `Proposed answer: ${answer}`,
      explanation ? `Proposed explanation: ${explanation}` : null,
      '',
      'Verify this now.',
    ]
      .filter(Boolean)
      .join('\n')

    const content = await chatCompletion(
      this.endpoint,
      this.model,
      [
        { role: 'system', content: VERIFY_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.2 },
    )

    const verdictField = extractField(content, 'VERDICT', ['NOTE'])
    const noteField = extractField(content, 'NOTE', [])

    // No parseable verdict means the verifier itself misbehaved, not that the answer is wrong --
    // fail open rather than reject a possibly-good question over a formatting hiccup.
    if (verdictField === undefined) {
      return { verdict: 'match' }
    }

    const verdict = verdictField.toLowerCase().includes('mismatch') ? 'mismatch' : 'match'
    return { verdict, note: verdict === 'mismatch' ? noteField : undefined }
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    const hasSystemPrompt = messages.some((m) => m.role === 'system')
    const fullMessages = hasSystemPrompt ? messages : [{ role: 'system' as const, content: CHAT_SYSTEM_PROMPT }, ...messages]

    const content = await chatCompletion(this.endpoint, this.model, fullMessages, { temperature: 0.6 })
    return content.trim()
  }
}
