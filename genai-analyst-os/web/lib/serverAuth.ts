import { createClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'
import { verifyAdminToken } from '@/lib/adminAuth'

function createAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing Supabase anon env vars.')
  return createClient(url, key)
}

export async function requireSignedInUser(req: Request, expectedUserId?: string): Promise<User | Response> {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization')
  const token = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token) {
    return Response.json({ error: 'Authentication required.' }, { status: 401 })
  }

  const supabase = createAnonClient()
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) {
    return Response.json({ error: 'Invalid session.' }, { status: 401 })
  }

  if (expectedUserId && data.user.id !== expectedUserId) {
    return Response.json({ error: 'User mismatch.' }, { status: 403 })
  }

  return data.user
}

export function getAdminWorkspaceUserId() {
  return process.env.KNOWLEDGE_ADMIN_USER_ID || process.env.NEXT_PUBLIC_USER_ID || ''
}

export async function resolveSignedInOrAdmin(req: Request, requestedUserId?: string): Promise<{ userId: string; mode: 'signed_in' | 'admin_guest'; user?: User } | Response> {
  if (verifyAdminToken(req)) {
    const adminUserId = requestedUserId || getAdminWorkspaceUserId()
    if (!adminUserId) {
      return Response.json({ error: 'Missing KNOWLEDGE_ADMIN_USER_ID or NEXT_PUBLIC_USER_ID for admin knowledge workspace.' }, { status: 500 })
    }
    return { userId: adminUserId, mode: 'admin_guest' }
  }

  const signedIn = await requireSignedInUser(req, requestedUserId)
  if (signedIn instanceof Response) return signedIn

  return {
    userId: requestedUserId || signedIn.id,
    mode: 'signed_in',
    user: signedIn,
  }
}
