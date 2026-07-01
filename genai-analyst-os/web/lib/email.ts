// Minimal Resend REST call — no SDK dependency, mirrors the same
// RESEND_API_KEY/EMAIL_FROM env vars the Python daily-digest email already
// uses, so no new secrets are needed to enable this.
export async function sendEmail(params: { to: string; subject: string; html: string }): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!apiKey || !from || !params.to) return false

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ from, to: params.to, subject: params.subject, html: params.html }),
  })
  return response.ok
}
