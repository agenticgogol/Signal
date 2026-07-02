'use client'

import { Fragment } from 'react'

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Wraps concept_terms found in a piece of text as clickable spans — the
// inline entry point into the AI Tutor. Longest-term-first matching avoids
// a short term (e.g. "RAG") shadowing a longer one that contains it
// (e.g. "Agentic RAG") when both appear in the same article's concept_terms.
export default function ConceptHighlighter({ text, terms, onTermClick }: {
  text: string
  terms: string[]
  onTermClick: (term: string) => void
}) {
  if (!text || !terms || terms.length === 0) return <>{text}</>

  const uniqueTerms = Array.from(new Set(terms.filter(t => t && t.trim()))).sort((a, b) => b.length - a.length)
  if (uniqueTerms.length === 0) return <>{text}</>

  const pattern = new RegExp(`(${uniqueTerms.map(escapeRegExp).join('|')})`, 'gi')
  const parts = text.split(pattern)

  return (
    <>
      {parts.map((part, i) => {
        const isMatch = uniqueTerms.some(t => t.toLowerCase() === part.toLowerCase())
        if (!isMatch) return <Fragment key={i}>{part}</Fragment>
        return (
          <button
            key={i}
            onClick={e => { e.stopPropagation(); onTermClick(part) }}
            className="underline decoration-dotted decoration-violet-400 dark:decoration-violet-500 underline-offset-2 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/40 rounded px-0.5 font-medium"
            title={`Explain "${part}"`}
          >
            {part}
          </button>
        )
      })}
    </>
  )
}
