import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: NextRequest) {
  const { topic, audience, angle, focusAreas } = await req.json()

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
      messages: [{ role: 'user', content: prompt }],
    })
    const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const match = text.match(/\{[\s\S]*\}/)
    const outline = match ? JSON.parse(match[0]) : null
    return Response.json({ outline })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
