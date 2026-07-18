import { Fragment, useMemo } from 'react'
import katex from 'katex'

function renderMath(math: string, displayMode: boolean): string {
  try {
    return katex.renderToString(math, { throwOnError: false, displayMode })
  } catch {
    return math
  }
}

interface MathTextProps {
  text: string
  className?: string
}

// Prefers $inline$ / $$block$$, but some models default to \(inline\) / \[block\] regardless of
// what the prompt asks for -- support both so real LaTeX never shows up as raw backslash text.
const MATH_PATTERN = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+?\$|\\\([^\n]+?\\\))/g

/** Renders a string containing plain text mixed with LaTeX math in either delimiter style. */
export function MathText({ text, className }: MathTextProps) {
  const parts = useMemo(() => text.split(MATH_PATTERN).filter((s) => s.length > 0), [text])

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.startsWith('$$') && part.endsWith('$$')) {
          return <span key={i} dangerouslySetInnerHTML={{ __html: renderMath(part.slice(2, -2), true) }} />
        }
        if (part.startsWith('\\[') && part.endsWith('\\]')) {
          return <span key={i} dangerouslySetInnerHTML={{ __html: renderMath(part.slice(2, -2), true) }} />
        }
        if (part.startsWith('$') && part.endsWith('$')) {
          return <span key={i} dangerouslySetInnerHTML={{ __html: renderMath(part.slice(1, -1), false) }} />
        }
        if (part.startsWith('\\(') && part.endsWith('\\)')) {
          return <span key={i} dangerouslySetInnerHTML={{ __html: renderMath(part.slice(2, -2), false) }} />
        }
        return <Fragment key={i}>{part}</Fragment>
      })}
    </span>
  )
}
