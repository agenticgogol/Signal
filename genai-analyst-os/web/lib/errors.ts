// Supabase-js throws plain PostgrestError-shaped objects ({ message, code,
// details, hint }), not real Error instances — `error instanceof Error` is
// false for them, so the common "instanceof Error ? error.message :
// String(error)" pattern silently degrades to the literal string
// "[object Object]" for every DB error. This extracts a real message from
// either shape (or anything else that gets thrown) so API error responses
// are always readable instead of that useless placeholder.
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message
  }
  if (typeof err === 'string') return err
  try {
    return JSON.stringify(err)
  } catch {
    return String(err)
  }
}
