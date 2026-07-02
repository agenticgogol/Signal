import Link from 'next/link'
import { Arrow, Callout, FeatureCard, FlowNode, GuideHero, GuideSection, QuickNav, ScreenshotFrame, StepCard } from '@/components/GuideUI'

export default function UserGuidePage() {
  return (
    <div className="mx-auto max-w-6xl p-6 md:p-8 pb-24">
      <GuideHero eyebrow="Signal.ai Handbook" title="15 minutes a day: read what matters, publish what you think"
        description="Today is where you land and where most days end — one page blending your Feed, Your Library, and News into a ranked reading queue, plus a publishing panel that drafts from what you engaged with most. Everything else — Feed, AI Tutor, Ask Signal, Create — is one click deeper for whoever has time to go further."
        chips={['15-minute daily loop', 'Personalized ranking', 'AI Tutor for any term', 'Human-controlled publishing', 'Bring your own model']} />

      <div className="mt-6">
        <QuickNav groups={[
          {
            label: 'Start here', items: [
              { id: 'quick-start', label: 'Quick start', icon: '🚀' },
              { id: 'today', label: 'Today', icon: '👋' },
            ],
          },
          {
            label: 'Read & learn', items: [
              { id: 'feed', label: 'Your Feed', icon: '📰' },
              { id: 'news', label: 'AI News', icon: '🌐' },
              { id: 'knowledge', label: 'Your Library', icon: '📚' },
              { id: 'tutor', label: 'AI Tutor', icon: '🎓' },
              { id: 'ask-signal', label: 'Ask Signal & Memory', icon: '💬' },
            ],
          },
          {
            label: 'Create & publish', items: [
              { id: 'ideas', label: 'Ideas', icon: '💡' },
              { id: 'content-workflow', label: 'Content Studio', icon: '✍️' },
              { id: 'formats', label: 'Formats', icon: '📐' },
              { id: 'voice', label: 'My Voice', icon: '🎙️' },
              { id: 'publishing', label: 'Publishing', icon: '📤' },
            ],
          },
          {
            label: 'Configure', items: [
              { id: 'settings', label: 'Profile Settings', icon: '⚙️' },
              { id: 'digest', label: 'Daily/Weekly Digest', icon: '🌅' },
              { id: 'sources', label: 'Source Feeds', icon: '📡' },
              { id: 'faq', label: 'FAQ', icon: '❓' },
            ],
          },
        ]} />
      </div>

      <GuideSection id="quick-start" eyebrow="Start here" title="Your first useful day, guided" description="Sign-up walks you through the whole setup — sources, model, schedules, ranking, publishing — but every step is skippable. Here's the fast path if you want to jump straight in.">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <StepCard number={1} title="Sign in" action="Guided setup: sources → model → schedules → ranking → publishing" result="Every step is skippable and redoable later in Profile Settings — nothing here is a one-time decision." />
          <StepCard number={2} title="Land on Today" action="Read what's queued, in ~15 minutes" result="One blended, ranked reading list from Feed + Your Library + News — no tab-hopping to triage yourself." />
          <StepCard number={3} title="Check Publishing" action="Approve, skip, or generate on demand" result="A draft may already be waiting from what you engaged with most, or click Generate for something new." />
          <StepCard number={4} title="Go deeper if you have time" action="Feed, AI Tutor, Ideas, Create — all one click from Today" result="Today is the 15-minute loop; everything else is optional depth." />
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Callout title="What you pay for"><p>Signal subscription pays for the intelligence workflow, product layer, and personalized orchestration. Premium generation runs on the provider and API key you configure in Settings.</p></Callout>
          <Callout title="What is free vs paid" tone="green"><p>Reading, browsing, and setup can be previewed — even signed out, Today shows a populated sample view. Costly actions like feed refresh, Generate, Ask Signal, AI Tutor, and Create require both an active subscription and a configured model API key.</p></Callout>
        </div>
      </GuideSection>

      <GuideSection id="today" eyebrow="Your landing page" title="Today: two jobs, one page" description="Read what matters, review what's ready to publish — that's the whole page. Everything is designed to fit without endless scrolling, and to collapse out of the way once you're done with it.">
        <div className="grid gap-4 md:grid-cols-2">
          <FeatureCard icon="📋" title="Your Daily Reading" value="Ranked, time-boxed">Blended from Feed, Your Library, and News, sized to your daily minute target (10/15/20/30m). Click the ⓘ next to the heading for exactly how items are shortlisted and ranked.</FeatureCard>
          <FeatureCard icon="🗣️" title="Your Daily Publishing" value="Auto-drafted or on demand">A draft may already be waiting from what you engaged with most. Click "Generate today's content" any time for more — pick platforms and how many distinct ideas.</FeatureCard>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <FeatureCard icon="↩️" title="Undo, always">Marked something read or skipped by mistake? Every item in "Done today" has an Undo — nothing is a dead end.</FeatureCard>
          <FeatureCard icon="🔥" title="Streaks">Reading and publishing streaks track your consistency week over week, shown as a compact bar right under the page title.</FeatureCard>
          <FeatureCard icon="🔄" title="Reset view">Collapses every expanded/filtered bit of view state back to default and pulls fresh data — a quick "start over looking at what's there," separate from regenerating the queue itself.</FeatureCard>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Callout title="Show more / Done today, on both sides"><p>Reading caps to 3 visible items with "Show N more"; completed ones collapse into "Done today." Publishing caps to 3 idea-groups with "See N more ideas"; approved/dismissed drafts collapse into "Done for today." Keeps the page from becoming a wall of cards.</p></Callout>
          <Callout title="Ask Signal, right there" tone="green"><p>A compact Ask Signal panel sits below the two jobs — no navigating away. Click "💬 Ask about this" on any reading item or draft to jump straight to a pre-filled question about it.</p></Callout>
        </div>
        <Callout title="N ideas × N platforms" tone="amber"><p>The platform-picker popup (opened by "Generate today's content") lets you choose how many distinct ideas (1–3) and which platforms. The first platform for each idea gets the full evidence-grounded pipeline; extra platforms are cheap adapted variants of that same draft — genuine topic diversity, not just format fan-out.</p></Callout>
      </GuideSection>

      <GuideSection id="feed" eyebrow="Daily workspace" title="Your Feed: ranked intelligence, not an inbox" description="The feed combines freshness, source quality, topic preference, and article depth. It is the best place to decide what deserves your attention when you have more than 15 minutes.">
        <ScreenshotFrame src="/guides/feed.png" alt="Signal feed showing ranked article cards and filters" number={1} caption="Use date, topic, source, and sort controls to narrow the feed. Open takeaways for detail; pin only the evidence you want to use later." />
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <FeatureCard icon="⚡" title="Get Latest Feed" value="Runs the complete pipeline">Clicking it opens one panel with everything relevant: choose 1–14 days and 1–10 entries per source, then confirm. The progress banner reports elapsed time and refreshes automatically.</FeatureCard>
          <FeatureCard icon="⭐" title="Priority labels" value="Must Read → Explore">Scores help triage. They are comparative signals—not objective truth—so use topic filters and reactions to shape future ranking.</FeatureCard>
          <FeatureCard icon="📌" title="Pin for Create" value="Evidence handoff">Pin strong articles, then open Create. Likes teach preferences; pins select evidence for a specific piece.</FeatureCard>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Callout title="Why did this article surface?" tone="green"><p>Use the card-level Signal Notes and article context to understand recency, article depth, and why the item was ranked for you. The feed is intended to be explainable, not mysterious.</p></Callout>
          <Callout title="Underlined terms are clickable" tone="amber"><p>Technical terms inside "Why this matters" and takeaways are underlined — click one to open the AI Tutor slide-over without losing your place in the article.</p></Callout>
        </div>
        <Callout title="Automate the refresh">Pro accounts can schedule a daily auto-refresh from <strong>Settings → Feed Schedule</strong> instead of clicking Get Latest Feed every day. The Feed header shows whether a schedule is active and links straight to Settings to change it.</Callout>
      </GuideSection>

      <GuideSection id="news" eyebrow="External radar" title="AI News: immediate situational awareness, now feeding into Today" description="This view fetches current RSS headlines directly from six curated publications. Multi-source stories (the same story covered by 2+ outlets) are also persisted and compete for a slot in Today's reading queue, ranked by independent-source coverage.">
        <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
          <ScreenshotFrame src="/guides/ai-news.png" alt="Signal AI News view" number={2} caption="Filter by publisher, scan current framing, and open the original article for primary context." />
          <div className="space-y-4">
            <Callout title="Best for">Breaking announcements, research releases, market movement, and checking whether your private source list has a blind spot.</Callout>
            <Callout title="Feeds Today directly" tone="green"><p>Visiting News persists clustered stories, which then become eligible for Today's reading queue and the "Generate today's content" topic picker — visit News occasionally so that pool stays fresh.</p></Callout>
          </div>
        </div>
      </GuideSection>

      <GuideSection id="knowledge" eyebrow="Personal library" title="Your Library: your permanent collection, kept for good" description="Save URLs, YouTube videos, or notes into notebooks. Signal extracts a summary, a why-it-matters note, topic tags, and clickable concept terms for each item — and ranks your library the same way it ranks the feed. Today only shows a slice of it; this is where everything lives permanently.">
        <div className="grid gap-4 md:grid-cols-3">
          <FeatureCard icon="📖" title="Notebooks" value="Organize by project">Group saved links, videos, and notes into notebooks — one per project, client, or research thread.</FeatureCard>
          <FeatureCard icon="🔗" title="Backed by your library" value="Feed ↔ Your Library">Feed articles that are genuinely related to something in your library show a "Backed by your library" badge with a match score, so public news and your own saved thinking connect automatically.</FeatureCard>
          <FeatureCard icon="🎓" title="Clickable terms" value="Same as Feed">Technical terms in a saved item's "Why this matters" are underlined and clickable — opens the AI Tutor grounded in that item.</FeatureCard>
        </div>
        <Callout title="How matching stays precise" tone="green"><p>Matches require real textual overlap between an article and a saved item, not just a shared topic tag — there are only 7 tags in the taxonomy, so a tag alone isn&apos;t enough signal. This keeps the badge meaningful instead of attaching the same popular note to everything in a tag bucket.</p></Callout>
      </GuideSection>

      <GuideSection id="tutor" eyebrow="New" title="AI Tutor: understand any term, right where you read it" description="Click an underlined term in Feed or Your Library, or go to the standalone AI Tutor Hub and ask about anything — a structured explanation grounded in your own saved content when it's relevant, general knowledge otherwise.">
        <div className="grid gap-4 md:grid-cols-2">
          <FeatureCard icon="👆" title="Inline, in the flow" value="Click a term, get a slide-over">The article stays visible and scrollable behind the panel — you never lose your reading place to look something up.</FeatureCard>
          <FeatureCard icon="🎓" title="AI Tutor Hub" value="Ask about anything">A dedicated page (sidebar → AI Tutor) for looking up any concept directly, not tied to something you're currently reading. Keeps a history of recent lookups.</FeatureCard>
        </div>
        <div className="mt-5">
          <p className="mb-3 text-sm font-bold text-zinc-700 dark:text-zinc-300">Every explanation covers:</p>
          <div className="grid gap-4 md:grid-cols-4">
            <FlowNode icon="📖" title="What it is" subtitle="clear 1-2 sentence definition" tone="blue" />
            <FlowNode icon="⭐" title="Why it matters" subtitle="practical significance" tone="amber" />
            <FlowNode icon="⚙️" title="How it works" subtitle="the technical mechanics" tone="green" />
            <FlowNode icon="💻" title="Code + use cases" subtitle="when the concept is code-expressible" />
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Callout title="Grounded in your own content" tone="green"><p>Every lookup also searches your Feed and Library — if something you've saved is genuinely relevant, it shows up as a "📚 Backed by your library" citation alongside the explanation.</p></Callout>
          <Callout title="Fast the second time" tone="amber"><p>The general explanation for a term is generated once and shared across everyone — the first person to ask "what is RAG" pays the generation cost; every lookup after that (yours or anyone else's) is near-instant.</p></Callout>
        </div>
      </GuideSection>

      <GuideSection id="ask-signal" eyebrow="Recall" title="Ask Signal & Memory Assistant: one recall engine, three entry points" description="Ask Signal now lives inline on Today, on the Feed tab, and as the standalone Memory Assistant page — all three share one engine, so a question asked in any of them shows up in all of them.">
        <div className="grid gap-5 lg:grid-cols-3">
          <Callout title="Today — inline, no navigation"><p>Scroll down on Today and it's right there. Click "💬 Ask about this" on any reading item or draft to jump straight to a pre-filled question about it.</p></Callout>
          <Callout title="Feed — quick recall in the flow" tone="green"><p>Search your feed and reading list together without leaving the Feed tab. Good for "what was that thing I saw last week" moments mid-browse.</p></Callout>
          <Callout title="Memory Assistant — the deep-dive view" tone="amber"><p>The same engine with more room: suggested example questions, your full notebook list, and more history at once.</p></Callout>
        </div>
        <Callout title="Shared history">Recent questions and your reading history (articles you opened, pinned, or liked) are the same list everywhere — there is one implementation behind them, not three that happen to look similar.</Callout>
      </GuideSection>

      <GuideSection id="ideas" eyebrow="Editorial strategy" title="Ideas: five evidence-backed ways to contribute" description="Signal uses the strongest articles and your style to propose formats, hooks, source evidence, and a rationale—without pretending the idea is your final point of view.">
        <ScreenshotFrame src="/guides/ideas.png" alt="Signal Ideas page with content angle cards" number={3} caption="Choose an angle for its argument and evidence fit. The format can be refined later in Create." />
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Callout title="Today's AI-Generated Ideas"><p>Five overnight ideas are grounded in your top-ranked feed. Each card explains the proposed hook, format, and why the angle is timely. Click <strong>Use This Outline</strong> to prefill the discovery wizard.</p></Callout>
          <Callout title="Discover New Topic" tone="green"><p>Use the wizard whenever you want to explore beyond the daily five. It combines your answers with up to 20 articles from the last three feed days.</p></Callout>
        </div>
        <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-stretch">
          <FlowNode icon="🎯" title="Focus Q&A" subtitle="focus · audience · angle · optional trend" /> <Arrow />
          <FlowNode icon="💡" title="Pick a Topic" subtitle="5 timely ideas or your own topic" tone="blue" /> <Arrow />
          <FlowNode icon="📋" title="Build Outline" subtitle="hook · angle · 4–6 editable sections" tone="amber" /> <Arrow />
          <FlowNode icon="🔒" title="Freeze" subtitle="save and open in Create" tone="green" />
        </div>
        <Callout title="Why freeze an outline?" tone="amber">Freezing saves the version you deliberately reviewed. Create loads that exact hook, angle, audience, and section structure rather than silently regenerating it.</Callout>
      </GuideSection>

      <GuideSection id="content-workflow" eyebrow="Content generation" title="The Content Studio: evidence in, reviewed content out" description="Create is not a single prompt. It assembles your evidence and point of view, applies platform rules, streams an eight-agent quality workflow, and hands the final text back for human editing. Today's Generate button runs the same core pipeline, on demand, with a topic already picked for you.">
        <div className="grid gap-4 md:grid-cols-3">
          <FeatureCard icon="📋" title="From Outline" value="Planned route">Choose a frozen Idea Wizard outline. Topic, angle, suggested format, hook, and section plan are carried into the brief.</FeatureCard>
          <FeatureCard icon="📰" title="From Feed" value="Evidence-first route">Select one to three current articles. Items pinned with 📌 in Feed are preselected and passed to the agents as allowed sources.</FeatureCard>
          <FeatureCard icon="✏️" title="Custom Brief" value="Blank-canvas route">Start from your own topic and instructions without requiring a saved outline or feed selection.</FeatureCard>
        </div>
        <div className="mt-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <p className="mb-5 text-xs font-bold uppercase tracking-widest text-zinc-400">The five-stage workspace</p>
          <div className="flex flex-col gap-3 md:flex-row md:items-stretch">
            <FlowNode icon="1" title="Source" subtitle="outline, feed, or custom" /> <Arrow />
            <FlowNode icon="2" title="Brief" subtitle="topic · angle · POV · audience" tone="blue" /> <Arrow />
            <FlowNode icon="3" title="Platform" subtitle="choose one of 6 formats" tone="amber" /> <Arrow />
            <FlowNode icon="4" title="Generate" subtitle="watch 8 agents live" /> <Arrow />
            <FlowNode icon="5" title="Review" subtitle="edit · regenerate · copy or publish" tone="green" />
          </div>
        </div>
        <Callout title="Two ways to reach the same pipeline" tone="amber"><p>Create gives you full control over source, brief, and platform. Today's "Generate today's content" runs the identical evidence-grounded loop, but picks the topic for you (a weighted blend of your engagement, reading behavior, and trending news) and can fan out across several ideas and platforms in one click.</p></Callout>
      </GuideSection>

      <GuideSection id="formats" eyebrow="Platform intelligence" title="One argument, six native formats" description="The platform choice changes the drafting contract—not just the label on the output.">
        <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          {[
            ['💼', 'LinkedIn', '200–280 words / 1,300 chars', 'Hook-first short paragraphs, soft CTA, 2–3 hashtags', 'Inline domain attribution + source list'],
            ['📧', 'Substack', '700–1,000 words', 'Personal opening, problem framing, three insight sections', 'Inline markdown links + Sources section'],
            ['🧵', 'X / Twitter Thread', '8–12 posts', 'One insight per numbered post with mini-cliffhangers', 'Domain markers + final source post'],
            ['📝', 'Blog Post', '1,500–2,000 words', 'TL;DR, 4–6 H2 sections, actionable close', 'Inline links + Sources section'],
            ['🎥', 'YouTube Long', '8–12 minute script', 'Hook, chapters, B-roll cues, spoken rhythm', 'Editor source notes + description links'],
            ['⚡', 'YouTube Short', '60–90 second script', 'Three-second hook, fast insights, overlay cues', 'One primary source + overlay note'],
          ].map(([icon, format, length, shape, citation]) => (
            <div key={format} className="grid gap-2 border-b last:border-0 border-zinc-100 dark:border-zinc-800 p-4 md:grid-cols-[2rem_1fr_1fr_1.5fr_1.4fr] md:items-center">
              <span className="text-xl">{icon}</span><strong className="text-sm text-zinc-900 dark:text-zinc-100">{format}</strong><span className="text-xs text-violet-600 dark:text-violet-400">{length}</span><span className="text-xs text-zinc-500">{shape}</span><span className="text-xs text-zinc-400">{citation}</span>
            </div>
          ))}
        </div>
      </GuideSection>

      <GuideSection id="voice" eyebrow="Personalization" title="My Voice: turn your writing into a reusable style constitution" description="Generic tone labels cannot capture how you actually write. Voice Fingerprinting analyzes 3–5 successful posts, stores the recurring patterns, and applies them to every new draft.">
        <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
          <ScreenshotFrame src="/guides/voice.svg" alt="Signal Voice Fingerprinting setup page" number={4} caption="Paste complete posts that feel unmistakably yours. Re-analyzing replaces the previous fingerprint; the original samples are not stored by Signal." />
          <div className="space-y-4">
            <Callout title="What the Voice Analyst learns"><ul className="list-disc space-y-1.5 pl-4"><li>Sentence-length rhythm and range</li><li>Signature phrases and transitions</li><li>Direct versus qualified topic areas</li><li>Paragraph opening and closing habits</li><li>Words, clichés, and tones to avoid</li></ul></Callout>
            <Callout title="It also learns from your feedback" tone="green"><p>Feedback you type when regenerating a draft on Today is logged and periodically distilled into durable voice principles — the more you correct, the sharper future drafts get.</p></Callout>
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <StepCard number={1} title="Choose representative work" action="My Voice → paste 3–5 complete posts" result="Use pieces with your real rhythm, opinions, and transitions—not content written by someone else." />
          <StepCard number={2} title="Analyze" action="Analyze My Voice and confirm access" result="Your configured model identifies high-level style while Signal computes sentence metrics directly from the text." />
          <StepCard number={3} title="Generate normally" action="Open Create or Today's Generate and look for Your voice active" result="The style constitution automatically follows the brief into all drafting and polishing loops." />
        </div>
        <Callout title="What it does not do" tone="amber">Voice Fingerprinting is not model training or fine-tuning, and it does not memorize your posts. It is a structured set of writing constraints injected at generation time.</Callout>
      </GuideSection>

      <GuideSection id="publishing" eyebrow="New" title="Publishing: send an approved draft straight to the platform" description="Once a draft is Approved on Today, you can publish it directly instead of copy-pasting — same bring-your-own-credential approach as your model API key.">
        <div className="grid gap-4 md:grid-cols-3">
          <FeatureCard icon="📗" title="Medium" value="Self-service token">An integration token from your own Medium settings — no developer app or approval needed. Publishes as a Medium draft for you to review there.</FeatureCard>
          <FeatureCard icon="💼" title="LinkedIn / X" value="Developer app token">Requires an access token from a developer app you register yourself. Tokens are short-lived, so you'll reconnect periodically.</FeatureCard>
          <FeatureCard icon="📧" title="Email" value="No connection needed">Uses your configured digest email — good for sending a draft to yourself or a collaborator to post manually.</FeatureCard>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Callout title="Approval is the gate" tone="amber"><p>Nothing publishes automatically, ever. A draft only becomes eligible once you click Approve on Today — publishing is a separate, explicit action after that.</p></Callout>
          <Callout title="One draft, several destinations" tone="green"><p>A single approved draft can be published to Medium, LinkedIn, and emailed — each tracked independently, so you can see exactly where it went.</p></Callout>
        </div>
        <Callout title="Not every platform is supported, on purpose">Substack has no public posting API — export/copy only. YouTube isn't applicable here: Create writes a video script, not a rendered video file, so there's nothing to upload.</Callout>
      </GuideSection>

      <GuideSection id="settings" eyebrow="Account control" title="Profile Settings: everything configurable, in six tabs" description="Settings is organized into tabs matching what each one actually controls — no more scrolling through one long page to find the toggle you want.">
        <div className="grid gap-4 md:grid-cols-3">
          <FeatureCard icon="📡" title="Source Feeds" value="First tab">The URLs and RSS feeds Signal watches to build your Feed. Add or remove anything — same page also reachable standalone at /sources.</FeatureCard>
          <FeatureCard icon="🔑" title="Model Settings" value="Provider + API key">Choose Anthropic, OpenAI, Groq, or OpenRouter, and your model name and key. Powers every paid workflow: Generate, Ask Signal, AI Tutor, Create, digests.</FeatureCard>
          <FeatureCard icon="📰" title="Feed Schedule" value="Pro">Turn on daily auto-refresh and pick an hour in your local time. Same lookback/max-per-source settings whether the run is scheduled or manual.</FeatureCard>
          <FeatureCard icon="🗣️" title="Content Generation" value="Drafts Inbox">Toggle the once-a-day autonomous draft (separate from Today's on-demand Generate, which has no cap) and its default target platform.</FeatureCard>
          <FeatureCard icon="📊" title="Content Ranking Logic" value="Preferences + weights">Role, interests, reading goal and cadence, plus the five signal weights behind topic selection — engagement, recently read, trending news, recent trend, emerging topic.</FeatureCard>
          <FeatureCard icon="🔗" title="Publisher Platforms" value="Connections">Connect Medium, LinkedIn, and X for direct publishing from Today.</FeatureCard>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Callout title="An Others tab too"><p>Digest email delivery preferences and your account's recent AI activity log (every agent call, which model, how long it took) live under Others — ancillary but still one click away.</p></Callout>
          <Callout title="Trust boundary" tone="amber"><p>Your provider key and platform tokens are encrypted before storage. Signal uses them only for workflows tied to your account and never exposes them in the browser.</p></Callout>
        </div>
      </GuideSection>

      <GuideSection id="digest" eyebrow="Synthesis" title="Daily and Weekly Digest: narrative synthesis, still available" description="Before Today existed, Digest was the daily habit — a synthesized narrative rather than a ranked reading list. It's still there for anyone who prefers a story-style brief over item-by-item reading.">
        <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
          <ScreenshotFrame src="/guides/weekly-digest.png" alt="Signal Digest view" number={5} caption="Today gives a headline, the day's connected story, standout highlights, and a why-this-matters takeaway. This Week connects the same kind of story across the last 7 days, with Narrative and List views." />
          <div className="space-y-4">
            <Callout title="Today"><p>The overnight pipeline condenses your strongest ranked articles into a single daily brief — a sharp editorial note, not a list of links. Enable digest delivery in Settings → Others and Signal emails it once per day.</p></Callout>
            <Callout title="This Week" tone="green"><p>Your configured model reads your strongest deduplicated articles alongside worldwide coverage, then identifies the central theme, tensions, three developments to watch, and a practitioner action.</p></Callout>
          </div>
        </div>
        <Callout title="Archive behavior" tone="amber">Recent daily briefs stay close at hand and move into archive views after 7 days. Weekly digests move into archive views after 8 weeks.</Callout>
      </GuideSection>

      <GuideSection id="sources" eyebrow="Coverage" title="Source Feeds: design your information diet" description="Add a homepage or feed URL. Signal resolves RSS where possible and groups sources by quality tier for ranking. Lives at both /sources and Settings → Source Feeds — same page, two doors.">
        <ScreenshotFrame src="/guides/sources.png" alt="Signal Sources page grouped by quality tier" number={6} caption="Paste a publication homepage or RSS URL. The green RSS badge confirms a feed is ready for the next pipeline run." />
        <div className="grid gap-5 md:grid-cols-3">
          <FeatureCard icon="🟣" title="Tier 1" value="Highest trust">Primary labs, major research publications, and consistently authoritative sources.</FeatureCard>
          <FeatureCard icon="🔵" title="Tier 2" value="Practitioner signal">Builders, technical publications, and strong industry analysis.</FeatureCard>
          <FeatureCard icon="⚪" title="Tier 3" value="Breadth and discovery">Aggregators and community sources that expand coverage but carry less ranking weight.</FeatureCard>
        </div>
      </GuideSection>

      <GuideSection id="faq" eyebrow="Troubleshooting" title="Common questions" description="Fast answers for the behavior users notice most often.">
        <div className="grid gap-4 md:grid-cols-2">
          <Callout title="Why does Today show content when I'm not signed in?">Signed-out visitors see a read-only sample — the admin/demo account's queue and drafts — instead of a blank page. Writes (mark read, refresh, generate) still need a session or admin credentials.</Callout>
          <Callout title="Why is a term not underlined even though it's technical?">Concept terms are extracted at crawl/save time. Articles or Library items saved before AI Tutor existed won't have terms until reprocessed; new content gets them automatically.</Callout>
          <Callout title="Why did a larger lookback add nothing?">A lookback widens eligibility; it cannot create new source entries. Check RSS status, increase max per source, and confirm the publication actually posted in that period.</Callout>
          <Callout title="Why is AI News faster than the Digest?">AI News is parallel RSS retrieval. Digest is a personalized synthesis call. Once generated, caching makes subsequent loads fast.</Callout>
          <Callout title="Does Signal publish automatically?">No. A draft only becomes eligible to publish after you explicitly click Approve on Today, and publishing itself is a separate action after that.</Callout>
          <Callout title="Why can content generation take longer?">It is an eight-agent workflow, not one completion. Verification and evaluation can trigger up to three Writer → Verifier → Critic → Humanizer → Evaluator loops before audience simulation and final polish.</Callout>
          <Callout title="What's the difference between Drafts Inbox and Today's Generate button?">Drafts Inbox is autonomous, once a day, capped. Today's "Generate today's content" is on-demand, unlimited, and lets you pick how many ideas and which platforms.</Callout>
          <Callout title="Are my pasted voice samples stored?">No. Signal sends them for one analysis request and stores only the extracted fingerprint on your profile. Re-analyzing replaces that fingerprint.</Callout>
        </div>
      </GuideSection>

      <div className="mt-14 rounded-3xl bg-zinc-950 p-7 text-white">
        <p className="text-xs font-bold uppercase tracking-widest text-violet-400">Ready</p><h2 className="mt-2 text-2xl font-black">Start your 15 minutes</h2>
        <div className="mt-5 flex flex-wrap gap-3"><Link href="/today" className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold hover:bg-violet-500">Open Today →</Link><Link href="/tutor" className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-bold hover:bg-zinc-900">Try AI Tutor</Link></div>
      </div>
    </div>
  )
}
