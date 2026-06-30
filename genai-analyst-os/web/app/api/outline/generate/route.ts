import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'
import { requirePaidFeature } from '@/lib/featureAccess'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const OUTLINE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    sections: {
      type: 'array',
      description: 'Four to six content sections.',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          points: { type: 'array', description: 'Three to four concrete points.', items: { type: 'string' } },
        },
        required: ['title', 'points'],
      },
    },
    angle: { type: 'string' },
    audience: { type: 'string' },
    hook: { type: 'string' },
    format_recommendation: {
      type: 'string',
      enum: ['linkedin', 'substack', 'thread', 'blog', 'youtube_long', 'youtube_short'],
    },
  },
  required: ['sections', 'angle', 'audience', 'hook', 'format_recommendation'],
} as const

export async function POST(req: NextRequest) {
  const { topic, audience, angle, focusAreas, userId } = await req.json()
  if (!userId) {
    return Response.json({ error: 'userId is required' }, { status: 400 })
  }
  const paidGate = await requirePaidFeature(req, userId, 'AI outlines')
  if (paidGate) return paidGate

  const prompt = `You are an expert content strategist. Generate a detailed content outline for a GenAI practitioner's content.

Topic: ${topic}
Target audience: ${audience}
Angle: ${angle}
Focus areas: ${(focusAreas as string[]).join(', ')}

Return ONLY a JSON object with this exact structure:
{
  "sections": [
    { "title": "Section heading", "points": ["bullet point 1", "bullet point 2", "bullet point 3"] }
  ],
  "angle": "the specific angle to take",
  "audience": "description of target reader",
  "hook": "a compelling opening line or hook",
  "format_recommendation": "linkedin|substack|thread|blog|youtube_long|youtube_short"
}

Include 4-6 sections. Each section should have 3-4 bullet points.`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      output_config: { format: { type: 'json_schema', schema: OUTLINE_SCHEMA } },
      messages: [{ role: 'user', content: prompt }],
    })
    const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const outline = JSON.parse(text)
    if (!Array.isArray(outline.sections) || outline.sections.length < 4 || outline.sections.length > 6) {
      throw new Error('Claude returned an outline outside the required 4–6 section range')
    }
    return Response.json({ outline })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
