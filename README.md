# MatPrac

A flashcard PWA for staying sharp on the math behind data science and AI engineering.

## Topics

- Percentages & mental math
- Linear algebra
- Probability & statistics
- Calculus, optimization & ML theory (backprop, entropy, attention math, etc.)

120 curated questions across the four topics (30 each), covering everything from mental-math
percentage tricks to attention math and LoRA fine-tuning.

## Features

- Flip-card review: see the prompt, reveal the answer + explanation (LaTeX rendered via KaTeX), self-grade "Got it" / "Missed it"
- **AI tutor (optional):** type a free-form answer and have a self-hosted local model grade it, with feedback and a follow-up question — see [AI tutor setup](#ai-tutor-setup) below
- **Question generation (optional):** with the AI tutor enabled, generate a fresh question for the current topic on demand
- Adaptive session queue: weights unseen, weak, and stale cards higher (SRS-lite)
- Stats dashboard: per-topic accuracy, cards mastered, practice-day streak, weakest subtopics
- Installable PWA with offline support (works on the home screen on iOS/Android)
- All progress and settings stored locally (`localStorage`), no account or backend required

## AI tutor setup

The AI tutor talks to **any local server exposing an OpenAI-compatible `/chat/completions` route** —
[Ollama](https://ollama.com) and [LM Studio](https://lmstudio.ai) both work out of the box. Configure it
in the app's Settings tab: endpoint URL + model name, no API key needed.

```bash
# Ollama example
OLLAMA_ORIGINS="https://callmebiz.github.io" ollama serve
ollama pull llama3.1
# Settings -> endpoint: http://localhost:11434/v1, model: llama3.1
```

**Two things worth knowing:**
- `OLLAMA_ORIGINS` (or equivalent CORS config) must allow the app's origin, or the browser will block the request.
- This only works from the same device running the model — a secure page (`https://`) cannot call an
  insecure address (`http://`) on your local network due to browser mixed-content blocking. `localhost`
  is exempt, so it works seamlessly on the same machine. To reach it from your phone, tunnel the local
  server over HTTPS (e.g. [Tailscale Serve](https://tailscale.com/kb/1312/serve)).

No secrets are involved in this path — nothing is sent anywhere except your own local server.

There's no cloud LLM option yet. If one is added later, it will go through a server-side proxy that holds
any API key as a platform secret — an API key must never be embedded in this app's client code, since it's
a public static site.

## Development

```bash
npm install
npm run dev      # start dev server
npm run build    # type-check + production build
npm run preview  # preview the production build
```

## Adding questions

Question banks live in `src/data/questions/*.ts`, one file per topic. Each `Question` has a `prompt`,
`answer`, and optional `explanation`, all of which support inline (`$...$`) and block (`$$...$$`) LaTeX.
