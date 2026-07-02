import Link from 'next/link'

const VALUE_PROPS = [
  {
    icon: '🕵️',
    title: 'We do the hard work. You get the 15 minutes.',
    body: 'Signal.ai scrapes the sources that matter for your career, compiles everything, ranks it by relevance to you, and hands you exactly what to read — not a raw firehose you have to triage yourself. No more juggling RSS readers, five open tabs, and a notes app just to stay current.',
    accent: 'from-violet-500 to-indigo-500',
  },
  {
    icon: '🧭',
    title: 'The more you read, the sharper it gets',
    body: 'Every open, like, pin, and skip teaches Signal.ai what actually matters to you — so the ranking, and eventually the content ideas it suggests, get more accurate the more you use it. This isn\'t a static feed; it\'s a system that learns your beat.',
    accent: 'from-blue-500 to-cyan-500',
  },
  {
    icon: '✍️',
    title: 'From "I read this" to "I published this" — same page',
    body: 'As you read, Signal.ai starts surfacing writing and content ideas from what you engaged with most, then drafts them — verified, critiqued, humanized to your voice — across every platform you publish to, in one click. Reading turns directly into your next post.',
    accent: 'from-emerald-500 to-teal-500',
  },
]

const HOW_IT_WORKS = [
  { step: '01', label: 'We scrape & compile', desc: 'Signal.ai continuously pulls from the AI sources that matter for your career — Feed, Your Library, and breaking News — so you never have to go source-hunting yourself.' },
  { step: '02', label: 'We rank by relevance', desc: 'Everything is scored against your interests and how you\'ve reacted before, then merged into one queue sized to the time you actually have — 15 minutes, by default.' },
  { step: '03', label: 'You read, we learn', desc: 'Open, skip, like, pin — every reaction sharpens what gets surfaced next. Undo anything; nothing is ever a dead end.' },
  { step: '04', label: 'We suggest what to write', desc: 'Based on what you engaged with most, Signal.ai proposes content ideas and drafts them — evidence-grounded, voice-matched, ready to review — across every platform, one click.' },
]

const CAPABILITIES = [
  { label: 'Minutes a day', value: '15' },
  { label: 'Content formats', value: '6' },
  { label: 'Agent pipeline stages', value: '8' },
  { label: 'Ideas per click', value: '1-3' },
  { label: 'Direct-publish platforms', value: '4+' },
  { label: 'Sources monitored', value: '50+' },
]

const PRICING = [
  {
    name: 'Free',
    tagline: 'Stay informed, on your own time',
    price: 'Free',
    features: [
      'Personalized Feed, Your Library, and AI News',
      'Daily Today queue, ranked and time-boxed',
      'Reading and publishing streaks',
      'Organize, tag, and archive what you read',
    ],
    cta: { label: 'Start free →', href: '/today' },
    highlight: false,
  },
  {
    name: 'Pro',
    tagline: 'Turn reading into published output',
    price: 'One plan, your own model key',
    features: [
      'Everything in Free, plus:',
      'Generate today\'s content — N ideas × N platforms, one click',
      'Ask Signal — LLM-powered recall across everything you\'ve read',
      'Full 8-agent Create studio for any topic or platform',
      'Daily/weekly narrative digests and idea generation',
      'Direct publishing to LinkedIn, X, Medium, and email',
      'Bring your own provider and API key — execution cost stays yours',
    ],
    cta: { label: 'Upgrade in Settings →', href: '/settings' },
    highlight: true,
  },
]

const FORMATS = [
  { icon: '💼', label: 'LinkedIn Post' },
  { icon: '📧', label: 'Substack' },
  { icon: '🧵', label: 'Thread' },
  { icon: '📝', label: 'Blog Post' },
  { icon: '🎥', label: 'YouTube Long' },
  { icon: '⚡', label: 'YouTube Short' },
]

const WHO_ITS_FOR = [
  'AI creators and writers who need a daily point of view',
  'Consultants and advisors tracking AI shifts for clients',
  'Founder-operators who want signal, not feed overload',
  'Internal AI teams that need a reusable intelligence workflow',
]

const PIPELINE_STAGES = [
  { icon: '📚', label: 'Your evidence', desc: 'Ranked reading + sources', kind: 'io' as const },
  { icon: '🎯', label: 'Orchestrator', desc: 'Builds the brief — angle, audience, structure', kind: 'agent' as const },
  { icon: '✍️', label: 'Writer', desc: 'Drafts the full piece in the target format', kind: 'agent' as const },
  { icon: '🔬', label: 'Verifier', desc: 'Checks claims, citations, source grounding', kind: 'agent' as const },
  { icon: '🔍', label: 'Critic', desc: 'Sharpens arguments, cuts weak lines', kind: 'agent' as const },
  { icon: '✨', label: 'Humanizer', desc: 'Applies your voice and style', kind: 'agent' as const },
  { icon: '📊', label: 'Evaluator', desc: 'Scores hook, specificity, voice, fit', kind: 'agent' as const },
  { icon: '👥', label: 'Audience Sim', desc: 'Stress-tests against skeptical readers', kind: 'agent' as const },
  { icon: '💎', label: 'Final Polish', desc: 'Resolves objections, finishes the piece', kind: 'agent' as const },
  { icon: '🚀', label: 'Publish-ready draft', desc: 'Yours to review, edit, and ship', kind: 'io' as const },
]

const WHY_PAY = [
  'It replaces scattered RSS readers, AI news tabs, and copy-paste prompting.',
  'It turns reading, ranking, synthesis, and drafting into one repeatable workflow.',
  'It explains why an article surfaced, what model was used, and what was cached versus freshly generated.',
  'It keeps model spend under your control with your own provider and API key.',
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white overflow-x-hidden">

      {/* Nav */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <span className="flex items-center gap-2.5">
            <span className="text-4xl leading-none">⚡</span>
            <span className="bg-gradient-to-r from-violet-400 via-blue-400 to-cyan-300 bg-clip-text text-transparent font-black text-3xl sm:text-4xl tracking-tight">
              Signal.ai
            </span>
          </span>
          <Link
            href="/today"
            className="px-5 py-2.5 text-sm font-bold bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors shadow-lg shadow-violet-900/30"
          >
            Open app →
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-40 pb-24 px-6 relative">
        {/* background glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-violet-600/10 rounded-full blur-3xl" />
        </div>

        <div className="max-w-4xl mx-auto text-center relative">
          <div className="mb-6 flex items-center justify-center gap-3">
            <span className="text-6xl sm:text-7xl leading-none">⚡</span>
            <span className="bg-gradient-to-r from-violet-400 via-blue-400 to-cyan-300 bg-clip-text text-transparent font-black text-6xl sm:text-7xl tracking-tight">
              Signal.ai
            </span>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-950/60 border border-violet-800/60 text-violet-300 text-xs font-medium mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            15 minutes a day for your career in AI
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.05] mb-6">
            <span className="bg-gradient-to-br from-white via-white to-zinc-400 bg-clip-text text-transparent">
              We do the hard work.
            </span>
            <br />
            <span className="bg-gradient-to-r from-violet-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
              You show up for 15 minutes.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed mb-10">
            We scrape the sources that matter for your career, compile everything, rank it by relevance to you,
            and show you exactly what to read. As you read — based on your interests and how you interact —
            we start suggesting your next piece of writing too. One page. Read, think, publish.
          </p>

          <div className="mb-10 flex flex-wrap items-center justify-center gap-2 text-xs font-semibold text-zinc-300">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">One daily reading + publishing queue</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">Reading &amp; publishing streaks</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">N ideas × N platforms, one click</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">Ask Signal — inline recall</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">Bring your own provider + key</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/today"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl text-base transition-all shadow-lg shadow-violet-900/40 hover:shadow-violet-900/60"
            >
              Start free — open Today →
            </Link>
            <a
              href="#pricing"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 bg-white/5 hover:bg-white/10 text-zinc-300 font-medium rounded-xl text-base transition-colors border border-white/10"
            >
              See pricing ↓
            </a>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-y border-white/5 bg-white/2">
        <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-6 gap-8">
          {CAPABILITIES.map(({ label, value }) => (
            <div key={label} className="text-center">
              <p className="text-3xl font-black bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">{value}</p>
              <p className="text-sm text-zinc-500 mt-1">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Value props */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
              Built for the practitioners who shape what GenAI becomes
            </h2>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
              Not a news aggregator. Not a generic writing tool. Signal.ai is the product layer between raw AI information and work you can actually act on or publish.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {VALUE_PROPS.map(({ icon, title, body, accent }) => (
              <div key={title} className="relative bg-zinc-900 rounded-2xl p-6 border border-white/5 hover:border-white/10 transition-colors group overflow-hidden">
                <div className={`absolute inset-0 bg-gradient-to-br ${accent} opacity-0 group-hover:opacity-5 transition-opacity`} />
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${accent} flex items-center justify-center text-xl mb-5`}>
                  {icon}
                </div>
                <h3 className="text-base font-bold text-white mb-3 leading-snug">{title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 px-6 bg-zinc-900/40">
        <div className="max-w-6xl mx-auto grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/5 bg-zinc-950 p-8">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-400">Why Signal.ai is worth paying for</p>
            <h2 className="mt-3 text-3xl font-black text-white">You are paying for workflow leverage, not just model access</h2>
            <div className="mt-6 space-y-3">
              {WHY_PAY.map(item => (
                <div key={item} className="flex gap-3 text-sm leading-6 text-zinc-300">
                  <span className="mt-1 text-violet-400">✓</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm text-zinc-500">Signal.ai subscription covers the product experience. Your own provider key covers premium model execution.</p>
          </div>
          <div className="rounded-3xl border border-white/5 bg-zinc-950 p-8">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-400">Who it is for</p>
            <h2 className="mt-3 text-3xl font-black text-white">Built for people who need an AI point of view every day</h2>
            <div className="mt-6 space-y-3">
              {WHO_ITS_FOR.map(item => (
                <div key={item} className="flex gap-3 text-sm leading-6 text-zinc-300">
                  <span className="mt-1 text-cyan-400">→</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-24 px-6 bg-zinc-900/40">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">How Signal.ai works</h2>
            <p className="text-zinc-400 text-lg">From raw signal to published content — four stages, fully automated.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-px bg-white/5 rounded-2xl overflow-hidden border border-white/5">
            {HOW_IT_WORKS.map(({ step, label, desc }) => (
              <div key={step} className="bg-zinc-950 p-8 relative group hover:bg-zinc-900/60 transition-colors">
                <span className="text-5xl font-black text-white/5 absolute top-6 right-6 leading-none select-none">{step}</span>
                <div className="text-xs font-bold text-violet-400 uppercase tracking-widest mb-3">{step}</div>
                <h3 className="text-lg font-bold text-white mb-2">{label}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed pr-8">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Content formats */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="md:flex md:items-center md:gap-16">
            <div className="md:w-1/2 mb-10 md:mb-0">
              <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
                One insight.<br />
                <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
                  Six formats.
                </span>
              </h2>
              <p className="text-zinc-400 text-lg leading-relaxed mb-6">
                The same idea — done as a LinkedIn hook, a Substack essay, or a YouTube script. Each format has its own agent prompt, length constraint, and structural guidance. You choose, the pipeline adapts.
              </p>
              <Link
                href="/create"
                className="inline-flex items-center gap-2 text-violet-400 hover:text-violet-300 font-semibold text-sm transition-colors"
              >
                Try the Create studio →
              </Link>
            </div>

            <div className="md:w-1/2 grid grid-cols-2 gap-3">
              {FORMATS.map(({ icon, label }) => (
                <div key={label} className="flex items-center gap-3 bg-zinc-900 border border-white/5 rounded-xl p-4 hover:border-violet-800/50 transition-colors">
                  <span className="text-2xl">{icon}</span>
                  <span className="text-sm font-medium text-zinc-300">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Agent pipeline diagram — the actual agentic flow, blocks + arrows */}
      <section className="py-24 px-6 bg-zinc-900/40 overflow-hidden">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-400 mb-3">Under the hood</p>
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
            This is what &quot;agentic&quot; actually means here
          </h2>
          <p className="text-zinc-400 text-lg mb-14 max-w-2xl mx-auto">
            Not one prompt pretending to be a product. Your evidence flows through nine coordinated stages —
            eight independent agents, each with one job — before a draft ever reaches you.
          </p>

          <div className="flex flex-wrap items-stretch justify-center gap-x-2 gap-y-6">
            {PIPELINE_STAGES.map((stage, i) => (
              <div key={stage.label} className="flex items-stretch">
                <div
                  className={`w-40 sm:w-44 rounded-2xl p-4 text-left flex flex-col justify-center ${
                    stage.kind === 'io'
                      ? 'bg-gradient-to-br from-violet-600/20 to-blue-600/10 border-2 border-violet-500/40'
                      : 'bg-zinc-950 border border-white/10'}`}
                >
                  <div className="text-2xl mb-2">{stage.icon}</div>
                  <div className={`text-xs font-bold uppercase tracking-wide mb-1 ${stage.kind === 'io' ? 'text-violet-300' : 'text-zinc-100'}`}>{stage.label}</div>
                  <div className="text-[11px] text-zinc-500 leading-snug">{stage.desc}</div>
                </div>
                {i < PIPELINE_STAGES.length - 1 && (
                  <div className="flex items-center px-1.5 text-violet-500/60 text-xl select-none">→</div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-8 inline-flex items-center gap-2.5 rounded-full border border-amber-500/30 bg-amber-500/5 px-4 py-2 text-xs text-amber-200/90">
            <span className="text-base">↻</span>
            <span>Quality loop: if Evaluator&apos;s score falls short, it routes straight back to Writer — Verifier, Critic, Humanizer, and Evaluator all run again, up to a capped number of passes, until the piece clears the bar.</span>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">Start free. Upgrade when reading turns into publishing.</h2>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto">One plan, no confusing tiers. Free covers the daily reading habit; Pro unlocks everything that turns it into published work.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {PRICING.map(({ name, tagline, price, features, cta, highlight }) => (
              <div key={name} className={`rounded-3xl p-8 border ${highlight ? 'border-violet-600/60 bg-gradient-to-b from-violet-950/40 to-zinc-950' : 'border-white/5 bg-zinc-900'}`}>
                {highlight && (
                  <span className="inline-block mb-4 rounded-full bg-violet-600 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">Most popular</span>
                )}
                <h3 className="text-2xl font-black text-white">{name}</h3>
                <p className="mt-1 text-sm text-zinc-400">{tagline}</p>
                <p className="mt-4 text-xl font-bold text-violet-300">{price}</p>
                <div className="mt-6 space-y-2.5">
                  {features.map(feature => (
                    <div key={feature} className="flex gap-2.5 text-sm leading-6 text-zinc-300">
                      <span className={`mt-1 ${highlight ? 'text-violet-400' : 'text-zinc-500'}`}>✓</span>
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
                <Link
                  href={cta.href}
                  className={`mt-8 block text-center rounded-xl px-5 py-3 text-sm font-bold transition-all ${highlight ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-900/40' : 'bg-white/5 hover:bg-white/10 text-zinc-200 border border-white/10'}`}
                >
                  {cta.label}
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-zinc-600">Pro requires your own LLM provider API key (OpenAI, Anthropic, or others) — Signal.ai's subscription covers the product and workflow, not model tokens.</p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-28 px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-violet-600/10 rounded-full blur-3xl" />
        </div>
        <div className="max-w-2xl mx-auto text-center relative">
          <h2 className="text-4xl sm:text-5xl font-black text-white mb-4 leading-tight">
            Your 15 minutes a day<br />starts here.
          </h2>
          <p className="text-zinc-400 text-lg mb-10">
            Open Today, read what matters, and have a publish-ready draft — free to start, no card required.
          </p>
          <Link
            href="/today"
            className="inline-flex items-center gap-2 px-10 py-4 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl text-lg transition-all shadow-xl shadow-violet-900/50 hover:shadow-violet-900/70"
          >
            ⚡ Open Signal.ai
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-zinc-600">
          <span className="flex items-center gap-1.5 font-black text-xl bg-gradient-to-r from-violet-500 to-blue-500 bg-clip-text text-transparent"><span className="text-2xl">⚡</span> Signal.ai</span>
          <div className="flex items-center gap-6">
            <Link href="/feed" className="hover:text-zinc-400 transition-colors">Feed</Link>
            <Link href="/ideas" className="hover:text-zinc-400 transition-colors">Ideas</Link>
            <Link href="/create" className="hover:text-zinc-400 transition-colors">Create</Link>
            <Link href="/knowledge" className="hover:text-zinc-400 transition-colors">Your Library</Link>
            <Link href="/sources" className="hover:text-zinc-400 transition-colors">Sources</Link>
          </div>
          <span>GenAI Intelligence OS</span>
        </div>
        <p className="mt-6 text-center text-xs text-zinc-600">© {new Date().getFullYear()} Utsab Chakraborty. All rights reserved.</p>
      </footer>
    </div>
  )
}
