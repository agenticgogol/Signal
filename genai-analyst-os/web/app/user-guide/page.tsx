import Link from 'next/link'
import { Arrow, Callout, FeatureCard, FlowNode, GuideHero, GuideSection, ScreenshotFrame, StepCard } from '@/components/GuideUI'

const toc = [
  ['quick-start', 'Quick start'], ['feed', 'Your Feed'], ['news', 'AI News'],
  ['digest', 'Weekly Digest'], ['ideas', 'Idea Wizard'], ['content-workflow', 'Content Studio'],
  ['voice', 'My Voice'], ['create', 'Create walkthrough'], ['formats', 'Formats'], ['sources', 'Sources'], ['faq', 'FAQ'],
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
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Callout title="Today’s AI-Generated Ideas"><p>Five overnight ideas are grounded in your top-ranked feed. Each card explains the proposed hook, format, and why the angle is timely. Click <strong>Use This Outline</strong> to prefill the discovery wizard.</p></Callout>
          <Callout title="Discover New Topic" tone="green"><p>Use the wizard whenever you want to explore beyond the daily five. It combines your answers with up to 20 articles from the last three feed days.</p></Callout>
        </div>
        <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-stretch">
          <FlowNode icon="🎯" title="Focus Q&A" subtitle="focus · audience · angle · optional trend" /> <Arrow />
          <FlowNode icon="💡" title="Pick a Topic" subtitle="5 timely ideas or your own topic" tone="blue" /> <Arrow />
          <FlowNode icon="📋" title="Build Outline" subtitle="hook · angle · 4–6 editable sections" tone="amber" /> <Arrow />
          <FlowNode icon="🔒" title="Freeze" subtitle="save and open in Create" tone="green" />
        </div>
        <Callout title="Why freeze an outline?" tone="amber"><p>Freezing saves the version you deliberately reviewed. Create loads that exact hook, angle, audience, and section structure rather than silently regenerating it.</p></Callout>
        <Callout title="LLM cost controls"><p>Generating topic ideas and building an outline both require admin credentials. One successful login is retained for the current browser tab session.</p></Callout>
      </GuideSection>

      <GuideSection id="content-workflow" eyebrow="Content generation" title="The Content Studio: evidence in, reviewed content out" description="Create is not a single prompt. It assembles your evidence and point of view, applies platform rules, streams an eight-agent quality workflow, and hands the final text back for human editing.">
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
            <FlowNode icon="5" title="Review" subtitle="edit · regenerate · copy" tone="green" />
          </div>
        </div>
      </GuideSection>

      <GuideSection id="voice" eyebrow="Personalization" title="My Voice: turn your writing into a reusable style constitution" description="Generic tone labels cannot capture how you actually write. Voice Fingerprinting analyzes 3–5 successful posts, stores the recurring patterns, and applies them to every new draft.">
        <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
          <ScreenshotFrame src="/guides/voice.svg" alt="Signal Voice Fingerprinting setup page" number={5} caption="Paste complete posts that feel unmistakably yours. Re-analyzing replaces the previous fingerprint; the original samples are not stored by Signal." />
          <div className="space-y-4">
            <Callout title="What the Voice Analyst learns"><ul className="list-disc space-y-1.5 pl-4"><li>Sentence-length rhythm and range</li><li>Signature phrases and transitions</li><li>Direct versus qualified topic areas</li><li>Paragraph opening and closing habits</li><li>Words, clichés, and tones to avoid</li></ul></Callout>
            <Callout title="Where it is used" tone="green"><p>The fingerprint is injected into Writer, every Humanizer rewrite, and Final Polish. Platform rules and factual accuracy still take priority.</p></Callout>
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <StepCard number={1} title="Choose representative work" action="My Voice → paste 3–5 complete posts" result="Use pieces with your real rhythm, opinions, and transitions—not content written by someone else." />
          <StepCard number={2} title="Analyze" action="Analyze My Voice and pass the admin wall" result="Claude identifies high-level style while Signal computes sentence metrics directly from the text." />
          <StepCard number={3} title="Generate normally" action="Open Create and look for Your voice active" result="The style constitution automatically follows the brief into all drafting and polishing loops." />
        </div>
        <Callout title="What it does not do" tone="amber"><p>Voice Fingerprinting is not model training or fine-tuning, and it does not memorize your posts. It is a structured set of writing constraints injected at generation time.</p></Callout>
      </GuideSection>

      <GuideSection id="create" eyebrow="Click-by-click" title="Create: your POV is the differentiating ingredient" description="The POV field is currently optional, but Signal should not invent your conviction. The strongest results combine selected evidence with a specific author perspective.">
        <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
          <ScreenshotFrame src="/guides/create.png" alt="Signal Create workspace" number={6} caption="A good POV bullet is specific: what you believe, what changed your mind, and what the reader should do differently." />
          <Callout title="A strong POV recipe" tone="green"><ol className="list-decimal space-y-2 pl-4"><li>Name the claim you agree or disagree with.</li><li>Add direct experience, a tradeoff, or a counterexample.</li><li>State the practical recommendation.</li><li>Check every factual claim against the pinned sources.</li></ol></Callout>
        </div>
        <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-5">
          <StepCard number={1} title="Select evidence" action="From Outline, From Today’s Feed, or Custom Brief" result="The content brief is grounded in exactly the context you chose." />
          <StepCard number={2} title="Define the brief" action="Enter topic, key angle, author POV, and audience" result="The orchestrator receives both editorial direction and personal perspective." />
          <StepCard number={3} title="Choose platform" action="Select LinkedIn, Substack, Thread, Blog, YouTube Long, or Short" result="Length, structure, voice, citations, and anti-patterns change automatically." />
          <StepCard number={4} title="Watch generation" action="Generate Content, then expand any completed agent output" result="Progress streams live; failed quality criteria may trigger up to three rewrite loops." />
          <StepCard number={5} title="Own the result" action="Edit, Regenerate, Copy, or Export for Publishing" result="You remain responsible for factual review and the final external posting action." />
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <FeatureCard icon="🎯" title="Orchestrator">Turns topic, POV, audience, outline, evidence, and platform rules into a structured claim plan.</FeatureCard>
          <FeatureCard icon="✍️" title="Writer">Produces the first platform-native draft with the required citation style.</FeatureCard>
          <FeatureCard icon="🔬" title="Verifier + Critic">Flags unsupported, overstated, uncited, or hallucinated claims and identifies weak writing.</FeatureCard>
          <FeatureCard icon="✨" title="Humanizer">Applies critique, removes common AI writing tells, strengthens specifics, and preserves citations.</FeatureCard>
          <FeatureCard icon="📊" title="Evaluator">Scores hook, specificity, citations, voice, and platform fit. Any criterion below 7 can start another loop.</FeatureCard>
          <FeatureCard icon="👥" title="Audience Simulation">Tests the piece against a skeptical engineer, a product lead, and an executive skimmer.</FeatureCard>
          <FeatureCard icon="💎" title="Final Polish">Addresses reader objections without adding unnecessary sections or dropping source references.</FeatureCard>
          <FeatureCard icon="💾" title="Saved Job">Persists the brief, intermediate outputs, final draft, verification report, audience feedback, and scores.</FeatureCard>
        </div>
        <Callout title="“Export for Publishing” keeps you in control" tone="amber"><p>Signal deliberately stops at a formatted copy action. LinkedIn removes markdown, Substack prepares HTML-friendly text, and Threads are numbered. You still paste, review, and publish in the destination platform.</p></Callout>
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

      <GuideSection id="sources" eyebrow="Coverage" title="Sources: design your information diet" description="Add a homepage or feed URL. Signal resolves RSS where possible and groups sources by quality tier for ranking.">
        <ScreenshotFrame src="/guides/sources.png" alt="Signal Sources page grouped by quality tier" number={7} caption="Paste a publication homepage or RSS URL. The green RSS badge confirms a feed is ready for the next pipeline run." />
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
          <Callout title="Does Signal publish automatically?">No. Publishing is intentionally outside the autonomous pipeline. POV is optional in the current form, but strongly recommended before generating a draft.</Callout>
          <Callout title="Why can content generation take longer?">It is an eight-agent workflow, not one completion. Verification and evaluation can trigger up to three Writer → Verifier → Critic → Humanizer → Evaluator loops before audience simulation and final polish.</Callout>
          <Callout title="Are my pasted voice samples stored?">No. Signal sends them for one analysis request and stores only the extracted fingerprint on your profile. Re-analyzing replaces that fingerprint.</Callout>
        </div>
      </GuideSection>

      <div className="mt-14 rounded-3xl bg-zinc-950 p-7 text-white">
        <p className="text-xs font-bold uppercase tracking-widest text-violet-400">Ready</p><h2 className="mt-2 text-2xl font-black">Build today&apos;s intelligence brief</h2>
        <div className="mt-5 flex flex-wrap gap-3"><Link href="/feed" className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold hover:bg-violet-500">Open Feed →</Link><Link href="/sources" className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-bold hover:bg-zinc-900">Manage Sources</Link></div>
      </div>
    </div>
  )
}
