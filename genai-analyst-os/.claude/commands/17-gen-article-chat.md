Read `PROJECT_BRIEF.yaml` and `AGENTS.md`.

This skill builds inline RAG chat on a single article. The article full_text
is the context — no ChromaDB needed (article is short enough to fit in context).

1. Create `app/api/article-chat/route.ts` (Next.js API route):
   - POST request body: `{article_id, message, history: Message[]}`
   - Fetch article from Supabase by article_id (get full_text, title, tldr_bullets).
   - Check user plan — return 403 if not Pro.
   - Build messages array:
     System: "You are a critical reading assistant. The user is reading this article:
              ---
              Title: [title]
              TL;DR: [tldr_bullets joined]
              Full text: [full_text]
              ---
              Answer questions about this article only. If the question cannot be
              answered from the article text, say so clearly."
     Messages: history + new user message
   - Stream Claude response using Vercel AI SDK streamText().
   - Return streaming response.

2. Create `components/ArticleChat.tsx`:
   - Slide-in panel (fixed right side, 380px wide) triggered by "Chat about this" button.
   - Shows article title at top of panel.
   - Chat interface: message history + input box.
   - Uses Vercel AI SDK useChat() hook pointing to /api/article-chat.
   - Prefill 3 suggested questions as clickable chips:
     "What are the counterarguments?"
     "Explain this to a non-technical founder"
     "What's the most controversial claim here?"
   - Show PlanGate overlay if user is on Free tier.
   - Close button (X) dismisses the panel.

3. Add "Chat about this" button to FeedCard.tsx (only visible on article expand).

After creating files, validate TypeScript:
```bash
npx tsc --noEmit
```
Print any type errors and fix them.