import { createServiceClient } from '@/lib/supabase'
import { generateJsonForUser } from '@/lib/llmClient'
import { embedTextForUser, embedTextsForUser, toVectorLiteral } from '@/lib/embeddings'

export interface KnowledgeNotebook {
  id: string
  user_id: string
  title: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface KnowledgeItem {
  id: string
  user_id: string
  notebook_id: string
  source_type: 'url' | 'note'
  source_url: string | null
  title: string
  raw_text: string
  cleaned_text: string
  summary: string | null
  why_it_matters: string | null
  topic_tags: string[]
  status: 'pending' | 'processing' | 'ready' | 'failed'
  processing_error: string | null
  created_at: string
  processed_at: string | null
  updated_at: string
}

export interface KnowledgeChunk {
  id: string
  item_id: string
  user_id: string
  notebook_id: string
  chunk_index: number
  content: string
  embedding?: unknown
  created_at: string
}

const KNOWLEDGE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    why_it_matters: { type: 'string' },
    topic_tags: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['infra', 'llm', 'finetune', 'rag', 'agentic', 'llmops', 'eval'],
      },
    },
  },
  required: ['title', 'summary', 'why_it_matters', 'topic_tags'],
} as const

export function normalizeText(value: string) {
  return value
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

export function extractReadableText(html: string) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = titleMatch ? decodeEntities(titleMatch[1]).replace(/\s+/g, ' ').trim() : ''
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<img[^>]*>/gi, ' ')
    .replace(/<\/(p|div|section|article|li|h1|h2|h3|h4|h5|h6|br)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
  const cleaned = normalizeText(decodeEntities(body))
  return { title, text: cleaned.slice(0, 40000) }
}

function words(value: string) {
  return Array.from(new Set(value.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []))
}

export function chunkText(text: string, chunkSize = 1400, overlap = 220) {
  const normalized = normalizeText(text)
  if (!normalized) return []
  const chunks: string[] = []
  let cursor = 0
  while (cursor < normalized.length) {
    const end = Math.min(normalized.length, cursor + chunkSize)
    const slice = normalized.slice(cursor, end).trim()
    if (slice) chunks.push(slice)
    if (end >= normalized.length) break
    cursor = Math.max(end - overlap, cursor + 1)
  }
  return chunks
}

function overlapScore(query: string, content: string) {
  const q = words(query)
  const c = new Set(words(content))
  let score = 0
  for (const token of q) if (c.has(token)) score += 1
  return score
}

async function refreshKnowledgeEmbeddings(itemId: string) {
  const db = createServiceClient()
  const { error } = await db.rpc('refresh_knowledge_chunk_embeddings', { p_item_id: itemId })
  if (error) throw error
}

async function semanticNotebookSearch(params: {
  userId: string
  notebookId: string
  question: string
  queryEmbedding?: number[] | null
  limit?: number
}) {
  const db = createServiceClient()
  const { data, error } = await db.rpc('search_knowledge_chunks', {
    p_user_id: params.userId,
    p_notebook_id: params.notebookId,
    p_query: params.question,
    p_query_embedding: params.queryEmbedding ?? null,
    p_limit: params.limit ?? 8,
  })
  if (error) throw error
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.chunk_id),
    itemId: String(row.item_id),
    content: String(row.content || ''),
    score: Number(row.semantic_score ?? 0),
    retrieval: row.retrieval_mode === 'semantic' ? 'semantic' as const : 'lexical' as const,
  }))
}

export async function summarizeKnowledge(params: {
  userId: string
  sourceType: 'url' | 'note'
  sourceUrl?: string | null
  text: string
  fallbackTitle?: string
}) {
  const prompt = `Analyze this saved ${params.sourceType === 'url' ? 'web source' : 'note'} for a GenAI practitioner.

Source URL: ${params.sourceUrl || 'N/A'}
Fallback title: ${params.fallbackTitle || 'N/A'}

TEXT:
${params.text.slice(0, 18000)}

Return:
- a precise title
- a concise summary
- why it matters to an AI practitioner
- 1 to 3 topic tags from the allowed taxonomy`

  const result = await generateJsonForUser<{
    title: string
    summary: string
    why_it_matters: string
    topic_tags: string[]
  }>({
    userId: params.userId,
    system: 'You are structuring a personal AI knowledge base for an expert practitioner.',
    prompt,
    schema: KNOWLEDGE_SCHEMA,
    maxTokens: 1200,
  })

  return {
    title: normalizeText(result.title || params.fallbackTitle || 'Untitled note'),
    summary: normalizeText(result.summary || ''),
    why_it_matters: normalizeText(result.why_it_matters || ''),
    topic_tags: Array.isArray(result.topic_tags) ? result.topic_tags.slice(0, 3) : [],
  }
}

export async function ingestKnowledgeItem(params: {
  userId: string
  notebookId: string
  sourceType: 'url' | 'note'
  sourceUrl?: string
  noteText?: string
  title?: string
}) {
  const db = createServiceClient()
  const inserted = await db.from('knowledge_items').insert({
    user_id: params.userId,
    notebook_id: params.notebookId,
    source_type: params.sourceType,
    source_url: params.sourceUrl?.trim() || null,
    title: params.title?.trim() || '',
    status: 'processing',
  }).select('*').single()

  if (inserted.error) throw inserted.error
  const item = inserted.data as KnowledgeItem

  try {
    let rawText = ''
    let fallbackTitle = params.title?.trim() || ''
    if (params.sourceType === 'url') {
      const response = await fetch(params.sourceUrl!, { headers: { 'User-Agent': 'Signal Knowledge Bot/1.0' } })
      const html = await response.text()
      const extracted = extractReadableText(html)
      rawText = extracted.text
      fallbackTitle = fallbackTitle || extracted.title || params.sourceUrl!
    } else {
      rawText = normalizeText(params.noteText || '')
      fallbackTitle = fallbackTitle || rawText.split('\n')[0]?.slice(0, 80) || 'Untitled note'
    }

    if (!rawText.trim()) throw new Error('Could not extract readable text from the submitted source.')

    const analyzed = await summarizeKnowledge({
      userId: params.userId,
      sourceType: params.sourceType,
      sourceUrl: params.sourceUrl,
      text: rawText,
      fallbackTitle,
    })

    const chunks = chunkText(rawText)
    await db.from('knowledge_chunks').delete().eq('item_id', item.id)
    if (chunks.length > 0) {
      const rows = chunks.map((content, index) => ({
        item_id: item.id,
        user_id: params.userId,
        notebook_id: params.notebookId,
        chunk_index: index,
        content,
      }))
      const chunkInsert = await db.from('knowledge_chunks').insert(rows).select('id, chunk_index')
      if (chunkInsert.error) throw chunkInsert.error
      try {
        const vectors = await embedTextsForUser(params.userId, chunks)
        const insertedRows = (chunkInsert.data ?? []).map((row: Record<string, unknown>) => ({
          id: String(row.id),
          chunkIndex: Number(row.chunk_index ?? 0),
        })).sort((a, b) => a.chunkIndex - b.chunkIndex)

        if (vectors.length === insertedRows.length && vectors.every((vector: number[]) => vector.length === 384)) {
          const embeddingWrites = await Promise.all(insertedRows.map((row, index) =>
            db.from('knowledge_chunks')
              .update({ embedding: toVectorLiteral(vectors[index]) })
              .eq('id', row.id),
          ))
          const failedWrite = embeddingWrites.find(result => result.error)
          if (failedWrite?.error) throw failedWrite.error
        }
      } catch {
        // Safe degradation: knowledge remains usable via lexical retrieval even if
        // OpenAI embeddings are unavailable for this account or environment.
      }
      try {
        await refreshKnowledgeEmbeddings(item.id)
      } catch {
        // Compatibility no-op in pgvector-only environments.
      }
    }

    const update = await db.from('knowledge_items').update({
      title: analyzed.title || fallbackTitle,
      raw_text: rawText.slice(0, 40000),
      cleaned_text: rawText.slice(0, 40000),
      summary: analyzed.summary,
      why_it_matters: analyzed.why_it_matters,
      topic_tags: analyzed.topic_tags,
      status: 'ready',
      processing_error: null,
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', item.id).select('*').single()

    if (update.error) throw update.error
    return update.data as KnowledgeItem
  } catch (error) {
    await db.from('knowledge_items').update({
      status: 'failed',
      processing_error: error instanceof Error ? error.message : String(error),
      updated_at: new Date().toISOString(),
    }).eq('id', item.id)
    throw error
  }
}

export async function getNotebookContext(params: {
  userId: string
  notebookId: string
  limit?: number
}) {
  const db = createServiceClient()
  const { data, error } = await db
    .from('knowledge_items')
    .select('id, title, source_url, summary, why_it_matters, topic_tags, cleaned_text, status')
    .eq('user_id', params.userId)
    .eq('notebook_id', params.notebookId)
    .eq('status', 'ready')
    .order('processed_at', { ascending: false })
    .limit(params.limit ?? 8)

  if (error) throw error

  return (data ?? []).map((item: Record<string, unknown>) => ({
    id: String(item.id),
    title: String(item.title || ''),
    url: String(item.source_url || ''),
    summary: String(item.summary || ''),
    why: String(item.why_it_matters || ''),
    topicTags: Array.isArray(item.topic_tags) ? item.topic_tags.map(String) : [],
    cleanedText: String(item.cleaned_text || ''),
  }))
}

export async function answerNotebookQuestion(params: {
  userId: string
  notebookId: string
  question: string
  includeFeed?: boolean
}) {
  const db = createServiceClient()
  const [{ data: chunks, error }, { data: notebook }] = await Promise.all([
    db.from('knowledge_chunks').select('id, item_id, content').eq('user_id', params.userId).eq('notebook_id', params.notebookId).limit(300),
    db.from('knowledge_notebooks').select('title').eq('id', params.notebookId).maybeSingle(),
  ])
  if (error) throw error

  let chunkRows: Array<{
    id: string
    itemId: string
    content: string
    score: number
    retrieval: 'semantic' | 'lexical'
  }> = []

  try {
    const queryEmbedding = await embedTextForUser(params.userId, params.question)
    chunkRows = await semanticNotebookSearch({
      userId: params.userId,
      notebookId: params.notebookId,
      question: params.question,
      queryEmbedding,
      limit: 8,
    })
      .then(rows => rows.filter((row: { score: number }) => row.score > 0))
  } catch {
    chunkRows = []
  }

  if (chunkRows.length === 0) {
    chunkRows = (chunks ?? []).map((chunk: Record<string, unknown>) => ({
      id: String(chunk.id),
      itemId: String(chunk.item_id),
      content: String(chunk.content || ''),
      score: overlapScore(params.question, String(chunk.content || '')),
      retrieval: 'lexical' as const,
    }))
      .filter(row => row.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
  }

  const itemIds = Array.from(new Set(chunkRows.map(row => row.itemId)))
  const { data: items } = itemIds.length
    ? await db.from('knowledge_items').select('id, title, source_url, summary, why_it_matters').in('id', itemIds)
    : { data: [] as Record<string, unknown>[] }

  const itemMap = new Map((items ?? []).map((item: Record<string, unknown>) => [String(item.id), item]))

  const notebookContext = chunkRows.map((row, index) => {
    const item = itemMap.get(row.itemId)
    return `[K${index + 1}] ${item?.title || 'Untitled'}\nURL: ${item?.source_url || 'signal://note'}\nSummary: ${item?.summary || ''}\nWhy it matters: ${item?.why_it_matters || ''}\nExcerpt: ${row.content.slice(0, 1200)}`
  }).join('\n\n')

  let feedContext = ''
  if (params.includeFeed) {
    const from = new Date()
    from.setUTCDate(from.getUTCDate() - 7)
    const { data: feed } = await db
      .from('user_feed_items')
      .select('blend_score, articles(title, url, why_it_matters, tldr_bullets)')
      .eq('user_id', params.userId)
      .gte('feed_date', from.toISOString().slice(0, 10))
      .order('blend_score', { ascending: false })
      .limit(5)
    feedContext = (feed ?? []).map((item: Record<string, unknown>, index: number) => {
      const article = Array.isArray(item.articles) ? item.articles[0] : item.articles as Record<string, unknown> | null
      return article
        ? `[F${index + 1}] ${article.title}\nURL: ${article.url}\nWhy it matters: ${article.why_it_matters || ''}\nTLDR: ${Array.isArray(article.tldr_bullets) ? article.tldr_bullets.join(' ') : ''}`
        : ''
    }).filter(Boolean).join('\n\n')
  }

  if (!notebookContext && !feedContext) {
    throw new Error('No processed notebook knowledge is available yet.')
  }

  const answer = await generateJsonForUser<{
    answer: string
    citations: { title: string; url: string }[]
  }>({
    userId: params.userId,
    system: 'You answer questions only from the supplied notebook and feed context. Be concise, specific, and cite the sources you used.',
    prompt: `Notebook: ${notebook?.title || 'Knowledge base'}\nQuestion: ${params.question}\n\nNOTEBOOK CONTEXT:\n${notebookContext || 'None'}\n\nFEED CONTEXT:\n${feedContext || 'None'}\n\nReturn a grounded answer and citations.`,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        answer: { type: 'string' },
        citations: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              title: { type: 'string' },
              url: { type: 'string' },
            },
            required: ['title', 'url'],
          },
        },
      },
      required: ['answer', 'citations'],
    },
    maxTokens: 1600,
  })

  return {
    answer: answer.answer,
    citations: answer.citations,
    usedFeed: Boolean(feedContext),
    notebookTitle: notebook?.title ?? 'Knowledge base',
    retrievalMode: chunkRows[0]?.retrieval ?? 'lexical',
  }
}

export async function answerRecallQuestion(params: {
  userId: string
  question: string
}) {
  const db = createServiceClient()
  const from = new Date()
  from.setUTCDate(from.getUTCDate() - 30)

  const [{ data: knowledgeItems, error: knowledgeError }, { data: feedItems, error: feedError }, { data: priorChats, error: priorChatError }] = await Promise.all([
    db.from('knowledge_items')
      .select('id, notebook_id, title, source_url, summary, why_it_matters, topic_tags, cleaned_text, processed_at')
      .eq('user_id', params.userId)
      .eq('status', 'ready')
      .order('processed_at', { ascending: false })
      .limit(120),
    db.from('user_feed_items')
      .select('feed_date, blend_score, articles(id, title, url, why_it_matters, tldr_bullets, topic_tags, published_at)')
      .eq('user_id', params.userId)
      .gte('feed_date', from.toISOString().slice(0, 10))
      .order('blend_score', { ascending: false })
      .limit(120),
    db.from('user_chat_events')
      .select('question, answer_summary, created_at')
      .eq('user_id', params.userId)
      .in('scope', ['memory', 'notebook'])
      .order('created_at', { ascending: false })
      .limit(12),
  ])

  if (knowledgeError) throw knowledgeError
  if (feedError) throw feedError
  if (priorChatError) throw priorChatError

  const rankedKnowledge = (knowledgeItems ?? [])
    .map((item: Record<string, unknown>) => {
      const title = String(item.title || '')
      const summary = String(item.summary || '')
      const why = String(item.why_it_matters || '')
      const cleaned = String(item.cleaned_text || '')
      const score = overlapScore(params.question, `${title}\n${summary}\n${why}\n${cleaned.slice(0, 4000)}`)
      return {
        type: 'knowledge' as const,
        title,
        url: String(item.source_url || `signal://knowledge/${String(item.id)}`),
        why,
        summary,
        context: cleaned.slice(0, 1200),
        score,
      }
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  const rankedFeed = (feedItems ?? [])
    .map((item: Record<string, unknown>) => {
      const article = Array.isArray(item.articles) ? item.articles[0] : item.articles as Record<string, unknown> | null
      if (!article) return null
      const title = String(article.title || '')
      const why = String(article.why_it_matters || '')
      const bullets = Array.isArray(article.tldr_bullets) ? article.tldr_bullets.map(String).join(' ') : ''
      const score = overlapScore(params.question, `${title}\n${why}\n${bullets}`)
      return {
        type: 'feed' as const,
        title,
        url: String(article.url || ''),
        why,
        summary: bullets,
        context: bullets.slice(0, 1200),
        score,
      }
    })
    .filter((item): item is {
      type: 'feed'
      title: string
      url: string
      why: string
      summary: string
      context: string
      score: number
    } => item !== null)
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  if (rankedKnowledge.length === 0 && rankedFeed.length === 0) {
    throw new Error('I could not find a matching memory in your feed or knowledge base yet.')
  }

  const priorChatMatches = (priorChats ?? [])
    .map((chat: Record<string, unknown>) => {
      const priorQuestion = String(chat.question || '')
      const answerSummary = String(chat.answer_summary || '')
      const score = overlapScore(params.question, `${priorQuestion}\n${answerSummary}`)
      return { priorQuestion, answerSummary, score, createdAt: String(chat.created_at || '') }
    })
    .filter(chat => chat.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)

  const memoryContext = [
    ...priorChatMatches.map((item, index) => `[P${index + 1}] Earlier question: ${item.priorQuestion}\nEarlier answer: ${item.answerSummary}\nAsked: ${item.createdAt}`),
    ...rankedKnowledge.map((item, index) => `[K${index + 1}] ${item.title}\nURL: ${item.url}\nSummary: ${item.summary}\nWhy it matters: ${item.why}\nContext: ${item.context}`),
    ...rankedFeed.map((item, index) => `[F${index + 1}] ${item.title}\nURL: ${item.url}\nSummary: ${item.summary}\nWhy it matters: ${item.why}\nContext: ${item.context}`),
  ].join('\n\n')

  const answer = await generateJsonForUser<{
    answer: string
    citations: { title: string; url: string }[]
  }>({
    userId: params.userId,
    system: 'You are a recall assistant. Answer only from the supplied user feed and notebook memory context. Be concise, help the user remember the concept, and cite sources used.',
    prompt: `Question: ${params.question}\n\nMEMORY CONTEXT:\n${memoryContext}\n\nReturn a grounded answer and citations.`,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        answer: { type: 'string' },
        citations: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              title: { type: 'string' },
              url: { type: 'string' },
            },
            required: ['title', 'url'],
          },
        },
      },
      required: ['answer', 'citations'],
    },
    maxTokens: 1400,
  })

  return {
    answer: answer.answer,
    citations: answer.citations,
    feedMatches: rankedFeed.length,
    knowledgeMatches: rankedKnowledge.length,
    priorChatMatches: priorChatMatches.length,
  }
}
