import { runDailyDraftsInboxJob } from '@/lib/draftsInbox'
import { getErrorMessage } from '@/lib/errors'

export const maxDuration = 300

// Triggered once a day by a GitHub Actions cron (see
// .github/workflows/drafts-inbox.yml), not reachable without the shared
// secret. Only processes users who explicitly opted in via Settings
// (user_profiles.drafts_inbox_enabled) — this route itself does no
// additional gating decision, the opt-in flag is the gate.
export async function POST(req: Request) {
  const secret = req.headers.get('x-cron-secret')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runDailyDraftsInboxJob()
    return Response.json(result)
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
