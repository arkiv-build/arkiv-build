'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type MarkdownMessageProps = {
  content: string
  className?: string
}

export function MarkdownMessage({ content, className }: MarkdownMessageProps) {
  return (
    <div className={`markdown-message ${className ?? ''}`.trim()}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-2 mt-3 text-base font-bold leading-6 text-gray-950 first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-2 mt-3 text-sm font-bold leading-5 text-gray-900 first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-1.5 mt-3 text-sm font-semibold leading-5 text-gray-800 first:mt-0">{children}</h3>
          ),
          p: ({ children }) => (
            <p className="my-2 text-sm leading-6 text-gray-700 first:mt-0 last:mb-0">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="my-2 ml-5 list-disc space-y-1 text-sm leading-6 text-gray-700 marker:text-[#ff7a45]">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2 ml-5 list-decimal space-y-1 text-sm leading-6 text-gray-700 marker:text-gray-400">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="pl-1">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-bold text-gray-900">{children}</strong>
          ),
          em: ({ children }) => <em className="italic text-gray-700">{children}</em>,
          code: ({ children, className: codeClassName }) => {
            const isBlock = codeClassName?.includes('language-')
            if (isBlock) {
              return (
                <code className="block whitespace-pre-wrap break-words rounded-md bg-gray-100 px-2 py-1 font-mono text-[11px] text-gray-800">
                  {children}
                </code>
              )
            }
            return (
              <code className="rounded bg-[#fff0e8] px-1 py-0.5 font-mono text-[11px] text-[#c2410c]">
                {children}
              </code>
            )
          },
          pre: ({ children }) => (
            <pre className="my-3 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs leading-5 text-gray-800">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-3 border-l-2 border-[#ffc4a6] pl-3 text-sm italic text-gray-600">
              {children}
            </blockquote>
          ),
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-[#ff7a45] underline underline-offset-2 hover:text-[#e66a39]"
            >
              {children}
            </a>
          ),
          hr: () => <hr className="my-2 border-gray-200" />,
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-gray-200 px-2 py-1 text-left font-bold text-gray-800">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-gray-100 px-2 py-1 text-gray-700">{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
