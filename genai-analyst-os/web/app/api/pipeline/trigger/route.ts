export async function POST() {
  const userId = process.env.NEXT_PUBLIC_USER_ID!
  const pipelineUrl = process.env.NEXT_PUBLIC_PIPELINE_URL || 'http://localhost:8000'

  try {
    const r = await fetch(`${pipelineUrl}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userId, session_id: `web-${Date.now()}` }),
      signal: AbortSignal.timeout(360000),
    })
    const data = await r.json()
    return Response.json({ ok: true, ...data })
  } catch (err) {
    return Response.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
