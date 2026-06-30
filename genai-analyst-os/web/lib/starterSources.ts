export interface StarterSource {
  url: string
  source_tier: number
}

export const STARTER_SOURCES: StarterSource[] = [
  { url: 'https://www.anthropic.com/news', source_tier: 1 },
  { url: 'https://openai.com/news', source_tier: 1 },
  { url: 'https://ai.meta.com/blog/', source_tier: 1 },
  { url: 'https://huggingface.co/blog', source_tier: 1 },
  { url: 'https://www.latent.space/', source_tier: 2 },
  { url: 'https://www.interconnects.ai/', source_tier: 2 },
  { url: 'https://www.understandingai.org/', source_tier: 2 },
  { url: 'https://www.deeplearning.ai/the-batch/', source_tier: 2 },
]
