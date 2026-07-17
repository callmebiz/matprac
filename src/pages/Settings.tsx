import { useState } from 'react'
import { useSettingsStore } from '../store/useSettingsStore'
import { testLocalConnection, LlmError } from '../llm'

type TestStatus = { state: 'idle' } | { state: 'testing' } | { state: 'ok' } | { state: 'error'; message: string }

export function Settings() {
  const { aiTutorEnabled, endpoint, model, setAiTutorEnabled, setEndpoint, setModel } = useSettingsStore()
  const [draftEndpoint, setDraftEndpoint] = useState(endpoint)
  const [draftModel, setDraftModel] = useState(model)
  const [test, setTest] = useState<TestStatus>({ state: 'idle' })

  function saveAndTest() {
    setEndpoint(draftEndpoint)
    setModel(draftModel)
    setTest({ state: 'testing' })
    testLocalConnection(draftEndpoint, draftModel)
      .then(() => setTest({ state: 'ok' }))
      .catch((err) => {
        const message = err instanceof LlmError ? err.message : 'Something went wrong reaching the model.'
        setTest({ state: 'error', message })
      })
  }

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-28">
      <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-6">Settings</h1>

      <section className="mb-8">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">AI tutor</h2>
          <button
            role="switch"
            aria-checked={aiTutorEnabled}
            onClick={() => setAiTutorEnabled(!aiTutorEnabled)}
            className={`w-11 h-6 rounded-full relative transition-colors ${
              aiTutorEnabled ? 'bg-indigo-600' : 'bg-neutral-300 dark:bg-neutral-700'
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                aiTutorEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
          When enabled, flashcards let you type a free-form answer and get graded by a self-hosted local model
          instead of (or before) self-grading.
        </p>

        <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-1.5">
          Endpoint (OpenAI-compatible)
        </label>
        <input
          value={draftEndpoint}
          onChange={(e) => setDraftEndpoint(e.target.value)}
          placeholder="http://localhost:11434/v1"
          className="w-full rounded-xl border border-neutral-900/10 dark:border-white/10 bg-transparent px-3.5 py-2.5 text-sm text-neutral-900 dark:text-neutral-100 mb-3"
        />

        <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-1.5">
          Model name
        </label>
        <input
          value={draftModel}
          onChange={(e) => setDraftModel(e.target.value)}
          placeholder="llama3.1"
          className="w-full rounded-xl border border-neutral-900/10 dark:border-white/10 bg-transparent px-3.5 py-2.5 text-sm text-neutral-900 dark:text-neutral-100 mb-4"
        />

        <button
          onClick={saveAndTest}
          disabled={test.state === 'testing'}
          className="w-full rounded-2xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold py-3 text-sm disabled:opacity-50"
        >
          {test.state === 'testing' ? 'Testing…' : 'Save & test connection'}
        </button>
        {test.state === 'testing' && (
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-2">
            First request after starting the model server can take a while — it has to load the model into
            memory. Subsequent ones are fast.
          </p>
        )}

        {test.state === 'ok' && (
          <p className="text-sm text-emerald-500 font-medium mt-3">✓ Connected — the model responded.</p>
        )}
        {test.state === 'error' && <p className="text-sm text-red-500 mt-3">{test.message}</p>}

        <div className="mt-5 rounded-2xl bg-neutral-900/[0.03] dark:bg-white/[0.04] p-4 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
          <p className="mb-2">
            Works with <strong>Ollama</strong>, <strong>LM Studio</strong>, or anything exposing an
            OpenAI-compatible <code>/chat/completions</code> route. With Ollama, run it with{' '}
            <code>OLLAMA_ORIGINS="{typeof window !== 'undefined' ? window.location.origin : '*'}"</code> set so the
            browser is allowed to call it.
          </p>
          <p>
            This only works from the same device running the model — browsers block a secure page (this one) from
            calling an insecure address on your local network. To use it from your phone, tunnel your local server
            over HTTPS (e.g. Tailscale Serve) or run the model on the same device as the browser.
          </p>
        </div>
      </section>

      <section className="opacity-50">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-1">Claude (cloud)</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Coming soon — will route through a secure proxy so no API key is ever stored in this app.
        </p>
      </section>
    </div>
  )
}
