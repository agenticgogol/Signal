export async function POST() {
  const pat = process.env.GITHUB_PAT
  if (!pat) {
    return Response.json({ ok: false, error: 'GITHUB_PAT not configured' }, { status: 500 })
  }

  const res = await fetch(
    'https://api.github.com/repos/agenticgogol/Signal/actions/workflows/daily-pipeline.yml/dispatches',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref: 'master' }),
    }
  )

  // GitHub returns 204 No Content on success
  if (res.status === 204) {
    return Response.json({ ok: true, async: true })
  }

  const body = await res.text()
  return Response.json({ ok: false, error: body }, { status: res.status })
}
