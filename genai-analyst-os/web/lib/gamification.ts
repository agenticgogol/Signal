import { createServiceClient } from '@/lib/supabase'

// Reading/publishing regularity streaks — computed on read, not stored, so
// there's no separate table to keep in sync with daily_reading_queue /
// draft_inbox_items (the two tables that already record what actually
// happened each day). A "complete" day is intentionally forgiving: reading
// counts if anything was marked read that day (not "finish the whole
// queue"), publishing counts if a draft was approved that day — both are
// real user actions, not just something the system generated on its own.

const LOOKBACK_DAYS = 60
const MILESTONES = [3, 7, 14, 30, 60, 100]

export interface StreakInfo {
  currentStreak: number
  longestStreak: number
  last7Days: number
  last30Days: number
  todayComplete: boolean
  nextMilestone: number | null
  isMilestoneToday: boolean
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function computeStreaks(completedDates: Set<string>): Omit<StreakInfo, 'nextMilestone' | 'isMilestoneToday'> {
  const today = new Date()
  const todayStr = isoDate(today)
  const todayComplete = completedDates.has(todayStr)

  // Count backward from today (or yesterday, if today isn't done yet, so an
  // in-progress day doesn't prematurely zero out an otherwise-intact streak).
  let currentStreak = 0
  const cursor = new Date(today)
  if (!todayComplete) cursor.setUTCDate(cursor.getUTCDate() - 1)
  while (completedDates.has(isoDate(cursor))) {
    currentStreak++
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }

  // Longest streak within the lookback window.
  let longestStreak = 0
  let running = 0
  for (let i = 0; i < LOOKBACK_DAYS; i++) {
    const d = new Date(today)
    d.setUTCDate(d.getUTCDate() - i)
    if (completedDates.has(isoDate(d))) {
      running++
      longestStreak = Math.max(longestStreak, running)
    } else {
      running = 0
    }
  }

  let last7Days = 0
  let last30Days = 0
  for (let i = 0; i < 30; i++) {
    const d = new Date(today)
    d.setUTCDate(d.getUTCDate() - i)
    if (completedDates.has(isoDate(d))) {
      last30Days++
      if (i < 7) last7Days++
    }
  }

  return { currentStreak, longestStreak, last7Days, last30Days, todayComplete }
}

function withMilestone(streak: Omit<StreakInfo, 'nextMilestone' | 'isMilestoneToday'>): StreakInfo {
  const nextMilestone = MILESTONES.find(m => m > streak.currentStreak) ?? null
  const isMilestoneToday = streak.todayComplete && MILESTONES.includes(streak.currentStreak)
  return { ...streak, nextMilestone, isMilestoneToday }
}

export async function getStreaks(userId: string): Promise<{ reading: StreakInfo; publishing: StreakInfo }> {
  const db = createServiceClient()
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - LOOKBACK_DAYS)

  const [{ data: readingRows }, { data: publishingRows }] = await Promise.all([
    db.from('daily_reading_queue')
      .select('queue_date, status')
      .eq('user_id', userId)
      .eq('status', 'read')
      .gte('queue_date', since.toISOString().slice(0, 10)),
    db.from('draft_inbox_items')
      .select('reviewed_at')
      .eq('user_id', userId)
      .eq('status', 'approved')
      .gte('reviewed_at', since.toISOString()),
  ])

  const readingDates = new Set((readingRows ?? []).map(r => String(r.queue_date)))
  const publishingDates = new Set((publishingRows ?? []).map(r => String(r.reviewed_at).slice(0, 10)))

  return {
    reading: withMilestone(computeStreaks(readingDates)),
    publishing: withMilestone(computeStreaks(publishingDates)),
  }
}
