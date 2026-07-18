import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'

interface MarkdownTextProps {
  text: string
  className?: string
}

// remark-math only recognizes $...$ / $$...$$, but some models keep using \( \) / \[ \] despite the
// prompt asking otherwise -- normalize before handing off so real LaTeX never shows as raw text.
function normalizeLatexDelimiters(text: string): string {
  return text
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, inner: string) => `$$${inner}$$`)
    .replace(/\\\(([^\n]+?)\\\)/g, (_, inner: string) => `$${inner}$`)
}

const components: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2">
      {children}
    </a>
  ),
  ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-0.5">{children}</ol>,
  h1: ({ children }) => <h3 className="text-base font-bold mb-1.5 mt-1 first:mt-0">{children}</h3>,
  h2: ({ children }) => <h3 className="text-sm font-bold mb-1.5 mt-1 first:mt-0">{children}</h3>,
  h3: ({ children }) => <h3 className="text-sm font-semibold mb-1 mt-1 first:mt-0">{children}</h3>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-current/30 pl-3 italic opacity-90 mb-2">{children}</blockquote>
  ),
  code: ({ className, children, ...props }) => {
    if (/language-/.test(className ?? '')) {
      return (
        <code className={`block ${className ?? ''}`} {...props}>
          {children}
        </code>
      )
    }
    return (
      <code className="rounded bg-black/10 dark:bg-white/10 px-1 py-0.5 text-[0.85em] font-mono" {...props}>
        {children}
      </code>
    )
  },
  pre: ({ children }) => (
    <pre className="rounded-lg bg-black/10 dark:bg-white/10 p-2.5 overflow-x-auto text-[0.85em] font-mono mb-2">
      {children}
    </pre>
  ),
  table: ({ children }) => <div className="overflow-x-auto mb-2">
    <table className="text-xs border-collapse">{children}</table>
  </div>,
  th: ({ children }) => <th className="border border-current/20 px-2 py-1 text-left font-semibold">{children}</th>,
  td: ({ children }) => <td className="border border-current/20 px-2 py-1">{children}</td>,
}

/** Renders LLM chat output: markdown (bold, lists, code, tables, links) plus LaTeX math via KaTeX. */
export function MarkdownText({ text, className }: MarkdownTextProps) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={components}>
        {normalizeLatexDelimiters(text)}
      </ReactMarkdown>
    </div>
  )
}
