import { Arrow, Callout, FeatureCard, FlowNode, GuideHero, GuideSection } from '@/components/GuideUI'

const stack = [
  ['▲', 'Next.js 16', 'App Router, server routes, React 19, Tailwind CSS 4'],
  ['⚡', 'GitHub Actions', 'Manual dispatch plus daily schedule; isolated Python runner'],
  ['🧠', 'LangGraph', 'Crawler → summarise → rank → ideas state machine'],
  ['✦', 'Claude', 'Haiku enrichment, Sonnet ideas/digests/drafts'],
  ['◈', 'Supabase', 'Postgres, Auth-ready profiles, RLS, service APIs'],
  ['⌁', 'pgvector', '384-dimensional embeddings and relevance scoring'],
  ['◉', 'RSS / Atom', 'User-controlled sources plus worldwide news radar'],
  ['▦', 'Vercel', 'Next.js hosting, API execution, environment management'],
]

const apiRows = [
  ['/api/pipeline/trigger', 'POST', 'Dispatches the GitHub workflow with bounded crawl settings'],
  ['/api/pipeline/status', 'GET', 'Tracks the current user run through crawl_runs'],
  ['/api/data/feed', 'GET', 'Returns deduplicated ranked feed items'],
  ['/api/data/ai-news', 'GET', 'Parallel live RSS aggregation; no LLM'],
  ['/api/data/narrative', 'GET / POST', 'Reads weekly cache or explicitly regenerates structured output'],
  ['/api/articles/react', 'GET / POST / DELETE', 'Stores like/dislike feedback'],
  ['/api/generate', 'POST', 'Streams a user-directed content draft'],
]

export default function ImplementationGuidePage() {
  return (
    <div className="mx-auto max-w-6xl p-6 md:p-8 pb-24">
      <GuideHero eyebrow="Engineering Field Guide" title="How Signal turns a noisy web into an auditable intelligence workflow"
        description="This guide maps the runtime architecture, agent graph, data model, model tiers, API boundaries, reliability decisions, and deployment controls. It is written for maintainers who need to understand not only what runs, but why the system is shaped this way."
        chips={['Next.js + Python', 'Supabase + pgvector', 'Claude tiering', 'GitHub Actions', 'Human-in-the-loop']} />

      <GuideSection id="architecture" eyebrow="System map" title="Two paths, one intelligence layer" description="The scheduled path builds durable personalized intelligence. The immediate path serves live worldwide headlines without waiting for enrichment.">
        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <p className="mb-4 text-xs font-bold uppercase tracking-widest text-zinc-400">Durable personalized path</p>
          <div className="flex flex-col md:flex-row gap-3 md:items-stretch">
            <FlowNode icon="🖱️" title="UI / Schedule" subtitle="workflow_dispatch or cron" /> <Arrow />
            <FlowNode icon="⚙️" title="GitHub Runner" subtitle="Python 3.11 + LangGraph" tone="blue" /> <Arrow />
            <FlowNode icon="📰" title="RSS Sources" subtitle="lookback + source limit" tone="amber" /> <Arrow />
            <FlowNode icon="🧠" title="AI Enrichment" subtitle="summary, tags, vectors" /> <Arrow />
            <FlowNode icon="◈" title="Supabase" subtitle="feed, ideas, run state" tone="green" />
          </div>
          <div className="my-6 border-t border-dashed border-zinc-200 dark:border-zinc-800" />
          <p className="mb-4 text-xs font-bold uppercase tracking-widest text-zinc-400">Immediate worldwide path</p>
          <div className="flex flex-col md:flex-row gap-3 md:items-stretch max-w-3xl">
            <FlowNode icon="🌐" title="Curated Feeds" subtitle="6 external publishers" tone="blue" /> <Arrow />
            <FlowNode icon="⚡" title="Parallel Fetch" subtitle="8-second timeout/source" tone="amber" /> <Arrow />
            <FlowNode icon="🗂️" title="Sort + Dedupe" subtitle="up to 40 headlines" tone="green" /> <Arrow />
            <FlowNode icon="🖥️" title="AI News UI" subtitle="no model latency" />
          </div>
        </div>
      </GuideSection>

      <GuideSection id="stack" eyebrow="Technology" title="The stack and its job boundaries" description="Each technology owns a narrow responsibility. That containment makes failures diagnosable and cost visible.">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stack.map(([icon, title, text]) => <FeatureCard key={title} icon={icon} title={title}>{text}</FeatureCard>)}
        </div>
      </GuideSection>

      <GuideSection id="agent" eyebrow="Agent graph" title="The daily pipeline, node by node" description="The graph is deterministic around model calls: bounded inputs, persisted state, per-item failure tolerance, and a terminal run record.">
        <div className="grid gap-4 lg:grid-cols-5">
          {[
            ['1', 'Crawler', 'Load each user’s sources, resolve RSS, enforce lookback and entry caps, extract feed artwork.'],
            ['2', 'Summarise', 'Claude Haiku returns TL;DR, taxonomy tags, depth, why-it-matters, and takeaways.'],
            ['3', 'Embed', 'A 384-d vector represents article meaning for preference-aware retrieval.'],
            ['4', 'Rank', 'Blend recency, topic similarity, and source tier; upsert the dated user feed.'],
            ['5', 'Ideas', 'Claude Sonnet proposes exactly five schema-checked evidence-backed angles.'],
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

      <GuideSection id="digest" eyebrow="Optimized synthesis" title="Why Weekly Digest is slower—and how caching changes the curve" description="Synthesis is intentionally heavier than headline retrieval because it compares personalized evidence with outside framing.">
        <div className="grid gap-4 md:grid-cols-4">
          <FlowNode icon="🗃️" title="Cache check" subtitle="user + UTC week" tone="green" />
          <FlowNode icon="12" title="Top evidence" subtitle="deduplicated articles" tone="blue" />
          <FlowNode icon="8" title="World context" subtitle="live RSS headlines" tone="amber" />
          <FlowNode icon="✓" title="JSON Schema" subtitle="3 watches, valid fields" />
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Callout title="GET: fast default">Returns the current week’s cached narrative when available. A cache miss performs one generation and persists the result.</Callout>
          <Callout title="POST: deliberate refresh" tone="green">The Regenerate button bypasses cache, refreshes outside context, validates structured output, and replaces the weekly row.</Callout>
        </div>
      </GuideSection>

      <GuideSection id="data" eyebrow="Persistence" title="Core data relationships" description="Global article enrichment is reused. Personal ranking, feedback, ideas, and digests remain user-scoped.">
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
          <div className="min-w-[760px] grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-3 text-center">
            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/40 p-4"><strong className="text-sm text-blue-700 dark:text-blue-300">user_profiles</strong><p className="mt-1 text-[11px] text-zinc-500">preferences · plan · style</p></div><span>→</span>
            <div className="rounded-xl bg-violet-50 dark:bg-violet-950/40 p-4"><strong className="text-sm text-violet-700 dark:text-violet-300">user_sources</strong><p className="mt-1 text-[11px] text-zinc-500">URL · RSS · tier</p></div><span>→</span>
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 p-4"><strong className="text-sm text-amber-700 dark:text-amber-300">articles</strong><p className="mt-1 text-[11px] text-zinc-500">enrichment · image · vector</p></div>
          </div>
          <div className="my-3 text-center text-zinc-300 dark:text-zinc-700">↓</div>
          <div className="grid gap-3 md:grid-cols-4 text-center">
            {['user_feed_items', 'article_reactions', 'daily_ideas', 'weekly_digests'].map(name => <div key={name} className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-3 text-xs font-bold text-zinc-700 dark:text-zinc-300">{name}</div>)}
          </div>
        </div>
      </GuideSection>

      <GuideSection id="api" eyebrow="Interfaces" title="API boundary map" description="Browser-facing routes isolate credentials and normalize access to Supabase, GitHub, Anthropic, and external feeds.">
        <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="grid grid-cols-[1.2fr_.55fr_2fr] gap-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-zinc-400"><span>Route</span><span>Method</span><span>Responsibility</span></div>
          {apiRows.map(([route, method, job]) => <div key={route} className="grid grid-cols-[1.2fr_.55fr_2fr] gap-4 border-b last:border-0 border-zinc-100 dark:border-zinc-800/70 px-4 py-3 text-xs"><code className="text-violet-600 dark:text-violet-400">{route}</code><span className="font-bold text-zinc-600 dark:text-zinc-300">{method}</span><span className="text-zinc-500 dark:text-zinc-400">{job}</span></div>)}
        </div>
      </GuideSection>

      <GuideSection id="reliability" eyebrow="Operations" title="Reliability and observability contract" description="A green workflow is not enough; the UI follows durable database state and reports terminal outcomes.">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <FeatureCard icon="⏱️" title="Run tracking">Every user run opens a <code>crawl_runs</code> row. UI polling distinguishes queued, running, completed, degraded, and timeout states.</FeatureCard>
          <FeatureCard icon="🧯" title="Failure isolation">Feed failures do not erase good items. Model failures produce explicit empty/error states rather than malformed partial data.</FeatureCard>
          <FeatureCard icon="🔒" title="Secret boundaries">Service role, GitHub PAT, and model keys stay server-side. Only public Supabase configuration reaches the browser.</FeatureCard>
          <FeatureCard icon="📏" title="Bounded work">UI choices, server validation, RSS timeouts, source caps, article limits, and response schemas bound latency and spend.</FeatureCard>
          <FeatureCard icon="🧬" title="Deduplication">URL uniqueness protects global articles; API range views deduplicate repeated dated rankings before rendering.</FeatureCard>
          <FeatureCard icon="🗂️" title="Cache strategy">Global enrichment is reused for all users; weekly synthesis is reused until explicit regeneration.</FeatureCard>
        </div>
      </GuideSection>

      <GuideSection id="deploy" eyebrow="Runbook" title="Deployment checklist" description="Apply database changes before deploying code that selects or writes the new fields.">
        <div className="grid gap-4 md:grid-cols-2">
          <Callout title="Supabase"><ol className="list-decimal space-y-1.5 pl-4"><li>Apply migrations in numeric order.</li><li>Confirm pgvector and UUID extensions.</li><li>Set service-role credentials only on trusted runtimes.</li><li>Inspect <code>crawl_runs</code> after a smoke run.</li></ol></Callout>
          <Callout title="GitHub + Vercel" tone="green"><ol className="list-decimal space-y-1.5 pl-4"><li>Set Anthropic and Supabase GitHub secrets.</li><li>Set GitHub PAT and server secrets in Vercel.</li><li>Dispatch a 1-day / 1-entry smoke run.</li><li>Verify feed, digest cache, and status polling.</li></ol></Callout>
        </div>
      </GuideSection>
    </div>
  )
}
