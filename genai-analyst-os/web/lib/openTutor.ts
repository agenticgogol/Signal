// Opens the globally-mounted AI Tutor slide-over (rendered once in
// AppShell) from anywhere — Feed, Library, or any future surface — without
// each caller needing its own slide-over state. Same custom-event pattern
// already used for signal-auth-popup:open.
export function openTutor(term: string, ref?: { articleId?: string; knowledgeItemId?: string }) {
  window.dispatchEvent(new CustomEvent('signal-tutor:open', { detail: { term, ...ref } }))
}
