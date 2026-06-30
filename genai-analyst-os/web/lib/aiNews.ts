const SOURCES = [
  { name: 'The Decoder', url: 'https://the-decoder.com/feed/', category: 'Research & Industry' },
  { name: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', category: 'Industry News' },
  { name: 'VentureBeat AI', url: 'https://venturebeat.com/category/ai/feed/', category: 'Industry News' },
  { name: 'MIT Tech Review', url: 'https://www.technologyreview.com/feed/', category: 'Research' },
  { name: 'Import AI (J. Clark)', url: 'https://jack-clark.net/feed/', category: 'Research Digest' },
  { name: 'Last Week in AI', url: 'https://lastweekin.ai/feed', category: 'Weekly Roundup' },
]

export interface AiNewsItem {
  title: string
  url: string
  description: string
  pubDate: string
  pubMs: number
  source: string
  category: string
}

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
}

function extractCDATA(xml: string) {
  return xml.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim()
}

function stripTags(value: string) {
  return decodeEntities(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, 300)
}

function getTag(content: string, tag: string) {
  const match = content.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return match ? decodeEntities(extractCDATA(match[1]).trim()) : ''
}

function getAttr(content: string, tag: string, attr: string) {
  const match = content.match(new RegExp(`<${tag}[^>]*\\s${attr}="([^"]+)"`, 'i'))
  return match ? decodeEntities(match[1]) : ''
}

async function fetchSource(source: (typeof SOURCES)[number]): Promise<AiNewsItem[]> {
  try {
    const response = await fetch(source.url, {
      headers: { 'User-Agent': 'Signal-GenAI-Reader/1.0' },
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    })
    if (!response.ok) return []
    const xml = await response.text()
    const items: AiNewsItem[] = []
    const pattern = /<(?:item|entry)[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi
    let match: RegExpExecArray | null
    while ((match = pattern.exec(xml)) !== null && items.length < 6) {
      const content = match[1]
      const title = stripTags(getTag(content, 'title'))
      const url = getTag(content, 'link') || getAttr(content, 'link', 'href')
      const description = stripTags(getTag(content, 'description') || getTag(content, 'summary') || getTag(content, 'content'))
      const pubDate = getTag(content, 'pubDate') || getTag(content, 'published') || getTag(content, 'updated')
      const pubMs = pubDate ? new Date(pubDate).getTime() || 0 : 0
      if (title && url) items.push({ title, url: url.trim(), description, pubDate, pubMs, source: source.name, category: source.category })
    }
    return items
  } catch {
    return []
  }
}

export async function fetchAiNews(limit = 40): Promise<AiNewsItem[]> {
  const results = await Promise.allSettled(SOURCES.map(fetchSource))
  const items = results.flatMap(result => result.status === 'fulfilled' ? result.value : [])
  items.sort((a, b) => b.pubMs - a.pubMs)
  const seen = new Set<string>()
  return items.filter(item => {
    if (seen.has(item.url)) return false
    seen.add(item.url)
    return true
  }).slice(0, limit)
}
