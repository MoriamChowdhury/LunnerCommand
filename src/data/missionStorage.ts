/* =========================================================
   MOONIX — SAVED PROGRESS
   Permanent bonus + mission journal live in localStorage so
   they survive a restart or a page refresh. Every read/write
   is wrapped: private windows can block storage.
   ========================================================= */

const BONUS_KEY = 'moonix-permanent-bonus'
const JOURNAL_KEY = 'moonix-mission-journal'

export type JournalEntry = {
  id: string
  date: string
  siteId: string
  windowId: string
  equipmentIds: string[]
  attempts: number
  firstAttempt: boolean
  bonusEarned: number
  stars: number
  note: string
}

export function loadBonus(): number {
  try {
    const n = Number(localStorage.getItem(BONUS_KEY))
    return Number.isFinite(n) && n > 0 ? n : 0
  } catch {
    return 0
  }
}

export function saveBonus(value: number) {
  try {
    localStorage.setItem(BONUS_KEY, String(value))
  } catch {
    /* storage unavailable — bonus lasts for this session only */
  }
}

export function loadJournal(): JournalEntry[] {
  try {
    const raw = localStorage.getItem(JOURNAL_KEY)
    const list = raw ? (JSON.parse(raw) as JournalEntry[]) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

/* insert or replace an entry by id, newest first */
export function saveJournalEntry(entry: JournalEntry): JournalEntry[] {
  const list = [
    entry,
    ...loadJournal().filter((e) => e.id !== entry.id),
  ]

  try {
    localStorage.setItem(JOURNAL_KEY, JSON.stringify(list))
  } catch {
    /* storage unavailable */
  }

  return list
}
