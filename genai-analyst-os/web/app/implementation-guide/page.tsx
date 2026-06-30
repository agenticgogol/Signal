import { Arrow, Callout, FeatureCard, FlowNode, GuideHero, GuideSection } from '@/components/GuideUI'

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
  ['/api/data/feed', 'GET', 'Returns deduplicated ranked feed items'],
  ['/api/data/daily-digest', 'GET', 'Reads the latest daily story plus recent and archived daily digests'],
  ['/api/data/digest-archives', 'GET', 'Returns older daily and weekly digest archive lists'],
  ['/api/data/digest-settings', 'GET / POST', 'Stores daily digest email preferences and delivery address'],
  ['/api/data/ai-news', 'GET', 'Parallel live RSS aggregation; no LLM'],
  ['/api/data/narrative', 'GET / POST', 'Reads weekly cache or explicitly regenerates structured output'],
  ['/api/ideas/generate', 'POST', 'Uses recent feed context and preferences to propose five topics'],
  ['/api/outline/generate', 'POST', 'Builds a hook, audience, angle, format, and editable section plan'],
  ['/api/outline/save', 'POST', 'Freezes an approved outline for deterministic reuse in Create'],
  ['/api/data/voice', 'GET', 'Reads the current structured fingerprint from user_profiles'],
  ['/api/voice/analyze', 'POST', 'Extracts voice patterns, computes rhythm metrics, and replaces the fingerprint'],
  ['/api/articles/react', 'GET / POST / DELETE', 'Stores like/dislike feedback'],
  ['/api/generate', 'POST + SSE', 'Streams the eight-agent drafting and quality workflow'],
]

export default function ImplementationGuidePage() {
  return (
    <div className="mx-auto max-w-6xl p-6 md:p-8 pb-24">
      <GuideHero eyebrow="Engineering Field Guide" title="How Signal turns a noisy web into an auditable intelligence workflow"
        description="This guide maps the runtime architecture, agent graph, data model, model tiers, API boundaries, reliability decisions, and deployment controls. It is written for maintainers who need to understand not only what runs, but why the system is shaped this way."
        chips={['Next.js + Python', 'Supabase + pgvector', 'Per-user LLM routing', 'GitHub Actions', 'Human-in-the-loop']} />

      <GuideSection id="architecture" eyebrow="System map" title="Three paths, one intelligence layer" description="The scheduled path builds durable personalized intelligence. The immediate path serves live worldwide headlines. The creation path turns selected evidence and human direction into reviewed platform-native content.">
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
          <div className="my-6 border-t border-dashed border-zinc-200 dark:border-zinc-800" />
          <p className="mb-4 text-xs font-bold uppercase tracking-widest text-zinc-400">Human-directed creation path</p>
          <div className="flex flex-col md:flex-row gap-3 md:items-stretch">
            <FlowNode icon="📌" title="Evidence" subtitle="outline · feed · custom" tone="green" /> <Arrow />
            <FlowNode icon="🧭" title="Human Brief" subtitle="topic · POV · audience · voice" tone="blue" /> <Arrow />
            <FlowNode icon="🤖" title="8-Agent Loop" subtitle="draft · verify · evaluate" /> <Arrow />
            <FlowNode icon="📡" title="SSE Stream" subtitle="live status + artifacts" tone="amber" /> <Arrow />
            <FlowNode icon="✍️" title="Human Review" subtitle="edit · copy · publish manually" tone="green" />
          </div>
        </div>
      </GuideSection>

      <GuideSection id="commercial-boundaries" eyebrow="Commercial model" title="Subscription entitlement and model execution are separate concerns" description="Signal should be explainable commercially as well as technically. Product access, execution permissions, and model spend are different things.">
        <div className="grid gap-4 md:grid-cols-3">
          <FeatureCard icon="👤" title="Identity">Supabase auth identifies the user and scopes sources, feed items, digests, voice fingerprint, and generation artifacts.</FeatureCard>
          <FeatureCard icon="💳" title="Entitlement">Subscription status unlocks premium capabilities such as setting provider/model/key and running premium generation without the admin wall.</FeatureCard>
          <FeatureCard icon="🧠" title="Execution dependency">A configured account-level API key determines which provider actually executes premium generation. Model spend remains the user’s own.</FeatureCard>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Callout title="Current rule"><p>Paid workflows are permitted when the request is admin-approved, or when the account has both subscription entitlement and a stored account-level model key.</p></Callout>
          <Callout title="Why this is cleaner" tone="amber"><p>Entitlement and execution dependency are still separate concepts, but the operational rule is now explicit: subscription unlocks the feature, and the saved key powers the run.</p></Callout>
        </div>
      </GuideSection>

      <GuideSection id="stack" eyebrow="Technology" title="The stack and its job boundaries" description="Each technology owns a narrow responsibility. That containment makes failures diagnosable and cost visible.">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stack.map(([icon, title, text]) => <FeatureCard key={title} icon={icon} title={title}>{text}</FeatureCard>)}
        </div>
      </GuideSection>

      <GuideSection id="agent" eyebrow="Agent graph" title="The daily pipeline, node by node" description="The graph is deterministic around model calls: bounded inputs, persisted state, per-item failure tolerance, and a terminal run record. Shared article enrichment stays platform-owned; user-specific creation and digest layers use account-level provider settings.">
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

      <GuideSection id="content-generation" eyebrow="Creation engine" title="Content generation is an evaluated agent loop" description="The Create API has a five-minute execution budget and streams progress as Server-Sent Events. Expensive creative work uses Sonnet; bounded checking work uses Haiku.">
        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <p className="mb-4 text-xs font-bold uppercase tracking-widest text-zinc-400">Input assembly</p>
          <div className="grid gap-3 md:grid-cols-4">
            <FlowNode icon="📚" title="Sources" subtitle="1–3 feed articles or frozen outline" tone="green" />
            <FlowNode icon="💬" title="Author Direction" subtitle="topic · angle · optional POV" tone="blue" />
            <FlowNode icon="👤" title="Audience" subtitle="engineer · PM · leader · mixed" tone="amber" />
            <FlowNode icon="🎙️" title="Voice + Platform" subtitle="fingerprint · length · citations" />
          </div>
          <div className="my-6 text-center text-2xl text-zinc-300 dark:text-zinc-700">↓</div>
          <div className="grid gap-3 md:grid-cols-4">
            {[
              ['1', 'Orchestrator', 'Sonnet', 'claim plan + hook'],
              ['2', 'Writer', 'Sonnet', 'platform-native draft'],
              ['3', 'Claim Verifier', 'Haiku', 'support + citation check'],
              ['4', 'Critic', 'Haiku', 'gaps + exact rewrites'],
              ['5', 'Humanizer', 'Sonnet', 'voice + critique fixes'],
              ['6', 'Evaluator', 'Haiku', 'five quality scores'],
              ['7', 'Audience Sim', 'Haiku', 'three reader reactions'],
              ['8', 'Final Polish', 'Sonnet', 'objection-aware final'],
            ].map(([number, name, model, job]) => (
              <div key={name} className="rounded-2xl border border-zinc-200 dark:border-zinc-700 p-4">
                <div className="flex items-center justify-between"><span className="text-xs font-black text-violet-600">AGENT {number}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${model === 'Sonnet' ? 'bg-violet-50 text-violet-600 dark:bg-violet-950/40' : 'bg-blue-50 text-blue-600 dark:bg-blue-950/40'}`}>{model}</span></div>
                <p className="mt-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">{name}</p><p className="mt-1 text-xs text-zinc-400">{job}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <Callout title="Quality gate"><p>Evaluator scores hook, specificity, citations, voice, and platform fit from 1–10. Any criterion below 7 creates targeted Writer instructions.</p></Callout>
          <Callout title="Bounded rewrite loop" tone="amber"><p>Writer → Verifier → Critic → Humanizer → Evaluator can repeat, but <code>MAX_LOOPS = 3</code> prevents runaway cost and latency.</p></Callout>
          <Callout title="Reader pressure test" tone="green"><p>Only after the quality loop does the system simulate a skeptical engineer, product lead, and executive skimmer, then apply one final polish.</p></Callout>
        </div>
      </GuideSection>

      <GuideSection id="voice-fingerprint" eyebrow="Voice system" title="Voice Fingerprinting is retrieval-time style control, not fine-tuning" description="The system derives a compact constitution from user-owned samples, stores it on the profile, and injects it only when content is generated.">
        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-stretch">
            <FlowNode icon="✍️" title="3–5 Posts" subtitle="150+ chars each · 50k total cap" tone="blue" /> <Arrow />
            <FlowNode icon="📏" title="Local Metrics" subtitle="sentence split + word distribution" tone="green" /> <Arrow />
            <FlowNode icon="🧠" title="Voice Analyst" subtitle="Sonnet + JSON Schema" /> <Arrow />
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
          <Callout title="Privacy boundary"><p>The API validates 3–5 bounded samples, sends them once to the user-selected provider, and persists only the structured fingerprint. Raw post text is not inserted into Signal’s database.</p></Callout>
          <Callout title="Safe fallback" tone="green"><p>Profiles without a fingerprint receive the existing platform-aware prompts unchanged. A failed profile lookup does not block content generation.</p></Callout>
        </div>
      </GuideSection>

      <GuideSection id="streaming" eyebrow="Runtime protocol" title="How generation reaches the browser" description="The UI does not wait behind a blank spinner. Each agent emits a structured SSE event that updates its row and exposes intermediate output for inspection.">
        <div className="grid gap-4 md:grid-cols-5">
          <FlowNode icon="▶" title="agent_start" subtitle="mark one agent running" tone="blue" />
          <FlowNode icon="✓" title="agent_complete" subtitle="status + inspectable output" tone="green" />
          <FlowNode icon="↻" title="loop_start" subtitle="reset quality-loop agents" tone="amber" />
          <FlowNode icon="◆" title="complete" subtitle="deliver editable final" />
          <FlowNode icon="!" title="error" subtitle="mark failure + allow retry" tone="amber" />
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Callout title="Persisted after success"><p><code>generation_jobs</code> stores user, brief, format, status, and completion time. <code>generation_artifacts</code> stores orchestrator brief, draft, critique, final, verifier report, audience feedback, and evaluator scores.</p></Callout>
          <Callout title="Publishing boundary" tone="green"><p>The final modal formats text for copying. It never sends content to LinkedIn, Substack, X, YouTube, or any external publishing API.</p></Callout>
        </div>
      </GuideSection>

      <GuideSection id="platform-rules" eyebrow="Output contracts" title="Platform rules are data, not scattered prompt prose" description="A shared platform specification drives both UI previews and server-side agents. Citation behavior is specialized separately per destination.">
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
      </GuideSection>

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

      <GuideSection id="data" eyebrow="Persistence" title="Core data relationships" description="Global article enrichment is reused. Personal ranking, feedback, ideas, and digests remain user-scoped.">
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
          <div className="min-w-[760px] grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-3 text-center">
            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/40 p-4"><strong className="text-sm text-blue-700 dark:text-blue-300">user_profiles</strong><p className="mt-1 text-[11px] text-zinc-500">preferences · plan · voice fingerprint</p></div><span>→</span>
            <div className="rounded-xl bg-violet-50 dark:bg-violet-950/40 p-4"><strong className="text-sm text-violet-700 dark:text-violet-300">user_sources</strong><p className="mt-1 text-[11px] text-zinc-500">URL · RSS · tier</p></div><span>→</span>
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 p-4"><strong className="text-sm text-amber-700 dark:text-amber-300">articles</strong><p className="mt-1 text-[11px] text-zinc-500">enrichment · image · vector</p></div>
          </div>
          <div className="my-3 text-center text-zinc-300 dark:text-zinc-700">↓</div>
          <div className="grid gap-3 md:grid-cols-4 text-center">
            {['user_feed_items', 'article_reactions', 'daily_ideas', 'daily_digests', 'weekly_digests', 'content_outlines', 'generation_jobs', 'generation_artifacts'].map(name => <div key={name} className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-3 text-xs font-bold text-zinc-700 dark:text-zinc-300">{name}</div>)}
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Callout title="Shared versus private"><p><code>articles</code> is shared global enrichment. <code>user_sources</code>, <code>user_feed_items</code>, digests, voice fingerprints, and generation artifacts are user-scoped.</p></Callout>
          <Callout title="Why this matters for trust" tone="green"><p>The product should always be able to explain whether a result came from shared article knowledge or a user-specific personalization layer.</p></Callout>
        </div>
      </GuideSection>

      <GuideSection id="api" eyebrow="Interfaces" title="API boundary map" description="Browser-facing routes isolate credentials and normalize access to Supabase, GitHub, per-user model providers, and external feeds.">
        <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="grid grid-cols-[1.2fr_.55fr_2fr] gap-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-zinc-400"><span>Route</span><span>Method</span><span>Responsibility</span></div>
          {apiRows.map(([route, method, job]) => <div key={route} className="grid grid-cols-[1.2fr_.55fr_2fr] gap-4 border-b last:border-0 border-zinc-100 dark:border-zinc-800/70 px-4 py-3 text-xs"><code className="text-violet-600 dark:text-violet-400">{route}</code><span className="font-bold text-zinc-600 dark:text-zinc-300">{method}</span><span className="text-zinc-500 dark:text-zinc-400">{job}</span></div>)}
        </div>
      </GuideSection>

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

      <GuideSection id="deploy" eyebrow="Runbook" title="Deployment checklist" description="Apply database changes before deploying code that selects or writes the new fields.">
        <div className="grid gap-4 md:grid-cols-2">
          <Callout title="Supabase"><ol className="list-decimal space-y-1.5 pl-4"><li>Apply migrations in numeric order.</li><li>Confirm pgvector and UUID extensions.</li><li>Set service-role credentials only on trusted runtimes.</li><li>Inspect <code>crawl_runs</code> after a smoke run.</li></ol></Callout>
          <Callout title="GitHub + Vercel" tone="green"><ol className="list-decimal space-y-1.5 pl-4"><li>Set Supabase, Stripe, GitHub PAT, and server secrets in Vercel.</li><li>Set fallback model keys only if you want a non-user-specific default path.</li><li>Dispatch a 1-day / 1-entry smoke run.</li><li>Verify feed, digest cache, status polling, and paid account model settings.</li></ol></Callout>
        </div>
      </GuideSection>
    </div>
  )
}
