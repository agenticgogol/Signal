// Pure data — no SDK imports, safe to use in browser and server
export const PLATFORM_SPECS: Record<string, {
  name: string; wordLimit: string; charLimit?: number
  structure: string; tone: string; mustDos: string[]; avoid: string[]
}> = {
  linkedin: {
    name: 'LinkedIn',
    wordLimit: '200–280 words',
    charLimit: 1300,
    structure: 'Hook line → 3-5 punchy paragraphs (blank line between each) → soft CTA + 2-3 hashtags',
    tone: 'Professional but human. First person. Direct. Opinionated.',
    mustDos: [
      'Start with a specific observation or surprising fact — NOT a question or "I am excited"',
      'One idea per short paragraph, blank line between paragraphs',
      'End with a question or "Follow for more on [topic]"',
      'Add 2-3 relevant hashtags at the very end',
    ],
    avoid: ['em-dashes', '"it\'s worth noting"', '"in conclusion"', '"I\'m excited"', 'bullet point walls', 'numbered lists', 'headers'],
  },
  substack: {
    name: 'Substack Newsletter',
    wordLimit: '700–1000 words',
    structure: 'Personal anecdote intro (1 para) → Problem framing → 3 insight sections with H2 → Takeaway closing',
    tone: 'Warm, conversational, intellectually honest. Like a smart friend explaining something.',
    mustDos: [
      'Open with a specific story or moment that grounds the reader',
      'Use "you" — write to one reader',
      'Each H2 section needs 1 concrete example or data point',
      'Closing should feel earned, not generic',
    ],
    avoid: ['corporate jargon', 'passive voice', 'excessive hedging'],
  },
  thread: {
    name: 'Twitter/X Thread',
    wordLimit: '8–12 tweets, each ≤280 chars',
    structure: 'Tweet 1: Big hook claim → Tweets 2-10: One insight per tweet → Last: summary + follow CTA',
    tone: 'Punchy, confident, slightly provocative.',
    mustDos: [
      'Tweet 1 must be standalone and compelling',
      'End each tweet with a mini-cliffhanger',
      'Number each tweet: 1/ 2/ etc.',
    ],
    avoid: ['threads that could be a single tweet', 'filler tweets', '"A thread:" openers'],
  },
  blog: {
    name: 'Blog Post',
    wordLimit: '1500–2000 words',
    structure: 'Title + TL;DR (3 bullets) → Introduction → 4-6 H2 sections → Conclusion with actionable takeaways',
    tone: 'Authoritative practitioner. Evidence-backed. Practical over theoretical.',
    mustDos: [
      'Include at least 2 concrete examples with specifics',
      'TL;DR at the top so skimmers get value',
      'Each H2 answers a question a reader would have',
    ],
    avoid: ['"In today\'s rapidly evolving AI landscape"', 'fluff intros', 'empty conclusions'],
  },
  youtube_long: {
    name: 'YouTube Video Script',
    wordLimit: '1200–1800 words (8–12 min)',
    structure: 'Hook (0-30s) → Channel intro bumper → 3-4 chapters → CTA',
    tone: 'Energetic but substantive. Conversational speech rhythm.',
    mustDos: [
      'Mark [B-ROLL: description] for visual cutaways',
      'Add [CHAPTER: title] markers',
      'Hook must create curiosity gap in first 30 seconds',
    ],
    avoid: ['reading lists verbatim', 'academic language'],
  },
  youtube_short: {
    name: 'YouTube Short / Reel Script',
    wordLimit: '120–180 words (60–90 seconds)',
    structure: '0-3s: Hook claim → 3-45s: 3 fast insights → 45-60s: Payoff + subscribe nudge',
    tone: 'Fast, kinetic, no fluff.',
    mustDos: [
      'First line must be spoken',
      'Add [TEXT OVERLAY: ] cues for key words',
      'End on a specific actionable',
    ],
    avoid: ['slow intros', 'long explanations'],
  },
}
