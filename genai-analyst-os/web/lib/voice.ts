export interface VoiceFingerprint {
  sentence_length: {
    average_words: number
    short_pct: number
    medium_pct: number
    long_pct: number
    typical_range: string
  }
  signature_phrases: string[]
  transitions: string[]
  certainty: {
    unhedged_topics: string[]
    qualified_topics: string[]
    hedging_patterns: string[]
  }
  paragraph_patterns: {
    openings: string[]
    closings: string[]
  }
  words_to_avoid: string[]
  tone_dimensions: {
    directness: number
    warmth: number
    technicality: number
    humor: number
  }
  voice_principles: string[]
  sample_count: number
  analyzed_at: string
}

function list(items: string[] | undefined, fallback = 'No strong pattern detected') {
  return items?.length ? items.join('; ') : fallback
}

export function buildVoiceConstitution(fingerprint: VoiceFingerprint | null | undefined) {
  if (!fingerprint) return ''
  const rhythm = fingerprint.sentence_length
  return `

AUTHOR VOICE CONSTITUTION — follow this style without copying sample text verbatim:
- Sentence rhythm: average ${rhythm.average_words} words; ${rhythm.short_pct}% short, ${rhythm.medium_pct}% medium, ${rhythm.long_pct}% long; typical range ${rhythm.typical_range}
- Signature language: ${list(fingerprint.signature_phrases)}
- Preferred transitions: ${list(fingerprint.transitions)}
- State these topics directly, without unnecessary hedging: ${list(fingerprint.certainty.unhedged_topics)}
- Qualify claims carefully in these areas: ${list(fingerprint.certainty.qualified_topics)}
- Natural qualification patterns: ${list(fingerprint.certainty.hedging_patterns)}
- Paragraph opening habits: ${list(fingerprint.paragraph_patterns.openings)}
- Paragraph closing habits: ${list(fingerprint.paragraph_patterns.closings)}
- Never use these words/phrases: ${list(fingerprint.words_to_avoid)}
- Core voice rules: ${list(fingerprint.voice_principles)}

Priority order: factual accuracy and citation rules override voice; platform constraints override sentence rhythm. Preserve the author's recognizable choices everywhere else.`
}
