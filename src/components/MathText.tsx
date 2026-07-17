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

/** Renders a string containing plain text mixed with $inline$ and $$block$$ LaTeX math. */
export function MathText({ text, className }: MathTextProps) {
  const parts = useMemo(() => {
    const regex = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g
    return text.split(regex).filter((s) => s.length > 0)
  }, [text])

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.startsWith('$$') && part.endsWith('$$')) {
          return <span key={i} dangerouslySetInnerHTML={{ __html: renderMath(part.slice(2, -2), true) }} />
        }
        if (part.startsWith('$') && part.endsWith('$')) {
          return (
            <span key={i} dangerouslySetInnerHTML={{ __html: renderMath(part.slice(1, -1), false) }} />
          )
        }
        return <Fragment key={i}>{part}</Fragment>
      })}
    </span>
  )
}
