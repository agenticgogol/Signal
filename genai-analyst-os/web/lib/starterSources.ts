export interface StarterSource {
  url: string
  rss_url?: string
  rss_detection_method: 'known_pattern' | 'direct_feed_url' | 'not_found'
  source_tier: number
}

// Curated AI/LLM domain sources with pre-resolved RSS feeds, mirroring the
// known-feeds map in scripts/add_source.py so every signed-in user starts
// with a working, pre-ranked feed instead of an empty one. Merged with
// every entry in scripts/my_sources.txt (Utsab's personal curated list,
// verified 2026-06-29) — everything there that wasn't already duplicated
// here, minus the ones that file itself marks as skipped (no RSS / static
// pages / paid API only).
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
  // — from scripts/my_sources.txt —
  { url: 'https://boringbot.substack.com/feed', rss_url: 'https://boringbot.substack.com/feed', rss_detection_method: 'direct_feed_url', source_tier: 2 },
  { url: 'https://www.newsletter.swirlai.com/feed', rss_url: 'https://www.newsletter.swirlai.com/feed', rss_detection_method: 'direct_feed_url', source_tier: 2 },
  { url: 'https://tinahuang.substack.com/feed', rss_url: 'https://tinahuang.substack.com/feed', rss_detection_method: 'direct_feed_url', source_tier: 2 },
  { url: 'https://hamelhusain.substack.com/feed', rss_url: 'https://hamelhusain.substack.com/feed', rss_detection_method: 'direct_feed_url', source_tier: 2 },
  { url: 'https://theaiengineer.substack.com/feed', rss_url: 'https://theaiengineer.substack.com/feed', rss_detection_method: 'direct_feed_url', source_tier: 2 },
  { url: 'https://hugobowne.substack.com/feed', rss_url: 'https://hugobowne.substack.com/feed', rss_detection_method: 'direct_feed_url', source_tier: 2 },
  { url: 'https://jxnl.co', rss_detection_method: 'not_found', source_tier: 2 },
  { url: 'https://engineering.fb.com', rss_url: 'https://engineering.fb.com/feed/', rss_detection_method: 'known_pattern', source_tier: 2 },
  { url: 'https://netflixtechblog.com', rss_url: 'https://netflixtechblog.com/feed', rss_detection_method: 'known_pattern', source_tier: 2 },
  { url: 'https://www.zenml.io/blog', rss_url: 'https://www.zenml.io/blog/rss.xml', rss_detection_method: 'known_pattern', source_tier: 2 },
  { url: 'https://www.therundown.ai/', rss_detection_method: 'not_found', source_tier: 2 },

  // ── Tier 3 — aggregators and community ──────────────────────────────────
  { url: 'https://www.deeplearning.ai/the-batch/', rss_detection_method: 'not_found', source_tier: 3 },
  { url: 'https://towardsdatascience.com', rss_url: 'https://towardsdatascience.com/feed', rss_detection_method: 'known_pattern', source_tier: 3 },
  { url: 'https://pub.towardsai.net', rss_url: 'https://pub.towardsai.net/feed', rss_detection_method: 'known_pattern', source_tier: 3 },
]
