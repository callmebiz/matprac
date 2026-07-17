import { LocalProvider } from './localProvider'
import type { LlmProvider } from './types'

export * from './types'
export { testLocalConnection } from './localProvider'

export function getLocalProvider(endpoint: string, model: string): LlmProvider {
  return new LocalProvider(endpoint, model)
}
