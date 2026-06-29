Read `PROJECT_BRIEF.yaml` and `PROMPTS.md`.

Create `supabase/functions/weekly-digest/index.ts`:

1. Triggered by pg_cron: `0 8 * * 0` (every Sunday 08:00 UTC).
   Add this schedule to a new Supabase migration file.

2. Function logic (Deno / TypeScript):
   - Query `user_profiles` where plan = 'pro' and is active.
   - For each Pro user:
     a. Query `user_feed_items` for the past 7 days, top 5 by blend_score,
        JOIN articles to get title + tldr_bullets.
     b. Query `daily_ideas` for the past 7 days, top 3 by created_at.
     c. Call Claude (claude-haiku-4-5-20251001, cheap tier) with:
        System: "You are a newsletter curator. Write a concise weekly digest."
        User: "User's top articles this week: [list]. Top content ideas: [list].
               Write a 200-word digest email with: subject line, 3-sentence intro,
               article highlights (1 line each), top idea to act on this week.
               Return JSON: {subject, html_body, text_body}."
     d. Send via Resend API (POST https://api.resend.com/emails):
        - From: digest@[project domain]
        - To: user email from auth.users
        - Subject: from Claude response
        - html: from Claude response
     e. Log send status to a `digest_logs` table (user_id, sent_at, status).
   - Process users in batches of 10 to stay within 150s wall time.

3. Error handling: if Resend fails, log error to digest_logs and continue to next user.

Add to `.env.example`:
```
RESEND_API_KEY=re_...
DIGEST_FROM_EMAIL=digest@yourdomain.com
```

After creating the function and migration, test with:
```bash
supabase functions serve weekly-digest --env-file .env.local
curl -X POST http://localhost:54321/functions/v1/weekly-digest \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY"
```
Print the response. Fix any TypeScript errors.