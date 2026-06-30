// Starter writing samples in the popular AI/LLM LinkedIn-post and Substack
// formats, used to pre-populate the Voice page for users who don't yet have
// their own samples ready. Clearly editable/replaceable — these exist to
// solve the cold-start problem, not to become someone's actual voice.

export interface VoiceTemplate {
  label: string
  format: string
  text: string
}

export const VOICE_TEMPLATES: VoiceTemplate[] = [
  {
    label: 'LinkedIn — hook + lesson',
    format: 'LinkedIn',
    text: `We shipped an agent that called the same tool 40 times in a loop before anyone noticed.

Not a bug in the tool. A bug in the prompt — the agent had no way to know it had already tried that path.

Here's what fixed it:

→ We added explicit state to the system prompt: "tools already tried" and "outcomes so far"
→ We capped retries per tool to 3, with a hard stop and a fallback message
→ We logged every tool call to a trace table, not just the final answer

The lesson: agents don't fail because the model is dumb. They fail because we don't give them memory of their own actions.

If you're building anything agentic, treat "what have I already done" as a first-class piece of context — not an afterthought.

What's the worst infinite loop you've debugged in an agent system?`,
  },
  {
    label: 'LinkedIn — contrarian take',
    format: 'LinkedIn',
    text: `Unpopular opinion: most teams don't need RAG. They need better search.

I've watched three startups spend six weeks building a retrieval pipeline — chunking strategy, embedding model bake-offs, reranking — when the actual problem was that their underlying documents were poorly structured and their users couldn't find anything even with keyword search.

RAG amplifies whatever retrieval quality you already have. It doesn't fix bad information architecture.

Before you reach for a vector database, ask:
- Can a domain expert find the right document in under 30 seconds using Ctrl+F?
- Is your content actually chunked at a unit that makes sense (a policy, a method, a decision) or just split every 500 tokens?
- Do you know your top 20 failure queries today, without an LLM in the loop?

Fix those first. Then RAG becomes the last 20%, not the whole project.

Curious if others have seen the same pattern.`,
  },
  {
    label: 'Substack — narrative deep dive',
    format: 'Substack',
    text: `Why fine-tuning keeps disappointing teams (and what to do instead)

A few months ago I sat in on a postmortem for a fine-tuning project that had quietly burned about six weeks of engineering time. The team had a clear goal: get their support-ticket classifier to match the nuance of their best human agents. They collected a few thousand labeled examples, fine-tuned a mid-size open model, and the eval numbers looked... fine. Not great. Fine.

The problem wasn't the fine-tuning process itself. It was that nobody had asked a more basic question first: was the underlying base model even capable of representing the distinctions they cared about, given enough context? When we tried a long, carefully structured few-shot prompt on a frontier model with zero fine-tuning, it beat the fine-tuned model on the held-out set.

This isn't an argument against fine-tuning — it's a case for sequencing. Fine-tuning is the right tool when you've proven, with prompting, that the behavior is reachable, and now you need it cheaper, faster, or more consistent at scale. It is the wrong tool for "I'm not sure the model can even do this." Use prompting to find out if the juice is worth the squeeze. Use fine-tuning to industrialize what you've already proven works.

The team I mentioned eventually got there — they just paid for the lesson in the wrong order. I'd rather you read about it here first.`,
  },
]
