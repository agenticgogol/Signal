import { verifyAdminToken } from '@/lib/adminAuth'

export async function POST(req: Request) {
  if (!verifyAdminToken(req)) {
    return Response.json({ ok: false, error: 'Admin authentication required' }, { status: 401 })
  }

  const pat = process.env.GITHUB_PAT
  if (!pat) {
    return Response.json({ ok: false, error: 'GITHUB_PAT not configured' }, { status: 500 })
  }

  let lookbackDays = '7'
  let maxPerSource = '5'
  try {
    const body = await req.json()
    if ([1, 3, 7, 14].includes(Number(body.lookbackDays))) lookbackDays = String(body.lookbackDays)
    if ([1, 3, 5, 10].includes(Number(body.maxPerSource))) maxPerSource = String(body.maxPerSource)
  } catch {}

  const res = await fetch(
    'https://api.github.com/repos/agenticgogol/Signal/actions/workflows/daily-pipeline.yml/dispatches',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: 'master',
        inputs: {
          lookback_days: lookbackDays,
          max_per_source: maxPerSource,
        },
      }),
    }
  )

  if (res.status === 204) {
    return Response.json({ ok: true, async: true })
  }

  const body = await res.text()
  return Response.json({ ok: false, error: body }, { status: res.status })
}
