# MatPrac

A flashcard PWA for staying sharp on the math behind data science and AI engineering.

## Topics

- Percentages & mental math
- Linear algebra
- Probability & statistics
- Calculus, optimization & ML theory (backprop, entropy, attention math, etc.)

## Features

- Flip-card review: see the prompt, reveal the answer + explanation (LaTeX rendered via KaTeX), self-grade "Got it" / "Missed it"
- Adaptive session queue: weights unseen, weak, and stale cards higher (SRS-lite)
- Stats dashboard: per-topic accuracy, cards mastered, practice-day streak, weakest subtopics
- Installable PWA with offline support (works on the home screen on iOS/Android)
- All progress stored locally (`localStorage`), no account or backend required

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
