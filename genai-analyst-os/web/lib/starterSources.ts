export interface StarterSource {
  url: string
  rss_url?: string
  rss_detection_method: 'known_pattern' | 'direct_feed_url' | 'not_found'
  source_tier: number
}

// Curated AI/LLM domain sources with pre-resolved RSS feeds, mirroring the
// known-feeds map in scripts/add_source.py so every signed-in user starts
// with a working, pre-ranked feed instead of an empty one.
export const STARTER_SOURCES: StarterSource[] = [
  // ── Tier 1 — labs and frontier research ─────────────────────────────────
  { url: 'https://www.anthropic.com/news', rss_detection_method: 'not_found', source_tier: 1 },
  { url: 'https://openai.com/news', rss_detection_method: 'not_found', source_tier: 1 },
  { url: 'https://deepmind.google', rss_url: 'https://deepmind.google/blog/rss.xml', rss_detection_method: 'known_pattern', source_tier: 1 },
  { url: 'https://huggingface.co/blog', rss_url: 'https://huggingface.co/blog/feed.xml', rss_detection_method: 'known_pattern', source_tier: 1 },
  { url: 'https://ai.meta.com/blog/', rss_detection_method: 'not_found', source_tier: 1 },
  { url: 'https://blog.google/technology/ai', rss_url: 'https://blog.google/technology/ai/rss/', rss_detection_method: 'known_pattern', source_tier: 1 },

  // ── Tier 2 — practitioner blogs and newsletters ─────────────────────────
  { url: 'https://www.latent.space/', rss_url: 'https://www.latent.space/feed', rss_detection_method: 'known_pattern', source_tier: 2 },
  { url: 'https://www.interconnects.ai/', rss_url: 'https://www.interconnects.ai/feed', rss_detection_method: 'known_pattern', source_tier: 2 },
  { url: 'https://www.understandingai.org/', rss_detection_method: 'not_found', source_tier: 2 },
  { url: 'https://magazine.sebastianraschka.com', rss_url: 'https://magazine.sebastianraschka.com/feed', rss_detection_method: 'known_pattern', source_tier: 2 },
  { url: 'https://lilianweng.github.io', rss_url: 'https://lilianweng.github.io/index.xml', rss_detection_method: 'known_pattern', source_tier: 2 },
  { url: 'https://huyenchip.com', rss_url: 'https://huyenchip.com/feed.xml', rss_detection_method: 'known_pattern', source_tier: 2 },
  { url: 'https://simonwillison.net', rss_url: 'https://simonwillison.net/atom/everything/', rss_detection_method: 'known_pattern', source_tier: 2 },
  { url: 'https://eugeneyan.com', rss_url: 'https://eugeneyan.com/feed.xml', rss_detection_method: 'known_pattern', source_tier: 2 },
  { url: 'https://karpathy.github.io', rss_url: 'https://karpathy.github.io/feed.xml', rss_detection_method: 'known_pattern', source_tier: 2 },
  { url: 'https://thegradient.pub', rss_url: 'https://thegradient.pub/rss/', rss_detection_method: 'known_pattern', source_tier: 2 },

  // ── Tier 3 — aggregators and community ──────────────────────────────────
  { url: 'https://www.deeplearning.ai/the-batch/', rss_detection_method: 'not_found', source_tier: 3 },
  { url: 'https://towardsdatascience.com', rss_url: 'https://towardsdatascience.com/feed', rss_detection_method: 'known_pattern', source_tier: 3 },
]
