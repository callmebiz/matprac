import { LocalProvider } from './localProvider'
import type { LlmProvider } from './types'

export * from './types'
export { testLocalConnection, STANDALONE_CHAT_SYSTEM_PROMPT } from './localProvider'

export function getLocalProvider(endpoint: string, model: string, firstByteTimeoutMs?: number): LlmProvider {
  return new LocalProvider(endpoint, model, firstByteTimeoutMs)
}
