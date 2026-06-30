import Link from 'next/link'
import { Callout, FeatureCard, GuideHero, GuideSection, ScreenshotFrame, StepCard } from '@/components/GuideUI'

const toc = [
  ['quick-start', 'Quick start'], ['feed', 'Your Feed'], ['news', 'AI News'],
  ['digest', 'Weekly Digest'], ['ideas', 'Ideas'], ['create', 'Create'], ['sources', 'Sources'], ['faq', 'FAQ'],
]

export default function UserGuidePage() {
  return (
    <div className="mx-auto max-w-6xl p-6 md:p-8 pb-24">
      <GuideHero eyebrow="Signal Handbook" title="From AI noise to a publishable point of view"
        description="Signal monitors the sources you trust, enriches and ranks every useful article, connects it with worldwide AI coverage, and turns the strongest signals into content ideas and drafts. This guide shows exactly where to click and what each feature gives you."
        chips={['10-minute setup', 'Daily intelligence', 'Personal ranking', 'Human-controlled publishing']} />

      <nav className="mt-6 flex flex-wrap gap-2">
        {toc.map(([id, label]) => <a key={id} href={`#${id}`} className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:border-violet-300 hover:text-violet-600">{label}</a>)}
      </nav>

      <GuideSection id="quick-start" eyebrow="Start here" title="Your first useful morning in four clicks" description="Set the source universe once. After that, Signal does the repetitive collection and synthesis work for you.">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <StepCard number={1} title="Choose sources" action="Sources → Add" result="Signal detects and stores the publication's RSS feed." />
          <StepCard number={2} title="Build the feed" action="Feed → ⚡ Get Latest Feed" result="Articles are collected, summarized, tagged, scored, and ranked." />
          <StepCard number={3} title="Find the signal" action="AI News or Weekly Digest" result="See worldwide context or a connected weekly narrative." />
          <StepCard number={4} title="Create your angle" action="📌 article → Ideas → Create" result="Turn evidence plus your POV bullets into a draft you control." />
        </div>
      </GuideSection>

      <GuideSection id="feed" eyebrow="Daily workspace" title="Your Feed: ranked intelligence, not an inbox" description="The feed combines freshness, source quality, topic preference, and article depth. It is the best place to decide what deserves your attention.">
        <ScreenshotFrame src="/guides/feed.png" alt="Signal feed showing ranked article cards and filters" number={1} caption="Use date, topic, source, and sort controls to narrow the feed. Open takeaways for detail; pin only the evidence you want to use later." />
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <FeatureCard icon="⚡" title="Get Latest Feed" value="Runs the complete pipeline">Use the gear to choose 1–14 days and 1–10 entries per source. The progress banner reports elapsed time and refreshes automatically.</FeatureCard>
          <FeatureCard icon="⭐" title="Priority labels" value="Must Read → Explore">Scores help triage. They are comparative signals—not objective truth—so use topic filters and reactions to shape future ranking.</FeatureCard>
          <FeatureCard icon="📌" title="Pin for Create" value="Evidence handoff">Pin strong articles, then open Create. Likes teach preferences; pins select evidence for a specific piece.</FeatureCard>
        </div>
      </GuideSection>

      <GuideSection id="news" eyebrow="External radar" title="AI News Worldover: immediate situational awareness" description="This view fetches current RSS headlines directly from six curated publications. It appears quickly because it does not wait for the enrichment pipeline or an LLM.">
        <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
          <ScreenshotFrame src="/guides/ai-news.png" alt="Signal AI News Worldover view" number={2} caption="Filter by publisher, scan current framing, and open the original article for primary context." />
          <div className="space-y-4">
            <Callout title="Best for">Breaking announcements, research releases, market movement, and checking whether your private source list has a blind spot.</Callout>
            <Callout title="What it is not" tone="amber">These are live headline and snippet signals. They are not personalized or deeply enriched until the articles enter your feed pipeline.</Callout>
          </div>
        </div>
      </GuideSection>

      <GuideSection id="digest" eyebrow="Synthesis" title="Weekly Digest: the connected story behind the links" description="Claude Sonnet reads your strongest deduplicated articles alongside worldwide coverage, then identifies the central theme, tensions, three developments to watch, and a practitioner action.">
        <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
          <ScreenshotFrame src="/guides/weekly-digest.png" alt="Signal Weekly Digest article view" number={3} caption="Narrative connects the stories; List exposes the underlying enriched evidence. Later narrative visits use the weekly cache; Regenerate explicitly refreshes it." />
          <div className="space-y-4">
            <Callout title="Narrative vs List"><strong>Narrative</strong> explains the pattern across stories. <strong>List</strong> is the auditable article-by-article view with takeaways and source links.</Callout>
            <Callout title="When to regenerate" tone="green">After a meaningful feed refresh or when you want the latest worldwide context. Otherwise, keep the cached version for speed and consistency.</Callout>
          </div>
        </div>
      </GuideSection>

      <GuideSection id="ideas" eyebrow="Editorial strategy" title="Ideas: five evidence-backed ways to contribute" description="Signal uses the strongest articles and your style to propose formats, hooks, source evidence, and a rationale—without pretending the idea is your final point of view.">
        <ScreenshotFrame src="/guides/ideas.png" alt="Signal Ideas page with content angle cards" number={4} caption="Choose an angle for its argument and evidence fit. The format can be refined later in Create." />
      </GuideSection>

      <GuideSection id="create" eyebrow="Human in the loop" title="Create: your POV is the required ingredient" description="Signal will not publish or invent your conviction. Add concrete POV bullets, choose an output format, generate the draft, and edit before using it anywhere.">
        <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
          <ScreenshotFrame src="/guides/create.png" alt="Signal Create workspace" number={5} caption="A good POV bullet is specific: what you believe, what changed your mind, and what the reader should do differently." />
          <Callout title="A strong POV recipe" tone="green"><ol className="list-decimal space-y-2 pl-4"><li>Name the claim you agree or disagree with.</li><li>Add direct experience, a tradeoff, or a counterexample.</li><li>State the practical recommendation.</li><li>Check every factual claim against the pinned sources.</li></ol></Callout>
        </div>
      </GuideSection>

      <GuideSection id="sources" eyebrow="Coverage" title="Sources: design your information diet" description="Add a homepage or feed URL. Signal resolves RSS where possible and groups sources by quality tier for ranking.">
        <ScreenshotFrame src="/guides/sources.png" alt="Signal Sources page grouped by quality tier" number={6} caption="Paste a publication homepage or RSS URL. The green RSS badge confirms a feed is ready for the next pipeline run." />
        <div className="grid gap-5 md:grid-cols-3">
          <FeatureCard icon="🟣" title="Tier 1" value="Highest trust">Primary labs, major research publications, and consistently authoritative sources.</FeatureCard>
          <FeatureCard icon="🔵" title="Tier 2" value="Practitioner signal">Builders, technical publications, and strong industry analysis.</FeatureCard>
          <FeatureCard icon="⚪" title="Tier 3" value="Breadth and discovery">Aggregators and community sources that expand coverage but carry less ranking weight.</FeatureCard>
        </div>
      </GuideSection>

      <GuideSection id="faq" eyebrow="Troubleshooting" title="Common questions" description="Fast answers for the behavior users notice most often.">
        <div className="grid gap-4 md:grid-cols-2">
          <Callout title="Why did a larger lookback add nothing?">A lookback widens eligibility; it cannot create new source entries. Check RSS status, increase max per source, and confirm the publication actually posted in that period.</Callout>
          <Callout title="Why is AI News faster than Weekly Digest?">AI News is parallel RSS retrieval. Weekly Digest is a personalized synthesis call. Once generated, its weekly cache makes subsequent loads fast.</Callout>
          <Callout title="Why do some cards use color banners?">Not every RSS feed supplies artwork. Signal uses the feed image when available and a stable topic gradient otherwise.</Callout>
          <Callout title="Does Signal publish automatically?">No. Publishing is intentionally outside the autonomous pipeline. Draft generation also requires your explicit POV input.</Callout>
        </div>
      </GuideSection>

      <div className="mt-14 rounded-3xl bg-zinc-950 p-7 text-white">
        <p className="text-xs font-bold uppercase tracking-widest text-violet-400">Ready</p><h2 className="mt-2 text-2xl font-black">Build today&apos;s intelligence brief</h2>
        <div className="mt-5 flex flex-wrap gap-3"><Link href="/feed" className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold hover:bg-violet-500">Open Feed →</Link><Link href="/sources" className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-bold hover:bg-zinc-900">Manage Sources</Link></div>
      </div>
    </div>
  )
}
