import { NextRequest } from 'next/server'
import { adminCredentialsMatch, createAdminToken } from '@/lib/adminAuth'

// Simple admin auth — credentials stored in env vars
export async function POST(req: NextRequest) {
  const { username, password } = await req.json()
  if (adminCredentialsMatch(username, password)) {
    // Return an irreversible session token derived from the configured credentials.
    return Response.json({ ok: true, token: createAdminToken() })
  }
  return Response.json({ ok: false, error: 'Invalid credentials' }, { status: 401 })
}
