import { fetchAiNewsStories } from '@/lib/aiNews'

export const revalidate = 0

export async function GET() {
  const stories = await fetchAiNewsStories()
  return Response.json({ stories, fetchedAt: new Date().toISOString() })
}
