import { fetchAiNewsStories, fetchTrendingEntities, persistNewsStories } from '@/lib/aiNews'

export const revalidate = 0

export async function GET() {
  const [stories, trending] = await Promise.all([fetchAiNewsStories(), fetchTrendingEntities()])
  // Best-effort — persisting is what makes News referenceable in the Today
  // queue, the content picker, and Ask Signal, but a write hiccup here
  // should never break the tab that's just trying to show headlines.
  persistNewsStories(stories).catch(() => {})
  return Response.json({ stories, trending, fetchedAt: new Date().toISOString() })
}
