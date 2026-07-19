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

- Flip-card review: see the prompt, reveal the answer + explanation (LaTeX rendered via KaTeX), self-grade "Got it" / "Missed it", or say "I don't know" to skip straight to the rundown — the AI chat is still available afterward either way
- **AI tutor (optional):** type a free-form answer and have a self-hosted local model grade it, then keep going in a real back-and-forth conversation about the question — see [AI tutor setup](#ai-tutor-setup) below. Chat replies render full markdown (bold, lists, code, tables) plus LaTeX. Any message can be edited and resent, and any reply can be regenerated — each creates a new branch, navigable via a `‹ i/n ›` control per message, the same edit/regenerate/branch model as Claude and ChatGPT
- **Chat tab:** a standalone, general-purpose chat with the same local model, not tied to any flashcard — ask it to explain a concept, work through a derivation, or go on a tangent. Keeps multiple named conversations (auto-titled from your first message), persisted locally, with the same markdown/LaTeX rendering and edit/regenerate/branching as the per-flashcard thread
- **Create tab:** ask the local model to write N questions on anything ("attention mechanisms in transformers", "confidence intervals"), auto-tagged for filtering. The model also decides where each question belongs, reusing an existing category or creating a new one on the fly — nothing is filed manually. Saved to a growing personal question bank you can filter by tag and practice from directly. Each generated question is independently re-derived and checked by a second call before it's saved — a small prompt chain that catches wrong answers before they reach your bank, at the cost of roughly doubling generation time. Generation holds a screen wake lock where supported, so the screen won't auto-lock mid-batch -- but there's no way for a PWA to keep running once you switch to a different app or lock the screen manually, so stay on the tab for a batch to complete
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

Responses stream in as they're generated. The model may take a while to *start* replying -- cold model
loads, long conversations, and modest/partially-CPU-offloaded hardware all add to that wait, and grading,
generation, and verification calls all hit the same limit independently. **Settings → Response patience**
controls how long the app waits for that first token before giving up (2-30 minutes, default 10); once
tokens are actively streaming, a much shorter 30-second silence check takes over instead, since a stalled
stream and a slow-but-alive model look identical until you've measured which one you're in.

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

AI-generated questions (via the Create tab) are stored separately from this curated bank, in their own
`localStorage` key, keyed by id for fast lookup — so a growing personal question bank never bloats the
stats/settings writes that happen on every practice attempt. Chat tab sessions get their own key too,
for the same reason.
