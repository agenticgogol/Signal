import { runRepublishAgent, PLATFORM_SPECS, type SourceArticle } from '@/lib/agents'
import { createServiceClient } from '@/lib/supabase'
import { requirePaidFeature } from '@/lib/featureAccess'
import type { VoiceFingerprint } from '@/lib/voice'

export const maxDuration = 120

const ALL_FORMATS = Object.keys(PLATFORM_SPECS)

export async function POST(req: Request) {
  const { userId, approvedContent, sourceFormat, sources, targetFormats } = await req.json()
  if (!userId || !approvedContent || !sourceFormat) {
    return Response.json({ error: 'userId, approvedContent, and sourceFormat are required' }, { status: 400 })
  }

  const paidGate = await requirePaidFeature(req, userId, 'Republish Pack')
  if (paidGate) return paidGate

  let voiceFingerprint: VoiceFingerprint | null = null
  const { data } = await createServiceClient()
    .from('user_profiles')
    .select('voice_fingerprint')
    .eq('id', userId)
    .maybeSingle()
  voiceFingerprint = (data?.voice_fingerprint as VoiceFingerprint | null) ?? null

  const targets: string[] = Array.isArray(targetFormats) && targetFormats.length > 0
    ? targetFormats.filter((f: string) => ALL_FORMATS.includes(f) && f !== sourceFormat)
    : ALL_FORMATS.filter(f => f !== sourceFormat)

  const sourceArticles: SourceArticle[] = Array.isArray(sources) ? sources : []

  const results = await Promise.allSettled(
    targets.map(async format => ({
      format,
      content: await runRepublishAgent(userId, approvedContent, sourceFormat, format, sourceArticles, voiceFingerprint),
    }))
  )

  const pack = results
    .map(r => r.status === 'fulfilled' ? r.value : null)
    .filter((r): r is { format: string; content: string } => r !== null)

  const failures = results.filter(r => r.status === 'rejected').length

  return Response.json({ pack, failures })
}
