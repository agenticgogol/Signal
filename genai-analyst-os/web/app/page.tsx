import Link from 'next/link'

const VALUE_PROPS = [
  {
    icon: '🧠',
    title: 'Know what matters — before everyone else',
    body: 'Signal monitors 50+ curated sources: research papers, engineering blogs, product launches, and industry takes. Every article is scored, tagged, and ranked against your interests. You read the 5 that matter, not the 50 that exist.',
    accent: 'from-violet-500 to-indigo-500',
  },
  {
    icon: '✍️',
    title: 'From insight to publish-ready content in minutes',
    body: 'Pick an article, pick a format — LinkedIn post, Substack essay, blog, YouTube script, or Twitter thread. A 4-stage agentic pipeline (Orchestrator → Writer → Critic → Humanizer) turns raw ideas into polished drafts with your voice.',
    accent: 'from-blue-500 to-cyan-500',
  },
  {
    icon: '📈',
    title: 'Your feed gets smarter every day',
    body: 'Signal learns from what you like, save, and create from. The more you use it, the more it resembles your actual taste. Topic boosts, reaction signals, and engagement patterns all feed back into ranking — no manual tuning needed.',
    accent: 'from-emerald-500 to-teal-500',
  },
]

const HOW_IT_WORKS = [
  { step: '01', label: 'Curated Feed', desc: 'Signal pulls from your sources daily. Every article gets TL;DR bullets, topic tags, and a depth score.' },
  { step: '02', label: 'Ranked for You', desc: 'A blend score surfaces the articles that match your interests and reaction history at the top.' },
  { step: '03', label: 'Idea Generation', desc: 'Signal suggests content angles from the week\'s top articles — opinionated takes ready to build on.' },
  { step: '04', label: 'Agentic Creation', desc: 'Multi-agent pipeline drafts, critiques, and humanizes content. You review, refine, and publish.' },
]

const CAPABILITIES = [
  { label: 'Sources monitored', value: '50+' },
  { label: 'Content formats', value: '6' },
  { label: 'Agent pipeline stages', value: '4' },
  { label: 'Topics tracked', value: '7' },
]

const FORMATS = [
  { icon: '💼', label: 'LinkedIn Post' },
  { icon: '📧', label: 'Substack' },
  { icon: '🧵', label: 'Thread' },
  { icon: '📝', label: 'Blog Post' },
  { icon: '🎥', label: 'YouTube Long' },
  { icon: '⚡', label: 'YouTube Short' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white overflow-x-hidden">

      {/* Nav */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent font-black text-xl tracking-tight">
            ⚡ Signal
          </span>
          <Link
            href="/feed"
            className="px-4 py-1.5 text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors"
          >
            Open app →
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6 relative">
        {/* background glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-violet-600/10 rounded-full blur-3xl" />
        </div>

        <div className="max-w-4xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-950/60 border border-violet-800/60 text-violet-300 text-xs font-medium mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            GenAI Intelligence Operating System
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.05] mb-6">
            <span className="bg-gradient-to-br from-white via-white to-zinc-400 bg-clip-text text-transparent">
              Stop drowning
            </span>
            <br />
            <span className="bg-gradient-to-r from-violet-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
              in AI noise.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed mb-10">
            Signal watches the GenAI landscape daily, surfaces what actually matters to you,
            and turns those insights into publish-ready content — in minutes.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/feed"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl text-base transition-all shadow-lg shadow-violet-900/40 hover:shadow-violet-900/60"
            >
              Open your feed →
            </Link>
            <a
              href="#how-it-works"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 bg-white/5 hover:bg-white/10 text-zinc-300 font-medium rounded-xl text-base transition-colors border border-white/10"
            >
              See how it works ↓
            </a>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-y border-white/5 bg-white/2">
        <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-8">
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
              Not a news aggregator. Not a generic writing tool. Signal is an intelligence OS — purpose-built for people building with and writing about agentic AI.
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

      {/* How it works */}
      <section id="how-it-works" className="py-24 px-6 bg-zinc-900/40">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">How Signal works</h2>
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

      {/* Agent pipeline visual */}
      <section className="py-24 px-6 bg-zinc-900/40">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
            Four agents. One polished draft.
          </h2>
          <p className="text-zinc-400 text-lg mb-14 max-w-2xl mx-auto">
            Signal&apos;s content pipeline isn&apos;t a single prompt. It&apos;s a four-stage agent chain — each stage specialized, each with a distinct role.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch gap-0">
            {[
              { icon: '🎯', label: 'Orchestrator', desc: 'Builds the content brief — angle, audience, structure' },
              { icon: '✍️', label: 'Writer', desc: 'Drafts the full piece in the target format' },
              { icon: '🔍', label: 'Critic', desc: 'Fact-checks, sharpens arguments, cuts fluff' },
              { icon: '✨', label: 'Humanizer', desc: 'Applies your voice, style, and personality' },
            ].map(({ icon, label, desc }, i, arr) => (
              <div key={label} className="flex flex-col sm:flex-row items-stretch flex-1">
                <div className="flex-1 bg-zinc-950 border border-white/5 p-5 text-left hover:border-violet-800/40 transition-colors first:rounded-t-xl sm:first:rounded-l-xl sm:first:rounded-tr-none last:rounded-b-xl sm:last:rounded-r-xl sm:last:rounded-bl-none">
                  <div className="text-2xl mb-3">{icon}</div>
                  <div className="text-xs font-bold text-violet-400 uppercase tracking-widest mb-1">{label}</div>
                  <div className="text-xs text-zinc-500 leading-relaxed">{desc}</div>
                </div>
                {i < arr.length - 1 && (
                  <div className="flex items-center justify-center py-1 sm:py-0 sm:px-1 text-zinc-700 text-lg font-bold flex-shrink-0">
                    <span className="hidden sm:block">→</span>
                    <span className="sm:hidden">↓</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-28 px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-violet-600/10 rounded-full blur-3xl" />
        </div>
        <div className="max-w-2xl mx-auto text-center relative">
          <h2 className="text-4xl sm:text-5xl font-black text-white mb-4 leading-tight">
            Your edge in the GenAI era<br />starts here.
          </h2>
          <p className="text-zinc-400 text-lg mb-10">
            Pull today&apos;s feed, find the story that matters, and have a publish-ready draft in under 10 minutes.
          </p>
          <Link
            href="/feed"
            className="inline-flex items-center gap-2 px-10 py-4 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl text-lg transition-all shadow-xl shadow-violet-900/50 hover:shadow-violet-900/70"
          >
            ⚡ Open Signal
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-zinc-600">
          <span className="font-bold bg-gradient-to-r from-violet-500 to-blue-500 bg-clip-text text-transparent">⚡ Signal</span>
          <div className="flex items-center gap-6">
            <Link href="/feed" className="hover:text-zinc-400 transition-colors">Feed</Link>
            <Link href="/ideas" className="hover:text-zinc-400 transition-colors">Ideas</Link>
            <Link href="/create" className="hover:text-zinc-400 transition-colors">Create</Link>
            <Link href="/sources" className="hover:text-zinc-400 transition-colors">Sources</Link>
          </div>
          <span>GenAI Intelligence OS</span>
        </div>
      </footer>
    </div>
  )
}
