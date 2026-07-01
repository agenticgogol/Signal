// Fetches a YouTube video's caption track without any API key — the same
// no-key approach used by most open-source transcript tools: load the
// public watch page, pull the caption track list out of the embedded
// ytInitialPlayerResponse JSON, then fetch and strip that track's XML.
// Videos without any captions (auto-generated or uploaded) simply have
// nothing to extract — that's surfaced as a clear error, not a silent
// empty summary.

export function extractYouTubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url.trim())
    if (parsed.hostname.includes('youtu.be')) return parsed.pathname.slice(1) || null
    if (parsed.hostname.includes('youtube.com')) {
      if (parsed.pathname === '/watch') return parsed.searchParams.get('v')
      if (parsed.pathname.startsWith('/shorts/')) return parsed.pathname.split('/')[2] || null
      if (parsed.pathname.startsWith('/live/')) return parsed.pathname.split('/')[2] || null
    }
    return null
  } catch {
    return null
  }
}

export function isYouTubeUrl(url: string): boolean {
  return extractYouTubeVideoId(url) !== null
}

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
}

export async function extractYouTubeTranscript(url: string): Promise<{ title: string; transcript: string }> {
  const videoId = extractYouTubeVideoId(url)
  if (!videoId) throw new Error('That does not look like a YouTube video URL.')

  const watchResponse = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Signal Knowledge Bot/1.0)', 'Accept-Language': 'en-US,en;q=0.9' },
  })
  if (!watchResponse.ok) throw new Error('Could not load this video — it may be private, age-restricted, or unavailable.')
  const html = await watchResponse.text()

  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i)
  const title = titleMatch ? decodeEntities(titleMatch[1]).replace(/\s*-\s*YouTube$/, '').trim() : `YouTube video ${videoId}`

  const tracksMatch = html.match(/"captionTracks":(\[[^\]]*\])/)
  if (!tracksMatch) {
    throw new Error('This video has no captions/transcript available, so there is nothing to summarize. Try pasting a transcript manually as a note instead.')
  }

  let tracks: Array<{ baseUrl: string; languageCode: string; kind?: string }>
  try {
    tracks = JSON.parse(tracksMatch[1])
  } catch {
    throw new Error('Could not read this video\'s caption data.')
  }
  if (tracks.length === 0) {
    throw new Error('This video has no captions/transcript available, so there is nothing to summarize.')
  }

  // Prefer an English human/auto track, then fall back to whatever exists.
  const track = tracks.find(t => t.languageCode?.startsWith('en')) ?? tracks[0]
  const captionUrl = track.baseUrl.replace(/\\u0026/g, '&')

  const captionResponse = await fetch(captionUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Signal Knowledge Bot/1.0)' } })
  if (!captionResponse.ok) throw new Error('Could not fetch this video\'s captions.')
  const captionXml = await captionResponse.text()

  const lines = Array.from(captionXml.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g))
    .map(m => decodeEntities(m[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  const transcript = lines.join(' ')
  if (!transcript.trim()) {
    throw new Error('This video\'s captions were empty after extraction — try pasting a transcript manually instead.')
  }

  return { title, transcript }
}
