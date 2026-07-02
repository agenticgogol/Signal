'use client'

import TutorPanel from '@/components/TutorPanel'

export interface TutorTarget {
  term: string
  articleId?: string
  knowledgeItemId?: string
}

// The inline "click a term while reading" entry point — the article/item
// stays visible and scrollable behind this, so you never lose your place.
// Same TutorPanel engine as the standalone /tutor Hub, just presented as a
// slide-over instead of a full page.
export default function TutorSlideOver({ target, onClose }: {
  target: TutorTarget
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[110] flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={onClose} />
      <div className="relative w-full max-w-md h-full overflow-y-auto bg-zinc-50 dark:bg-zinc-950 shadow-2xl p-5">
        <TutorPanel
          variant="compact"
          initialTerm={target.term}
          sourceRef={{ articleId: target.articleId, knowledgeItemId: target.knowledgeItemId }}
          onClose={onClose}
        />
      </div>
    </div>
  )
}
