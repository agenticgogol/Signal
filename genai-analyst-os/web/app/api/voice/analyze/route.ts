import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requirePaidFeature } from '@/lib/featureAccess'
import type { VoiceFingerprint } from '@/lib/voice'
import { generateJsonForUser } from '@/lib/llmClient'

export const maxDuration = 60

const VOICE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    signature_phrases: { type: 'array', items: { type: 'string' } },
    transitions: { type: 'array', items: { type: 'string' } },
    certainty: {
      type: 'object',
      additionalProperties: false,
      properties: {
        unhedged_topics: { type: 'array', items: { type: 'string' } },
        qualified_topics: { type: 'array', items: { type: 'string' } },
        hedging_patterns: { type: 'array', items: { type: 'string' } },
      },
      required: ['unhedged_topics', 'qualified_topics', 'hedging_patterns'],
    },
    paragraph_patterns: {
      type: 'object',
      additionalProperties: false,
      properties: {
        openings: { type: 'array', items: { type: 'string' } },
        closings: { type: 'array', items: { type: 'string' } },
      },
      required: ['openings', 'closings'],
    },
    words_to_avoid: { type: 'array', items: { type: 'string' } },
    tone_dimensions: {
      type: 'object',
      additionalProperties: false,
      properties: {
        directness: { type: 'integer' },
        warmth: { type: 'integer' },
        technicality: { type: 'integer' },
        humor: { type: 'integer' },
      },
      required: ['directness', 'warmth', 'technicality', 'humor'],
    },
    voice_principles: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'signature_phrases', 'transitions', 'certainty', 'paragraph_patterns',
    'words_to_avoid', 'tone_dimensions', 'voice_principles',
  ],
} as const

function sentenceMetrics(posts: string[]): VoiceFingerprint['sentence_length'] {
  const sentences = posts
    .flatMap(post => post.match(/[^.!?\n]+[.!?]+|[^.!?\n]+$/g) ?? [])
    .map(sentence => sentence.trim().split(/\s+/).filter(Boolean).length)
    .filter(Boolean)
  const total = Math.max(1, sentences.length)
  const average = sentences.reduce((sum, length) => sum + length, 0) / total
  const percentage = (count: number) => Math.round((count / total) * 100)
  const sorted = [...sentences].sort((a, b) => a - b)
  const low = sorted[Math.floor((sorted.length - 1) * 0.2)] ?? 0
  const high = sorted[Math.floor((sorted.length - 1) * 0.8)] ?? 0
  return {
    average_words: Number(average.toFixed(1)),
    short_pct: percentage(sentences.filter(length => length <= 10).length),
    medium_pct: percentage(sentences.filter(length => length > 10 && length <= 20).length),
    long_pct: percentage(sentences.filter(length => length > 20).length),
    typical_range: `${low}–${high} words`,
  }
}

function clampScore(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(10, Math.max(1, Math.round(number))) : 5
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(item => String(item).trim()).filter(Boolean) : []
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const userId = String(body.userId ?? '')
    const posts = (Array.isArray(body.posts) ? body.posts : [])
      .map((post: unknown) => String(post).trim())
      .filter(Boolean)

    if (!userId) {
      return Response.json({ error: 'userId is required' }, { status: 400 })
    }
    if (!userId || posts.length < 3 || posts.length > 5) {
      return Response.json({ error: 'Provide a userId and 3–5 writing samples' }, { status: 400 })
    }
    if (posts.some((post: string) => post.length < 150)) {
      return Response.json({ error: 'Each writing sample must contain at least 150 characters' }, { status: 400 })
    }
    if (posts.reduce((sum: number, post: string) => sum + post.length, 0) > 50000) {
      return Response.json({ error: 'Writing samples exceed the 50,000-character limit' }, { status: 400 })
    }
    const paidGate = await requirePaidFeature(req, userId, 'Voice Fingerprinting')
    if (paidGate) return paidGate

    const samples = posts.map((post: string, index: number) => `--- SAMPLE ${index + 1} ---\n${post}`).join('\n\n')
    const analysis = await generateJsonForUser<Record<string, unknown>>({
      userId,
      system: `You are a forensic writing-style analyst. Infer repeatable stylistic choices from the author's samples, not their factual content. Be conservative: report a pattern only when it appears across multiple samples. Never copy long phrases. "words_to_avoid" should capture conspicuously absent AI clichés or diction that conflicts with the author's established voice. Tone scores are integers from 1 (low) to 10 (high). Return 4-8 practical voice principles that a ghostwriter can execute.`,
      prompt: `Analyze these ${posts.length} posts and extract the author's reusable voice fingerprint.\n\n${samples}`,
      schema: VOICE_SCHEMA,
      maxTokens: 2600,
    })
    if (!analysis) throw new Error('Voice Analyst returned no structured result')

    const certainty = typeof analysis.certainty === 'object' && analysis.certainty ? analysis.certainty as Record<string, unknown> : {}
    const paragraphPatterns = typeof analysis.paragraph_patterns === 'object' && analysis.paragraph_patterns ? analysis.paragraph_patterns as Record<string, unknown> : {}
    const tone = typeof analysis.tone_dimensions === 'object' && analysis.tone_dimensions ? analysis.tone_dimensions as Record<string, unknown> : {}

    const fingerprint: VoiceFingerprint = {
      signature_phrases: toStringArray(analysis.signature_phrases),
      transitions: toStringArray(analysis.transitions),
      certainty: {
        unhedged_topics: toStringArray(certainty.unhedged_topics),
        qualified_topics: toStringArray(certainty.qualified_topics),
        hedging_patterns: toStringArray(certainty.hedging_patterns),
      },
      paragraph_patterns: {
        openings: toStringArray(paragraphPatterns.openings),
        closings: toStringArray(paragraphPatterns.closings),
      },
      words_to_avoid: toStringArray(analysis.words_to_avoid),
      tone_dimensions: {
        directness: clampScore(tone.directness),
        warmth: clampScore(tone.warmth),
        technicality: clampScore(tone.technicality),
        humor: clampScore(tone.humor),
      },
      voice_principles: toStringArray(analysis.voice_principles),
      sentence_length: sentenceMetrics(posts),
      sample_count: posts.length,
      analyzed_at: new Date().toISOString(),
    }

    const { error } = await createServiceClient()
      .from('user_profiles')
      .update({ voice_fingerprint: fingerprint, updated_at: fingerprint.analyzed_at })
      .eq('id', userId)

    if (error) throw error
    return Response.json({ fingerprint })
  } catch (error) {
    console.error('voice_analysis_failed', error)
    return Response.json({ error: 'Voice analysis failed. Check the samples and try again.' }, { status: 500 })
  }
}
