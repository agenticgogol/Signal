import crypto from 'node:crypto'

const PREFIX = 'enc:v1'

function encryptionKey() {
  const raw = process.env.APP_ENCRYPTION_KEY || process.env.USER_SECRETS_KEY || ''
  if (!raw) throw new Error('Missing APP_ENCRYPTION_KEY.')

  const trimmed = raw.trim()
  try {
    const decoded = Buffer.from(trimmed, 'base64')
    if (decoded.length === 32 && decoded.toString('base64').replace(/=+$/, '') === trimmed.replace(/=+$/, '')) {
      return decoded
    }
  } catch {}

  return crypto.createHash('sha256').update(trimmed).digest()
}

export function isEncryptedSecret(value: string | null | undefined) {
  return Boolean(value && value.startsWith(`${PREFIX}:`))
}

export function encryptSecret(plaintext: string) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [
    PREFIX,
    iv.toString('base64'),
    encrypted.toString('base64'),
    tag.toString('base64'),
  ].join(':')
}

export function decryptSecret(value: string) {
  if (!isEncryptedSecret(value)) return value

  const [, version, ivB64, encryptedB64, tagB64] = value.split(':')
  if (version !== 'v1' || !ivB64 || !encryptedB64 || !tagB64) {
    throw new Error('Encrypted secret payload is malformed.')
  }

  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedB64, 'base64')),
    decipher.final(),
  ])
  return decrypted.toString('utf8')
}

export function decryptSecretIfNeeded(value: string | null | undefined) {
  const text = String(value || '').trim()
  if (!text) return ''
  return decryptSecret(text)
}

export function maskStoredSecret(value: string | null | undefined) {
  const text = String(value || '').trim()
  if (!text) return ''
  if (isEncryptedSecret(text)) return 'Stored securely'
  if (text.length <= 8) return '••••••••'
  return `${text.slice(0, 4)}••••${text.slice(-4)}`
}
