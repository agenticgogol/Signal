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

// ── Story clustering — "popularity" = independent-source coverage ─────────
// This feed has no view/click data to rank by, so the honest signal
// available is: how many of the 6 tracked sources are covering the same
// underlying story. Two items are the same story if their titles overlap
// heavily AND they were published within a day of each other — the time
// bound exists so an old story with similar wording doesn't get merged with
// an unrelated new one.

const STORY_STOPWORDS = new Set([
  'the','a','an','and','or','but','of','to','in','on','for','with','is','are',
  'was','were','how','why','what','new','after','over','into','its','it','as',
  'from','by','at','this','that','will','can','says','say','said',
])

// Words that are too generic in an AI-news context to count as a shared
// "entity" between two headlines (everything is about AI here).
const ENTITY_NOISE_WORDS = new Set([
  'ai','llm','llms','gpt','api','ceo','cto','new','the','this','that',
])

function titleTokens(title: string): Set<string> {
  return new Set((title.toLowerCase().match(/[a-z0-9][a-z0-9'-]{2,}/g) ?? []).filter(w => !STORY_STOPWORDS.has(w)))
}

function titleOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let shared = 0
  for (const w of a) if (b.has(w)) shared++
  return shared / Math.min(a.size, b.size)
}

// Different outlets paraphrase headlines heavily — "Meta follows SpaceX's
// playbook and builds a cloud business to sell spare AI compute" vs "Meta,
// like SpaceX, looks to turn excess AI compute into cash" describe the same
// story but share only ~25% of their words. Named entities (proper nouns:
// "Meta", "SpaceX") survive paraphrasing far better than general wording, so
// entity overlap is the primary signal; plain word overlap is a fallback
// for headlines with few/no capitalized names.
function titleEntities(title: string): Set<string> {
  const matches = title.match(/\b[A-Z][a-zA-Z0-9]*(?:'s)?\b/g) ?? []
  return new Set(
    matches
      .map(m => m.replace(/'s$/, '').toLowerCase())
      .filter(w => w.length >= 3 && !ENTITY_NOISE_WORDS.has(w))
  )
}

function isSameStory(a: { tokens: Set<string>; entities: Set<string> }, b: { tokens: Set<string>; entities: Set<string> }): boolean {
  if (a.entities.size >= 2 && b.entities.size >= 2) {
    let shared = 0
    for (const e of a.entities) if (b.entities.has(e)) shared++
    if (shared >= 2 && shared / Math.min(a.entities.size, b.entities.size) >= 0.66) return true
  }
  return titleOverlap(a.tokens, b.tokens) >= SAME_STORY_OVERLAP_THRESHOLD
}

const SAME_STORY_WINDOW_MS = 36 * 60 * 60 * 1000
const SAME_STORY_OVERLAP_THRESHOLD = 0.4

export interface AiNewsStory {
  title: string
  url: string
  description: string
  pubDate: string
  pubMs: number
  category: string
  sources: string[]
  alternates: { source: string; url: string; title: string }[]
}

export async function fetchAiNewsStories(limit = 40): Promise<AiNewsStory[]> {
  const items = await fetchAiNews(120)
  // Compare a candidate against each existing member of a cluster
  // individually (best match wins) rather than an accumulating merged token
  // set — a merged set drifts as a cluster grows, eventually looking similar
  // enough to match unrelated stories that happen to share a few words.
  const clusters: { items: AiNewsItem[]; signatures: { tokens: Set<string>; entities: Set<string> }[] }[] = []

  for (const item of items) {
    const signature = { tokens: titleTokens(item.title), entities: titleEntities(item.title) }
    const match = clusters.find(cluster =>
      cluster.items.some(existing => Math.abs(existing.pubMs - item.pubMs) <= SAME_STORY_WINDOW_MS) &&
      cluster.signatures.some(existing => isSameStory(signature, existing))
    )
    if (match) {
      match.items.push(item)
      match.signatures.push(signature)
    } else {
      clusters.push({ items: [item], signatures: [signature] })
    }
  }

  const stories: AiNewsStory[] = clusters.map(cluster => {
    // Prefer the earliest-published item as the canonical one — it broke
    // the story first, later coverage is corroboration.
    const sorted = [...cluster.items].sort((a, b) => a.pubMs - b.pubMs)
    const primary = sorted[0]
    const uniqueSources = Array.from(new Set(cluster.items.map(i => i.source)))
    return {
      title: primary.title,
      url: primary.url,
      description: cluster.items.reduce((best, i) => i.description.length > best.length ? i.description : best, primary.description),
      pubDate: primary.pubDate,
      pubMs: Math.max(...cluster.items.map(i => i.pubMs)),
      category: primary.category,
      sources: uniqueSources,
      alternates: cluster.items.filter(i => i.url !== primary.url).map(i => ({ source: i.source, url: i.url, title: i.title })),
    }
  })

  stories.sort((a, b) => b.sources.length - a.sources.length || b.pubMs - a.pubMs)
  return stories.slice(0, limit)
}
