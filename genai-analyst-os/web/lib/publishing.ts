import { createServiceClient } from '@/lib/supabase'
import { encryptSecret, decryptSecretIfNeeded } from '@/lib/secrets'
import { sendEmail } from '@/lib/email'

// Direct-publish connectors — same "bring your own credential" pattern as
// LLM provider keys, not a full OAuth app per platform. Real, honest
// constraints per platform, not silently degraded:
//   - Medium: a self-service "integration token" from the user's own
//     Medium settings — no developer app or approval needed, works today.
//   - LinkedIn / X: native posting APIs require an access token with the
//     right scope. Getting one still requires the user (or us, eventually)
//     to register a developer app with that platform and go through their
//     review process — an external dependency this codebase can't remove.
//     BYO-token here means: if the user already has a valid token (e.g.
//     from their own registered app, or a developer sandbox), it works;
//     tokens are short-lived and this does not handle refresh.
//   - Substack: no public posting API exists at all — "export", not publish.
//   - YouTube: Create generates a video *script*, not a rendered video file,
//     so there is nothing to actually upload — not applicable here.

export type Platform = 'medium' | 'linkedin' | 'x'

export interface PublishResult {
  ok: boolean
  url?: string
  message: string
}

export async function saveConnection(userId: string, platform: Platform, accessToken: string, extra: Record<string, unknown> = {}): Promise<void> {
  const db = createServiceClient()
  const { error } = await db.from('platform_connections').upsert({
    user_id: userId,
    platform,
    access_token: encryptSecret(accessToken),
    extra,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,platform' })
  if (error) throw error
}

export async function removeConnection(userId: string, platform: Platform): Promise<void> {
  const db = createServiceClient()
  const { error } = await db.from('platform_connections').delete().eq('user_id', userId).eq('platform', platform)
  if (error) throw error
}

export async function listConnections(userId: string): Promise<Platform[]> {
  const db = createServiceClient()
  const { data, error } = await db.from('platform_connections').select('platform').eq('user_id', userId)
  if (error) throw error
  return (data ?? []).map(r => r.platform as Platform)
}

async function getConnection(userId: string, platform: Platform): Promise<{ token: string; extra: Record<string, unknown> } | null> {
  const db = createServiceClient()
  const { data } = await db.from('platform_connections').select('access_token, extra').eq('user_id', userId).eq('platform', platform).maybeSingle()
  if (!data) return null
  return { token: decryptSecretIfNeeded(data.access_token), extra: (data.extra as Record<string, unknown>) ?? {} }
}

async function publishToMedium(userId: string, title: string, content: string): Promise<PublishResult> {
  const connection = await getConnection(userId, 'medium')
  if (!connection) return { ok: false, message: 'Medium is not connected — add your integration token in Settings.' }

  const userResponse = await fetch('https://api.medium.com/v1/me', {
    headers: { Authorization: `Bearer ${connection.token}`, Accept: 'application/json' },
  })
  const userJson = await userResponse.json()
  if (!userResponse.ok) return { ok: false, message: `Medium rejected the token: ${userJson?.errors?.[0]?.message ?? 'unknown error'}` }
  const mediumUserId = userJson?.data?.id
  if (!mediumUserId) return { ok: false, message: 'Could not resolve your Medium account from this token.' }

  const postResponse = await fetch(`https://api.medium.com/v1/users/${mediumUserId}/posts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${connection.token}`, 'content-type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      title: title.slice(0, 100) || 'Untitled',
      contentFormat: 'markdown',
      content,
      publishStatus: 'draft', // land as a draft on Medium — the user still hits publish there
    }),
  })
  const postJson = await postResponse.json()
  if (!postResponse.ok) return { ok: false, message: `Medium publish failed: ${postJson?.errors?.[0]?.message ?? 'unknown error'}` }

  return { ok: true, url: postJson?.data?.url, message: 'Saved as a draft on Medium — open it there to review and publish.' }
}

async function publishToLinkedIn(userId: string, content: string): Promise<PublishResult> {
  const connection = await getConnection(userId, 'linkedin')
  if (!connection) return { ok: false, message: 'LinkedIn is not connected — add your access token and person URN in Settings.' }
  const personUrn = connection.extra.personUrn as string | undefined
  if (!personUrn) return { ok: false, message: 'Missing your LinkedIn person URN — add it alongside the access token in Settings.' }

  const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${connection.token}`,
      'content-type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      author: personUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: content },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    }),
  })
  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}))
    return { ok: false, message: `LinkedIn publish failed (${response.status}): ${errorJson?.message ?? 'token may be expired — LinkedIn tokens last ~60 days.'}` }
  }
  return { ok: true, message: 'Published to LinkedIn.' }
}

async function publishToX(userId: string, content: string): Promise<PublishResult> {
  const connection = await getConnection(userId, 'x')
  if (!connection) return { ok: false, message: 'X is not connected — add your access token in Settings.' }

  const response = await fetch('https://api.x.com/2/tweets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${connection.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ text: content.slice(0, 280) }),
  })
  const json = await response.json().catch(() => ({}))
  if (!response.ok) return { ok: false, message: `X publish failed: ${json?.detail ?? json?.title ?? 'unknown error — check your token/scope.'}` }
  return { ok: true, message: 'Posted to X.' }
}

async function sendEmailExport(userId: string, topic: string, content: string): Promise<PublishResult> {
  const db = createServiceClient()
  const { data: profile } = await db.from('user_profiles').select('digest_email').eq('id', userId).maybeSingle()
  const toEmail = profile?.digest_email
  if (!toEmail) return { ok: false, message: 'No email on file — set your digest email in Settings first.' }

  const sent = await sendEmail({
    to: toEmail,
    subject: `Your draft: ${topic.slice(0, 80)}`,
    html: `<div style="font-family:Arial,sans-serif;white-space:pre-wrap;max-width:640px;margin:0 auto;padding:24px">${content.replace(/\n/g, '<br/>')}</div>`,
  })
  return sent
    ? { ok: true, message: `Emailed to ${toEmail}.` }
    : { ok: false, message: 'Email sending is not configured (RESEND_API_KEY/EMAIL_FROM missing) or the send failed.' }
}

export async function publishDraft(userId: string, itemId: string, platform: Platform | 'email'): Promise<PublishResult> {
  const db = createServiceClient()
  const { data: draft, error } = await db.from('draft_inbox_items').select('id, topic, final_content, published_platforms').eq('user_id', userId).eq('id', itemId).single()
  if (error) throw error

  const result = platform === 'medium' ? await publishToMedium(userId, draft.topic, draft.final_content)
    : platform === 'linkedin' ? await publishToLinkedIn(userId, draft.final_content)
    : platform === 'x' ? await publishToX(userId, draft.final_content)
    : await sendEmailExport(userId, draft.topic, draft.final_content)

  if (result.ok) {
    const published = new Set<string>(Array.isArray(draft.published_platforms) ? draft.published_platforms : [])
    published.add(platform)
    await db.from('draft_inbox_items').update({ published_platforms: Array.from(published) }).eq('id', itemId)
  }

  return result
}
