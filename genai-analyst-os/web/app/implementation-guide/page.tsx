import { Arrow, Callout, FeatureCard, FlowNode, GuideHero, GuideSection, PipelineDiagram, QuickNav, type PipelineZone } from '@/components/GuideUI'

const stack = [
  ['▲', 'Next.js 16', 'App Router, server routes, React 19, Tailwind CSS 4'],
  ['⚡', 'GitHub Actions', 'Manual dispatch plus daily schedule; isolated Python runner'],
  ['🧠', 'LangGraph', 'Crawler → summarise → rank → ideas state machine'],
  ['✦', 'User-selected LLMs', 'Anthropic, OpenAI, Groq, or OpenRouter per account'],
  ['◈', 'Supabase', 'Postgres, Auth-ready profiles, RLS, service APIs'],
  ['⌁', 'pgvector', '384-dimensional embeddings and relevance scoring'],
  ['◉', 'RSS / Atom', 'User-controlled sources plus worldwide news radar'],
  ['▦', 'Vercel', 'Next.js hosting, API execution, environment management'],
]

const apiRows = [
  ['/api/pipeline/trigger', 'POST', 'Dispatches the GitHub workflow with bounded crawl settings'],
  ['/api/pipeline/status', 'GET', 'Tracks the current user run through crawl_runs'],
  ['/api/data/feed', 'GET', 'Returns deduplicated ranked feed items — public read, cold-start friendly'],
  ['/api/today/queue', 'GET / POST', 'Reading queue read (public) and mark-read/refresh (session or admin token)'],
  ['/api/today/generate', 'POST', 'Starts a background content-generation job; returns a jobId immediately'],
  ['/api/today/generate/status', 'GET', 'Polls a generation job by id — decouples generation from the request lifecycle'],
  ['/api/drafts-inbox/items', 'GET', 'Pending/reviewed drafts for Today\'s Publishing panel'],
  ['/api/drafts-inbox/review', 'POST', 'Approve, dismiss, or undo a draft'],
  ['/api/today/draft/publish', 'POST', 'Publishes one approved draft to a connected platform or email'],
  ['/api/data/platform-connections', 'GET / POST / DELETE', 'List, save, or remove a publisher platform connection'],
  ['/api/data/daily-digest', 'GET', 'Reads the latest daily story plus recent and archived daily digests'],
  ['/api/data/digest-archives', 'GET', 'Returns older daily and weekly digest archive lists'],
  ['/api/data/digest-settings', 'GET / POST', 'Stores daily digest email preferences and delivery address'],
  ['/api/data/ai-news', 'GET', 'Parallel live RSS aggregation; persists clustered stories for reuse'],
  ['/api/data/narrative', 'GET / POST', 'Reads weekly cache or explicitly regenerates structured output'],
  ['/api/ideas/generate', 'POST', 'Uses recent feed context and preferences to propose five topics'],
  ['/api/outline/generate', 'POST', 'Builds a hook, audience, angle, format, and editable section plan'],
  ['/api/outline/save', 'POST', 'Freezes an approved outline for deterministic reuse in Create'],
  ['/api/data/voice', 'GET', 'Reads the current structured fingerprint from user_profiles'],
  ['/api/voice/analyze', 'POST', 'Extracts voice patterns, computes rhythm metrics, and replaces the fingerprint'],
  ['/api/articles/react', 'GET / POST / DELETE', 'Stores like/dislike feedback'],
  ['/api/knowledge/recall', 'POST', 'Ask Signal / Memory Assistant — shared retrieval + grounded answer'],
  ['/api/generate', 'POST + SSE', 'Streams the eight-agent drafting and quality workflow'],
]

const systemZones: PipelineZone[] = [
  {
    label: 'Ingestion', tone: 'green',
    steps: [
      { title: 'User sources', tone: 'green', detail: ['RSS/Atom, tiered 1–3 by trust', 'Resolved and stored per account'] },
      { title: 'Crawl', tone: 'green', detail: ['Scheduled (per-user hour, Pro) or manual "Get Latest Feed"', 'Bounded lookback (1–14d) and per-source cap (1–10)'] },
    ],
  },
  {
    label: 'Enrichment & Ranking', tone: 'blue',
    steps: [
      { title: 'Summarise', tone: 'blue', detail: ['TL;DR, topic tags, depth, why-it-matters, takeaways'] },
      { title: 'Embed', tone: 'blue', detail: ['384-d pgvector embedding per article'] },
      { title: 'Rank', tone: 'blue', detail: ['Blend: recency + topic_weights cosine + source tier', 'Instant re-sort on preference change, no pipeline re-run needed'] },
    ],
  },
  {
    label: 'Today: reading queue + publishing (deterministic ranking)', tone: 'amber',
    steps: [
      { title: 'Feed + Library + News, merged', tone: 'amber', detail: ['One time-boxed daily queue — see the dedicated section below', 'No LLM call: pure scoring, normalize, merge, tiebreak, fill'] },
    ],
  },
  {
    label: 'RAG & Memory (on demand)', tone: 'violet', dashed: true,
    steps: [
      { title: 'Ask Signal / Memory Assistant', tone: 'violet', detail: ['One shared recall engine, two entry points', 'Retrieves feed + knowledge + prior chat, answers with citations'] },
    ],
    note: 'Reads episodic memory (opens, pins, likes, prior chats) to ground answers; writes back to it after each answer.',
  },
  {
    label: 'Content Generation (human-directed or one-click)', tone: 'green',
    steps: [
      { title: '8-agent evidence-grounded loop', tone: 'green', detail: ['Orchestrator → Writer → Verifier → Critic → Humanizer → Evaluator (loop)', 'Audience Sim → Final Polish, then optional direct publish'] },
    ],
  },
]

const publishingZones: PipelineZone[] = [
  {
    label: 'Trust boundary', tone: 'green',
    steps: [
      { title: 'Connect a platform', tone: 'green', detail: ['Same bring-your-own-credential model as the LLM key', 'Token encrypted at rest, never re-displayed after saving'] },
    ],
  },
  {
    label: 'Human approval gate', tone: 'amber',
    steps: [
      { title: 'Draft must be Approved first', tone: 'amber', detail: ['Nothing in draft_inbox_items reaches an external API while status = pending', 'Approve happens in Today\'s Publishing panel, one draft at a time'] },
    ],
  },
  {
    label: 'Per-platform connector', tone: 'blue',
    steps: [
      { title: 'Medium', tone: 'blue', detail: ['Self-service integration token — no developer app or review needed', 'Publishes as a Medium draft for the user to review there'] },
      { title: 'LinkedIn / X', tone: 'blue', detail: ['Native posting API — requires a token from a registered developer app', 'Tokens are short-lived; this does not handle refresh'] },
      { title: 'Email', tone: 'blue', detail: ['Resend API — sent to the account\'s configured digest email'] },
    ],
  },
  {
    label: 'Result recorded', tone: 'violet',
    steps: [
      { title: 'published_platforms updated', tone: 'violet', detail: ['Appends the platform on success — a draft can be published to more than one destination'] },
    ],
  },
]

const contentGenZones: PipelineZone[] = [
  {
    label: 'Input assembly', tone: 'green',
    steps: [
      { title: 'Evidence sources', tone: 'green', detail: ['1–3 feed articles or notebook items, WITH real content', 'why_it_matters + tldr_bullets, or summary — not just title/URL'] },
      { title: 'Human brief', tone: 'green', detail: ['Topic · angle · optional POV · audience · platform + voice fingerprint'] },
    ],
  },
  {
    label: 'Planning', tone: 'blue',
    steps: [
      { title: 'Orchestrator', tone: 'blue', detail: ['Schema-validated JSON plan (generateJsonForUser, not regex-scraped text)', 'Every key_claim must trace to a specific source\'s evidence or be left unsourced'] },
    ],
  },
  {
    label: 'Draft & verify loop — up to 3 iterations', tone: 'amber', dashed: true,
    steps: [
      { title: 'Writer', tone: 'amber', detail: ['Platform-native draft, cites only what the evidence actually supports'] },
      { title: 'Claim Verifier', tone: 'amber', detail: ['Per-claim status vs. real evidence: supported / overstated / unsupported / hallucinated', 'Structured JSON verdict — checked by code, not re-read as prose'] },
      { title: 'Critic', tone: 'amber', detail: ['Citation gaps + accuracy issues + AI writing tells'] },
      { title: 'Humanizer', tone: 'amber', detail: ['Fixes critique + citation issues, applies voice fingerprint'] },
      { title: 'Evaluator', tone: 'amber', detail: ['5 scores (hook, specificity, citations, voice, platform fit)', 'Citations score forced below 7 if Verifier found hallucination/unsupported claims'] },
    ],
    note: 'Loop breaks only when Evaluator passes AND the Verifier reports zero hallucinated/unsupported citations — whichever comes later, capped at 3 loops.',
  },
  {
    label: 'Reader pressure test', tone: 'violet',
    steps: [
      { title: 'Audience Simulation', tone: 'violet', detail: ['3 personas: skeptical engineer, PM, executive skimmer'] },
      { title: 'Final Polish', tone: 'violet', detail: ['Addresses objections in place — no new sections, no structure changes'] },
    ],
  },
]

const ragZones: PipelineZone[] = [
  {
    label: 'Query intake', tone: 'green',
    steps: [
      { title: 'Ask Signal (Today or Feed tab) or Memory Assistant page', tone: 'green', detail: ['Same component, three entry points — one shared implementation'] },
    ],
  },
  {
    label: 'Retrieval', tone: 'blue',
    steps: [
      { title: 'Feed memory search', tone: 'blue', detail: ['Recent ranked articles: title, why_it_matters, takeaways'] },
      { title: 'Knowledge base search', tone: 'blue', detail: ['Library items scored by word-overlap relevance to the question'] },
      { title: 'Prior chat history', tone: 'blue', detail: ['Last N recall Q&As from user_chat_events, matched by overlap too'] },
    ],
  },
  {
    label: 'Grounding & generation', tone: 'violet',
    steps: [
      { title: 'Assemble numbered context', tone: 'violet', detail: ['[F1], [K1], [P1] style citations — feed, knowledge, prior chat'] },
      { title: 'Generate answer', tone: 'violet', detail: ['Schema-validated JSON: answer + citations, on the account\'s configured model', 'Instructed to answer only from supplied context — no open-ended recall'] },
    ],
  },
]

export default function ImplementationGuidePage() {
  return (
    <div className="mx-auto max-w-6xl p-6 md:p-8 pb-24">
      <GuideHero eyebrow="Engineering Field Guide" title="How Signal.ai turns a noisy web into an auditable intelligence workflow"
        description="This guide maps the runtime architecture, agent graph, data model, model tiers, API boundaries, reliability decisions, and deployment controls. It is written for maintainers who need to understand not only what runs, but why the system is shaped this way."
        chips={['Next.js + Python', 'Supabase + pgvector', 'Per-user LLM routing', 'GitHub Actions', 'Human-in-the-loop']} />

      <div className="mt-8">
        <QuickNav groups={[
          {
            label: 'Foundations', items: [
              { id: 'system-overview', label: 'System overview', icon: '🗺️' },
              { id: 'scheduled-pipeline', label: 'Scheduled ingestion', icon: '⚙️' },
            ],
          },
          {
            label: 'Today: reading & publishing', items: [
              { id: 'reading-ranking', label: 'Reading candidate ranking', icon: '📋' },
              { id: 'publishing', label: 'Publishing', icon: '📤' },
              { id: 'idea-generation', label: 'Idea gen & drafting', icon: '✍️' },
              { id: 'streaming', label: 'Generation streaming', icon: '📡' },
            ],
          },
          {
            label: 'Recall & personalization', items: [
              { id: 'ask-signal', label: 'Ask Signal', icon: '💬' },
              { id: 'memory', label: 'Memory', icon: '🧠' },
              { id: 'digest', label: 'Daily & weekly digests', icon: '🌅' },
            ],
          },
          {
            label: 'Operations', items: [
              { id: 'commercial-boundaries', label: 'Commercial model', icon: '💳' },
              { id: 'stack', label: 'Tech stack', icon: '▦' },
              { id: 'data', label: 'Data model', icon: '◈' },
              { id: 'api', label: 'API boundary map', icon: '🔌' },
              { id: 'reliability', label: 'Reliability', icon: '🧯' },
              { id: 'deploy', label: 'Deployment checklist', icon: '🚀' },
            ],
          },
        ]} />
      </div>

      {/* ══════════════════════ 1. SYSTEM OVERVIEW ══════════════════════ */}
      <GuideSection id="system-overview" eyebrow="Bird's-eye view" title="The entire system as one pipeline, three paths" description="Five layers, one direction: sources become ranked intelligence, intelligence becomes surfaces, and two on-demand layers — recall and content generation — sit on top rather than being separate products. Underneath that, three distinct runtime paths do the actual work.">
        <PipelineDiagram
          entry={{ icon: '📰', label: 'Your sources (RSS/Atom)' }}
          zones={systemZones}
          exit={{ icon: '✍️', label: 'Human reviews, edits, and publishes' }}
          sideRail={{ label: 'Supabase Postgres + pgvector', sublabel: 'every layer reads and writes here' }}
        />
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <Callout title="Two on-demand layers"><p>RAG &amp; Memory and Content Generation don&apos;t run on a schedule — they activate when a user asks a question or clicks Generate/Create, but both depend on everything ranked and enriched below them.</p></Callout>
          <Callout title="One store, no hidden pipeline" tone="green"><p>There is no separate vector database or cache tier — pgvector embeddings, ranked feed rows, knowledge chunks, and episodic memory events all live in the same Postgres instance.</p></Callout>
          <Callout title="Detailed sections below" tone="amber"><p>Every layer above expands into its own dedicated section further down this page — use Quick navigation to jump straight there.</p></Callout>
        </div>

        <div className="mt-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <p className="mb-4 text-xs font-bold uppercase tracking-widest text-zinc-400">Path A — durable personalized intelligence (scheduled)</p>
          <div className="flex flex-col md:flex-row gap-3 md:items-stretch">
            <FlowNode icon="🖱️" title="UI / Schedule" subtitle="workflow_dispatch or cron" /> <Arrow />
            <FlowNode icon="⚙️" title="GitHub Runner" subtitle="Python 3.11 + LangGraph" tone="blue" /> <Arrow />
            <FlowNode icon="📰" title="RSS Sources" subtitle="lookback + source limit" tone="amber" /> <Arrow />
            <FlowNode icon="🧠" title="AI Enrichment" subtitle="summary, tags, vectors" /> <Arrow />
            <FlowNode icon="◈" title="Supabase" subtitle="feed, ideas, run state" tone="green" />
          </div>
          <div className="my-6 border-t border-dashed border-zinc-200 dark:border-zinc-800" />
          <p className="mb-4 text-xs font-bold uppercase tracking-widest text-zinc-400">Path B — immediate worldwide headlines (live, no model)</p>
          <div className="flex flex-col md:flex-row gap-3 md:items-stretch max-w-3xl">
            <FlowNode icon="🌐" title="Curated Feeds" subtitle="6 external publishers" tone="blue" /> <Arrow />
            <FlowNode icon="⚡" title="Parallel Fetch" subtitle="8-second timeout/source" tone="amber" /> <Arrow />
            <FlowNode icon="🗂️" title="Cluster + Persist" subtitle="multi-source stories → news_articles" tone="green" /> <Arrow />
            <FlowNode icon="🖥️" title="News UI + Today queue" subtitle="no model latency" />
          </div>
          <div className="my-6 border-t border-dashed border-zinc-200 dark:border-zinc-800" />
          <p className="mb-4 text-xs font-bold uppercase tracking-widest text-zinc-400">Path C — human-directed creation (on demand)</p>
          <div className="flex flex-col md:flex-row gap-3 md:items-stretch">
            <FlowNode icon="📌" title="Evidence" subtitle="outline · feed · custom · picked" tone="green" /> <Arrow />
            <FlowNode icon="🧭" title="Brief" subtitle="topic · POV · audience · voice" tone="blue" /> <Arrow />
            <FlowNode icon="🤖" title="8-Agent Loop" subtitle="draft · verify · evaluate" /> <Arrow />
            <FlowNode icon="📡" title="SSE Stream" subtitle="live status + artifacts" tone="amber" /> <Arrow />
            <FlowNode icon="✍️" title="Review & Publish" subtitle="edit, copy, or direct-publish" tone="green" />
          </div>
        </div>
      </GuideSection>

      {/* ══════════════════════ 2. SCHEDULED INGESTION ══════════════════════ */}
      <GuideSection id="scheduled-pipeline" eyebrow="Agent graph" title="The scheduled ingestion pipeline, node by node" description="The graph is deterministic around model calls: bounded inputs, persisted state, per-item failure tolerance, and a terminal run record. Shared article enrichment stays platform-owned; user-specific creation and digest layers use account-level provider settings.">
        <div className="grid gap-4 lg:grid-cols-5">
          {[
            ['1', 'Crawler', 'Load each user’s sources, resolve RSS, enforce lookback and entry caps, extract feed artwork.'],
            ['2', 'Summarise', 'The platform fallback model returns TL;DR, taxonomy tags, depth, why-it-matters, and takeaways once per article.'],
            ['3', 'Embed', 'A 384-d vector represents article meaning for preference-aware retrieval.'],
            ['4', 'Rank', 'Blend recency, topic similarity, and source tier; upsert the dated user feed.'],
            ['5', 'Ideas', 'The configured account model proposes exactly five schema-checked evidence-backed angles and the story-like daily digest.'],
          ].map(([n, title, text]) => (
            <div key={n} className="relative rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 pt-10">
              <span className="absolute left-5 top-0 -translate-y-1/2 rounded-full bg-violet-600 px-3 py-1.5 text-xs font-black text-white">NODE {n}</span>
              <h3 className="font-bold text-zinc-900 dark:text-zinc-100">{title}</h3><p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{text}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <Callout title="Concurrency">Article enrichment is the scalable fan-out point. Keep source and request limits bounded to stay inside runtime and model quotas.</Callout>
          <Callout title="Idempotency" tone="green">Article URL, dated feed membership, weekly digest, daily ideas, and Stripe events all use uniqueness boundaries.</Callout>
          <Callout title="Partial failure" tone="amber">A bad feed or model response should degrade one item/user, record the error, and preserve usable results.</Callout>
        </div>
      </GuideSection>

      {/* ══════════════════════ 3. READING QUEUE RANKING ══════════════════════ */}
      <GuideSection id="reading-ranking" eyebrow="Ranking, not generation" title="Daily Reading: candidate generation & ranking" description="lib/todayQueue.ts blends three candidate pools into one time-boxed queue. Pure rule-based ranking — instant, free, and reproducible. Deliberately not agentic: this is a sort problem, and heuristics make the 'why did this rank here' answer explainable in a UI tooltip.">
        <p className="mb-3 text-sm font-bold text-zinc-700 dark:text-zinc-300">Step by step:</p>
        <div className="grid gap-4 md:grid-cols-3">
          <FlowNode icon="📰" title="1. Feed pool" subtitle="blend_score — topic affinity + reaction history" tone="blue" />
          <FlowNode icon="📖" title="1. Library pool" subtitle="0.6 × topic affinity + 0.4 × recency" tone="amber" />
          <FlowNode icon="🌐" title="1. News pool" subtitle="independent-source coverage count" tone="green" />
        </div>
        <div className="my-3 text-center text-sm text-zinc-400">↓ 2. normalize each pool to 0–1 by its own max, independently ↓</div>
        <div className="grid gap-4 md:grid-cols-3">
          <FlowNode icon="🔀" title="3. Merge & sort" subtitle="descending by normalized score" />
          <FlowNode icon="🎲" title="4. Tiebreak" subtitle="random — not array position" tone="amber" />
          <FlowNode icon="✂️" title="5. Fill to budget" subtitle="top-down until minute target reached" tone="green" />
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Callout title="The bug this replaced" tone="amber">Array.sort is stable, and candidates were built as [...feed, ...reading_list, ...news]. With no tiebreaker, every tied score (extremely common for News, where most stories share the same source count) resolved in favor of whichever pool was concatenated first — News was systematically squeezed out regardless of how many fresh candidates existed. Fixed by adding a random tiebreaker computed once per candidate before sorting.</Callout>
          <Callout title="Cooldown and refresh" tone="green">Anything marked read stays out of the pool for 14 days, so the queue doesn&apos;t repeat itself. Refreshing only replaces items not yet acted on today — read/skipped items and undo are both preserved.</Callout>
        </div>
      </GuideSection>

      {/* ══════════════════════ 4. PUBLISHING ══════════════════════ */}
      <GuideSection id="publishing" eyebrow="Direct delivery" title="Publishing: sending an approved draft to a real platform" description="lib/publishing.ts — the same bring-your-own-credential pattern as the LLM provider key. A draft only leaves Signal after a human clicks Approve; publishing is a separate, explicit action after that.">
        <PipelineDiagram
          zones={publishingZones}
          exit={{ icon: '✅', label: 'Live on the platform, or in the user\'s inbox' }}
        />
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <Callout title="Encrypted at rest">Platform tokens use the same encryptSecret/decryptSecretIfNeeded helper as LLM API keys — never exposed in browser code, never re-displayed after saving.</Callout>
          <Callout title="Deliberately unsupported" tone="amber">Substack has no public posting API at all — export only. YouTube isn&apos;t applicable: Create writes a video script, not a rendered video file, so there&apos;s nothing to upload.</Callout>
          <Callout title="Multi-destination" tone="green">published_platforms is a set, not a single value — one draft can be published to Medium, LinkedIn, and emailed, independently, each tracked separately.</Callout>
        </div>
      </GuideSection>

      {/* ══════════════════════ 5. IDEA GENERATION & MULTI-PLATFORM DRAFTING ══════════════════════ */}
      <GuideSection id="idea-generation" eyebrow="Creation engine" title="Idea generation & multi-platform drafting" description="Two things happen before the 8-agent loop ever runs: picking a topic, and deciding how many ideas × how many platforms to generate. The loop itself is the evidence-grounded, evaluated pipeline also used by Create.">
        <p className="mb-3 text-sm font-bold text-zinc-700 dark:text-zinc-300">Step 1 — pick the topic (lib/contentSignals.ts)</p>
        <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 mb-5">
          <div className="grid grid-cols-[1.3fr_2fr] gap-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-zinc-400"><span>Signal (weighted, adjustable)</span><span>What it measures</span></div>
          {[
            ['Explicit engagement', 'Articles/items you liked, pinned, or saved'],
            ['Recently read', 'What you’ve read in the Today queue, last few days'],
            ['Trending news', 'Stories covered by multiple News sources, relevant to your feed'],
            ['Recent trend', 'Terms picking up velocity in your tracked sources'],
            ['Emerging topic', 'Brand-new terms with no prior history'],
          ].map(row => <div key={row[0]} className="grid grid-cols-[1.3fr_2fr] gap-3 border-b last:border-0 border-zinc-100 dark:border-zinc-800/70 px-4 py-3 text-xs"><strong className="text-zinc-800 dark:text-zinc-200">{row[0]}</strong><span className="text-zinc-500 dark:text-zinc-400">{row[1]}</span></div>)}
        </div>
        <div className="grid gap-4 md:grid-cols-2 mb-8">
          <Callout title="Same tiebreak fix applied here">pickWeightedCandidates ranks Feed, Library, and News candidates the same normalize-merge-sort way as the reading queue, and had the identical stable-sort tie bias against News. Fixed with the same random tiebreaker.</Callout>
          <Callout title="Interest is a multiplier, not a 6th signal" tone="green">Declared/learned interest areas scale the blended score by 0.5×–1.5× rather than competing for their own slice of weight — so it modulates every candidate instead of only rewarding exact-topic matches.</Callout>
        </div>

        <p className="mb-3 text-sm font-bold text-zinc-700 dark:text-zinc-300">Step 2 — fan out: N ideas × N platforms</p>
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <FlowNode icon="💡" title="1–3 ideas" subtitle="top-K distinct candidates, each a full topic" tone="blue" />
          <FlowNode icon="🤖" title="Primary format" subtitle="full 8-agent loop, per idea" tone="amber" />
          <FlowNode icon="🔁" title="Extra formats" subtitle="cheap Republish-adapted variant of the same draft" tone="green" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 mb-8">
          <Callout title="Why not N full generations">Every additional platform for the same idea reuses the primary draft&apos;s verified content and adapts structure/length — not a second evidence-grounded pipeline run. N ideas × M platforms costs N full loops, not N×M.</Callout>
          <Callout title="Manual vs. autonomous" tone="amber">Drafts Inbox (autonomous, once a day, capped by a source=&apos;auto&apos; unique index) uses generateDailyDraftForUser. The Today page&apos;s &quot;Generate today&apos;s content&quot; button (source=&apos;manual&apos;, unlimited) calls generateSmartDraftsForUser directly — same pipeline, different caller and cap.</Callout>
        </div>

        <p className="mb-3 text-sm font-bold text-zinc-700 dark:text-zinc-300">Step 3 — the 8-agent evidence-grounded loop (per idea × primary format)</p>
        <PipelineDiagram
          zones={contentGenZones}
          exit={{ icon: '✍️', label: 'Human Review — edit, copy, approve, or publish' }}
        />
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <Callout title="The fix that mattered most"><p>Every agent used to see only a source&apos;s title, URL, and domain — never its actual content. The Claim Verifier checked citations against a literal placeholder string. Citations looked rigorous but had nothing real to be grounded in.</p></Callout>
          <Callout title="Hard gate, not a suggestion" tone="amber"><p>A hallucinated or unsupported citation blocks the loop from finishing clean, regardless of the Evaluator&apos;s overall score. <code>MAX_LOOPS = 3</code> still bounds cost — if issues remain at the ceiling, a citation_warning names them explicitly on Review &amp; Export.</p></Callout>
          <Callout title="Reader pressure test" tone="green"><p>Only after the quality loop does the system simulate a skeptical engineer, product lead, and executive skimmer, then apply one final polish that fixes specific lines without restructuring.</p></Callout>
        </div>
        <div className="mt-5">
          <Callout title="Generation runs in the background, on purpose">/api/today/generate creates a content_generation_jobs row and returns a jobId immediately; the actual work runs via Next.js&apos;s after(), decoupled from the request&apos;s connection. The Today page polls /api/today/generate/status every few seconds. Navigating away — or even closing the tab — no longer cuts a generation short partway through, which used to be a real failure mode when generation ran synchronously inside the request.</Callout>
        </div>

        <div className="mt-8">
          <p className="mb-3 text-sm font-bold text-zinc-700 dark:text-zinc-300">Output contracts per platform (shared by UI previews and server-side agents)</p>
          <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <div className="grid grid-cols-[1fr_1fr_1.8fr_1.5fr] gap-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-zinc-400"><span>Format</span><span>Budget</span><span>Structural contract</span><span>Citation contract</span></div>
            {[
              ['LinkedIn', '200–280 words / 1,300 chars', 'Hook → short paragraphs → CTA', 'Inline domain + Sources'],
              ['Substack', '700–1,000 words', 'Story → problem → 3 insights → close', 'Markdown links + Sources'],
              ['X Thread', '8–12 × 280 chars', 'Numbered insight sequence', 'Domain tags + final URLs'],
              ['Blog', '1,500–2,000 words', 'TL;DR → 4–6 H2 → actions', 'Inline links + Sources'],
              ['YouTube Long', '8–12 minutes', 'Hook → chapters → CTA + B-roll', 'Editor notes + description links'],
              ['YouTube Short', '60–90 seconds', '3s hook → fast insights → payoff', 'One source + overlay cue'],
            ].map(row => <div key={row[0]} className="grid grid-cols-[1fr_1fr_1.8fr_1.5fr] gap-3 border-b last:border-0 border-zinc-100 dark:border-zinc-800/70 px-4 py-3 text-xs"><strong className="text-zinc-800 dark:text-zinc-200">{row[0]}</strong><span className="text-violet-600 dark:text-violet-400">{row[1]}</span><span className="text-zinc-500">{row[2]}</span><span className="text-zinc-400">{row[3]}</span></div>)}
          </div>
        </div>
      </GuideSection>

      {/* ══════════════════════ 6. STREAMING ══════════════════════ */}
      <GuideSection id="streaming" eyebrow="Runtime protocol" title="How generation reaches the browser" description="The UI does not wait behind a blank spinner. Each agent emits a structured SSE event that updates its row and exposes intermediate output for inspection — used by Create's five-minute-budget generation.">
        <div className="grid gap-4 md:grid-cols-5">
          <FlowNode icon="▶" title="agent_start" subtitle="mark one agent running" tone="blue" />
          <FlowNode icon="✓" title="agent_complete" subtitle="status + inspectable output" tone="green" />
          <FlowNode icon="↻" title="loop_start" subtitle="reset quality-loop agents" tone="amber" />
          <FlowNode icon="◆" title="complete" subtitle="deliver editable final" />
          <FlowNode icon="!" title="error" subtitle="mark failure + allow retry" tone="amber" />
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Callout title="Persisted after success"><p><code>generation_jobs</code> stores user, brief, format, status, and completion time. <code>generation_artifacts</code> stores orchestrator brief, draft, critique, final, verifier report, audience feedback, and evaluator scores.</p></Callout>
          <Callout title="Two generation paths, two protocols" tone="green"><p>Create streams live via SSE for an interactive session. Today&apos;s background job (previous section) is fire-and-poll instead — no open connection to keep alive, safe across navigation.</p></Callout>
        </div>
      </GuideSection>

      {/* ══════════════════════ 7. ASK SIGNAL ══════════════════════ */}
      <GuideSection id="ask-signal" eyebrow="Recall engine" title="Ask Signal: retrieval-grounded Q&A across everything you've read" description="One retrieval pipeline behind three entry points — Today (inline), the Feed tab, and the standalone Memory Assistant page. They share one implementation end to end, including what gets remembered afterward (see Memory, next).">
        <PipelineDiagram
          zones={ragZones}
          exit={{ icon: '💬', label: 'Grounded answer + citations, shown in every surface' }}
        />
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <Callout title="Answer only from context"><p>The generation step is explicitly instructed to answer only from the assembled feed/knowledge/chat context — not from open-ended model knowledge — and to cite which numbered source backed each part of the answer.</p></Callout>
          <Callout title="Shared, not duplicated" tone="green"><p>All entry points call the same component and the same API route. A question asked on Today shows up in Memory Assistant&apos;s history and vice versa, by construction rather than by convention.</p></Callout>
          <Callout title="Item-aware on Today" tone="amber"><p>Every reading-queue item and draft card has a &quot;💬 Ask about this&quot; shortcut that pre-fills a question and jumps straight to the panel — no retyping context to refer to something already on screen.</p></Callout>
        </div>
      </GuideSection>

      {/* ══════════════════════ 8. MEMORY ══════════════════════ */}
      <GuideSection id="memory" eyebrow="Personalization state" title="Memory: what Signal remembers about you, and where" description="Two kinds of memory: episodic (what you did — opens, pins, likes, chats) that quietly improves ranking and recall, and stylistic (your Voice Fingerprint) that shapes how generated content sounds. Neither is fine-tuning — both are retrieval-time context.">
        <div className="grid gap-4 md:grid-cols-3">
          <FeatureCard icon="👆" title="Episodic events">user_article_events, user_knowledge_events, and user_chat_events log opens, pins, likes, and prior recall Q&amp;As. Ask Signal reads these to ground answers; the same events also apply a small recency-decayed boost to feed ranking.</FeatureCard>
          <FeatureCard icon="🔥" title="Reading & publishing streaks">Computed live from daily_reading_queue and draft_inbox_items — no separate streak table. A "complete" day is any item read or any draft approved; current streak counts backward, tolerant of an in-progress today.</FeatureCard>
          <FeatureCard icon="🗣️" title="Voice feedback loop">Feedback typed on a draft (regenerate-with-feedback) is logged and periodically distilled by an LLM into voice_principles — durable lessons, not just a one-off rewrite.</FeatureCard>
        </div>

        <p className="mt-8 mb-3 text-sm font-bold text-zinc-700 dark:text-zinc-300">Voice Fingerprint — retrieval-time style control, not fine-tuning</p>
        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-stretch">
            <FlowNode icon="✍️" title="3–5 Posts" subtitle="150+ chars each · 50k total cap" tone="blue" /> <Arrow />
            <FlowNode icon="📏" title="Local Metrics" subtitle="sentence split + word distribution" tone="green" /> <Arrow />
            <FlowNode icon="🧠" title="Voice Analyst" subtitle="account's configured model + JSON Schema" /> <Arrow />
            <FlowNode icon="◈" title="user_profiles" subtitle="voice_fingerprint JSONB" tone="amber" /> <Arrow />
            <FlowNode icon="📜" title="Constitution" subtitle="prompt-time style constraints" tone="green" />
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <FeatureCard icon="〽️" title="Deterministic rhythm">Average sentence length, 20th–80th percentile range, and short/medium/long percentages are computed in code rather than guessed by the model.</FeatureCard>
          <FeatureCard icon="🔎" title="Conservative inference">Structured analysis extracts repeated phrases, transitions, certainty behavior, paragraph patterns, tone dimensions, and executable principles.</FeatureCard>
          <FeatureCard icon="🧩" title="Prompt injection point">The constitution is appended to Writer, Humanizer, and Final Polish system instructions on every quality loop.</FeatureCard>
          <FeatureCard icon="⚖️" title="Precedence rules">Citation accuracy comes first, platform requirements second, and personal rhythm applies everywhere those constraints leave room.</FeatureCard>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Callout title="Privacy boundary"><p>The API validates 3–5 bounded samples, sends them once to the user-selected provider, and persists only the structured fingerprint. Raw post text is not inserted into Signal&rsquo;s database.</p></Callout>
          <Callout title="Safe fallback" tone="green"><p>Profiles without a fingerprint receive the existing platform-aware prompts unchanged. A failed profile lookup does not block content generation.</p></Callout>
        </div>
      </GuideSection>

      {/* ══════════════════════ 9. DIGESTS ══════════════════════ */}
      <GuideSection id="digest" eyebrow="Optimized synthesis" title="Daily and Weekly Digests: cached stories, not disposable summaries" description="Synthesis is intentionally heavier than headline retrieval because it turns ranked evidence into a connected narrative. Daily digests are generated in the nightly pipeline; weekly digests are cached and regenerated on demand.">
        <div className="grid gap-4 md:grid-cols-4">
          <FlowNode icon="🌅" title="Daily Digest" subtitle="nightly pipeline story" tone="green" />
          <FlowNode icon="🗃️" title="Weekly cache" subtitle="user + UTC week" tone="blue" />
          <FlowNode icon="12" title="Top evidence" subtitle="deduplicated ranked articles" tone="amber" />
          <FlowNode icon="✉️" title="Email delivery" subtitle="optional once-per-day send" />
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Callout title="Daily digest path">The nightly pipeline writes one daily digest row per user, optionally emails it, keeps recent items close for 7 days, and treats older rows as archive material.</Callout>
          <Callout title="Weekly digest path" tone="green">The Regenerate button bypasses cache, refreshes outside context, validates structured output, and replaces the current week&apos;s row. Older generated weeks naturally become archive entries after 8 weeks.</Callout>
        </div>
      </GuideSection>

      {/* ══════════════════════ 10. COMMERCIAL MODEL ══════════════════════ */}
      <GuideSection id="commercial-boundaries" eyebrow="Commercial model" title="Subscription entitlement and model execution are separate concerns" description="Signal should be explainable commercially as well as technically. Product access, execution permissions, and model spend are different things.">
        <div className="grid gap-4 md:grid-cols-3">
          <FeatureCard icon="👤" title="Identity">Supabase auth identifies the user and scopes sources, feed items, digests, voice fingerprint, and generation artifacts.</FeatureCard>
          <FeatureCard icon="💳" title="Entitlement">Subscription status unlocks premium capabilities such as setting provider/model/key and running premium generation without the admin wall.</FeatureCard>
          <FeatureCard icon="🧠" title="Execution dependency">A configured account-level API key determines which provider actually executes premium generation. Model spend remains the user's own.</FeatureCard>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Callout title="Current rule"><p>Paid workflows are permitted when the request is admin-approved, or when the account has both subscription entitlement and a stored account-level model key.</p></Callout>
          <Callout title="Cold-start guests" tone="amber"><p>Signed-out visitors get a public, read-only view of the admin/demo account&apos;s Today queue and drafts (same trust model as /api/data/feed) instead of a blank page. Writes still require a session or an admin token.</p></Callout>
        </div>
      </GuideSection>

      {/* ══════════════════════ 11. STACK ══════════════════════ */}
      <GuideSection id="stack" eyebrow="Technology" title="The stack and its job boundaries" description="Each technology owns a narrow responsibility. That containment makes failures diagnosable and cost visible.">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stack.map(([icon, title, text]) => <FeatureCard key={title} icon={icon} title={title}>{text}</FeatureCard>)}
        </div>
      </GuideSection>

      {/* ══════════════════════ 12. DATA MODEL ══════════════════════ */}
      <GuideSection id="data" eyebrow="Persistence" title="Core data relationships" description="Global article enrichment is reused. Personal ranking, feedback, ideas, and digests remain user-scoped.">
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
          <div className="min-w-[760px] grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-3 text-center">
            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/40 p-4"><strong className="text-sm text-blue-700 dark:text-blue-300">user_profiles</strong><p className="mt-1 text-[11px] text-zinc-500">preferences · plan · voice fingerprint</p></div><span>→</span>
            <div className="rounded-xl bg-violet-50 dark:bg-violet-950/40 p-4"><strong className="text-sm text-violet-700 dark:text-violet-300">user_sources</strong><p className="mt-1 text-[11px] text-zinc-500">URL · RSS · tier</p></div><span>→</span>
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 p-4"><strong className="text-sm text-amber-700 dark:text-amber-300">articles</strong><p className="mt-1 text-[11px] text-zinc-500">enrichment · image · vector</p></div>
          </div>
          <div className="my-3 text-center text-zinc-300 dark:text-zinc-700">↓</div>
          <div className="grid gap-3 md:grid-cols-4 text-center">
            {['user_feed_items', 'article_reactions', 'daily_ideas', 'daily_digests', 'weekly_digests', 'content_outlines', 'generation_jobs', 'generation_artifacts', 'daily_reading_queue', 'draft_inbox_items', 'content_generation_jobs', 'news_articles', 'platform_connections'].map(name => <div key={name} className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-3 text-xs font-bold text-zinc-700 dark:text-zinc-300">{name}</div>)}
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Callout title="Shared versus private"><p><code>articles</code> and <code>news_articles</code> are shared global enrichment. <code>user_sources</code>, <code>user_feed_items</code>, digests, voice fingerprints, drafts, and generation artifacts are user-scoped.</p></Callout>
          <Callout title="Why this matters for trust" tone="green"><p>The product should always be able to explain whether a result came from shared article knowledge or a user-specific personalization layer.</p></Callout>
        </div>
      </GuideSection>

      {/* ══════════════════════ 13. API MAP ══════════════════════ */}
      <GuideSection id="api" eyebrow="Interfaces" title="API boundary map" description="Browser-facing routes isolate credentials and normalize access to Supabase, GitHub, per-user model providers, and external feeds.">
        <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="grid grid-cols-[1.2fr_.55fr_2fr] gap-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-zinc-400"><span>Route</span><span>Method</span><span>Responsibility</span></div>
          {apiRows.map(([route, method, job]) => <div key={route} className="grid grid-cols-[1.2fr_.55fr_2fr] gap-4 border-b last:border-0 border-zinc-100 dark:border-zinc-800/70 px-4 py-3 text-xs"><code className="text-violet-600 dark:text-violet-400">{route}</code><span className="font-bold text-zinc-600 dark:text-zinc-300">{method}</span><span className="text-zinc-500 dark:text-zinc-400">{job}</span></div>)}
        </div>
      </GuideSection>

      {/* ══════════════════════ 14. RELIABILITY ══════════════════════ */}
      <GuideSection id="reliability" eyebrow="Operations" title="Reliability and observability contract" description="A green workflow is not enough; the UI follows durable database state and reports terminal outcomes.">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <FeatureCard icon="⏱️" title="Run tracking">Every user run opens a <code>crawl_runs</code> row. UI polling distinguishes queued, running, completed, degraded, and timeout states.</FeatureCard>
          <FeatureCard icon="🧯" title="Failure isolation">Feed failures do not erase good items. Model failures produce explicit empty/error states rather than malformed partial data.</FeatureCard>
          <FeatureCard icon="🔒" title="Secret boundaries">Service role, GitHub PAT, payment secrets, and model keys stay server-side. Premium users authenticate with Supabase and run on their own provider settings; admin credentials are only an operational fallback.</FeatureCard>
          <FeatureCard icon="📏" title="Bounded work">UI choices, server validation, RSS timeouts, source caps, article limits, and response schemas bound latency and spend.</FeatureCard>
          <FeatureCard icon="🧬" title="Deduplication">URL uniqueness protects global articles; API range views deduplicate repeated dated rankings before rendering.</FeatureCard>
          <FeatureCard icon="🗂️" title="Cache strategy">Global enrichment is reused for all users; daily digests are written nightly per user; weekly synthesis is reused until explicit regeneration.</FeatureCard>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Callout title="Explainability contract"><p>Users should be able to inspect why something surfaced, whether a digest is cached or fresh, which provider/model produced output, and which sources grounded the result.</p></Callout>
          <Callout title="Expectation to carry into the UI" tone="green"><p>Trust improves when the product reveals scoring reasons, generation provenance, and data boundaries at decision points instead of hiding them in docs.</p></Callout>
        </div>
      </GuideSection>

      {/* ══════════════════════ 15. DEPLOY ══════════════════════ */}
      <GuideSection id="deploy" eyebrow="Runbook" title="Deployment checklist" description="Apply database changes before deploying code that selects or writes the new fields.">
        <div className="grid gap-4 md:grid-cols-2">
          <Callout title="Supabase"><ol className="list-decimal space-y-1.5 pl-4"><li>Apply migrations in numeric order.</li><li>Confirm pgvector and UUID extensions.</li><li>Set service-role credentials only on trusted runtimes.</li><li>Inspect <code>crawl_runs</code> after a smoke run.</li></ol></Callout>
          <Callout title="GitHub + Vercel" tone="green"><ol className="list-decimal space-y-1.5 pl-4"><li>Set Supabase, Stripe, GitHub PAT, and server secrets in Vercel.</li><li>Set fallback model keys only if you want a non-user-specific default path.</li><li>Dispatch a 1-day / 1-entry smoke run.</li><li>Verify feed, digest cache, status polling, and paid account model settings.</li></ol></Callout>
        </div>
      </GuideSection>
    </div>
  )
}
