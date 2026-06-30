import { createHash, timingSafeEqual } from 'crypto'

function credentials() {
  const username = process.env.ADMIN_USERNAME
  const password = process.env.ADMIN_PASSWORD
  return username && password ? { username, password } : null
}

export function adminCredentialsMatch(username: string, password: string) {
  const expected = credentials()
  if (!expected) return false
  const supplied = Buffer.from(`${username}\0${password}`)
  const wanted = Buffer.from(`${expected.username}\0${expected.password}`)
  return supplied.length === wanted.length && timingSafeEqual(supplied, wanted)
}

export function createAdminToken() {
  const expected = credentials()
  if (!expected) return null
  return createHash('sha256')
    .update(`signal-admin-session:${expected.username}:${expected.password}`)
    .digest('hex')
}

export function verifyAdminToken(req: Request) {
  const expected = createAdminToken()
  const supplied = req.headers.get('x-admin-token')
  if (!expected || !supplied) return false
  const suppliedBuffer = Buffer.from(supplied)
  const expectedBuffer = Buffer.from(expected)
  return suppliedBuffer.length === expectedBuffer.length && timingSafeEqual(suppliedBuffer, expectedBuffer)
}
