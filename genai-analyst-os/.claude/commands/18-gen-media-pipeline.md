Read `PROJECT_BRIEF.yaml` and `PROMPTS.md`.

Create three files for the media pipeline:

1. `lib/media/elevenlabs.ts`:
   - `generateVoiceover(script: string, voiceId: string): Promise<Buffer>`
   - Calls ElevenLabs /v1/text-to-speech/{voice_id} API.
   - Returns MP3 audio buffer.
   - If ELEVENLABS_API_KEY is not set, return a mock silence buffer (8 seconds).
   - Add to `.env.example`: ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID

2. `lib/media/remotion.ts`:
   - `renderVideo(script: ReelScript, audioBuffer: Buffer): Promise<string>`
   - ReelScript type: {hook: string, problem: string, explanation: string, cta: string, broll_suggestions: string[]}
   - Uses @remotion/renderer renderMedia() with a simple slide composition.
   - Each section (hook/problem/explanation/cta) gets one 'slide': white background,
     large centred text, on-screen text callout for broll_suggestion.
   - Returns path to output MP4 file in /tmp/.
   - If SKIP_VIDEO_RENDER=true (dev mode), return a mock path without rendering.
   - Add remotion and @remotion/renderer to package.json.

3. `app/api/media/route.ts` (Next.js API route):
   - POST body: {draft_id, format: 'reel'}
   - Check user is Pro — return 403 if not.
   - Fetch draft from Supabase by draft_id.
   - Parse draft content as ReelScript JSON.
   - Call generateVoiceover(script.hook + " " + script.explanation, voiceId).
   - Call renderVideo(script, audioBuffer).
   - Upload MP4 to Supabase Storage bucket 'media'.
   - Return {video_url, duration_estimate_seconds}.

After creating files:
```bash
npx tsc --noEmit
```
Print "Media pipeline created." Note: actual video rendering requires
REMOTION_CHROME_EXECUTABLE to be set in production (Vercel does not include Chrome).
Suggest Railway.app or a separate worker for production video rendering.