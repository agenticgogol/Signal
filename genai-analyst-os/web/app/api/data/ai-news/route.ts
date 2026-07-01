import { fetchAiNewsStories, fetchTrendingEntities } from '@/lib/aiNews'

export const revalidate = 0

export async function GET() {
  const [stories, trending] = await Promise.all([fetchAiNewsStories(), fetchTrendingEntities()])
  return Response.json({ stories, trending, fetchedAt: new Date().toISOString() })
}
