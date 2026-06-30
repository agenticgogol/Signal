import { fetchAiNews } from '@/lib/aiNews'

export const revalidate = 0

export async function GET() {
  const items = await fetchAiNews()
  return Response.json({ items, fetchedAt: new Date().toISOString() })
}
