import { NextRequest } from 'next/server'

// Simple admin auth — credentials stored in env vars
export async function POST(req: NextRequest) {
  const { username, password } = await req.json()
  const expectedUser = process.env.ADMIN_USERNAME ?? 'admin'
  const expectedPass = process.env.ADMIN_PASSWORD ?? 'signal2024'

  if (username === expectedUser && password === expectedPass) {
    // Token is just base64(user:pass) — verified server-side on each protected call
    const token = Buffer.from(`${username}:${password}`).toString('base64')
    return Response.json({ ok: true, token })
  }
  return Response.json({ ok: false, error: 'Invalid credentials' }, { status: 401 })
}

// Middleware helper: other routes import this to verify the admin token
export function verifyAdminToken(req: NextRequest): boolean {
  const authHeader = req.headers.get('x-admin-token') ?? ''
  const expectedUser = process.env.ADMIN_USERNAME ?? 'admin'
  const expectedPass = process.env.ADMIN_PASSWORD ?? 'signal2024'
  const expected = Buffer.from(`${expectedUser}:${expectedPass}`).toString('base64')
  return authHeader === expected
}
