/* =========================================================
   MOONIX — MISSION ENGINE
   Decides whether a landing succeeds. No randomness: the same
   site + equipment + launch window always gives the same
   result, so players can learn *why* a mission worked.
   ========================================================= */

import { lunarSites, type LunarSite } from './lunarSites'
import { launchWindows, type LaunchWindow } from './launchWindows'
import {
  EQUIPMENT_BUDGET,
  MASS_LIMIT,
  equipmentList,
  type EquipmentItem,
} from './equipment'

/* bonus added to the budget of the next mission */
export const FIRST_TRY_BONUS = 30

export type SystemKey = 'power' | 'comms' | 'safety'

export type SystemCheck = {
  key: SystemKey
  label: string
  icon: string
  color: string
  have: number
  need: number
  ok: boolean
  /* one simple sentence for 12–14 year olds */
  explain: string
}

export type Shortage = {
  key: SystemKey
  label: string
  icon: string
  have: number
  need: number
  missing: number
}

export type EquipmentRating = 'saver' | 'helper' | 'science' | 'extra'

export type EquipmentPerformance = {
  item: EquipmentItem
  rating: EquipmentRating
  /* 0–100, how well it worked at this site/month */
  efficiency: number
  note: string
}

export type MissionResult = {
  success: boolean
  siteId: string
  windowId: string
  equipmentIds: string[]

  checks: SystemCheck[]
  shortages: Shortage[]

  science: number
  scienceGoal: number

  budget: number
  spent: number
  remainingBudget: number
  massUsed: number

  fuelUsed: number
  landingOffset: number
  landingGrade: 'A' | 'B' | 'C'

  performance: EquipmentPerformance[]
}

const SYSTEM_META: Record<
  SystemKey,
  { label: string; icon: string; color: string }
> = {
  power: { label: 'POWER', icon: '⚡', color: '#e5bd72' },
  comms: { label: 'EARTH LINK', icon: '📡', color: '#72e8ff' },
  safety: { label: 'CREW SAFETY', icon: '🛡', color: '#73e2a5' },
}

const RISK_SAFETY: Record<string, number> = {
  LOW: 12,
  MEDIUM: 6,
  HIGH: 0,
}

const ICE_SCIENCE: Record<string, number> = {
  'VERY HIGH': 12,
  HIGH: 10,
  MEDIUM: 6,
  LOW: 4,
}

const TERRAIN_OFFSET: Record<string, number> = {
  EXCELLENT: 0,
  STABLE: 8,
  MODERATE: 22,
}

export const SCIENCE_GOAL = 25

/* ---------------- lookups ---------------- */

export const findSite = (id: string): LunarSite =>
  lunarSites.find((s) => s.id === id) ?? lunarSites[0]

export const findWindow = (id: string): LaunchWindow =>
  launchWindows.find((w) => w.id === id) ?? launchWindows[0]

export const findItems = (ids: string[]): EquipmentItem[] =>
  equipmentList.filter((item) => ids.includes(item.id))

export const parseTemperature = (value: string) => {
  const n = parseInt(value.replace('−', '-'), 10)
  return Number.isNaN(n) ? -100 : n
}

/* solar panels work best with a sunny site AND a sunny month */
export const solarFactor = (site: LunarSite, win: LaunchWindow) =>
  (site.sunlight / 100 + win.sun / 100) / 2

/* ---------------- requirements ---------------- */

export function getRequirements(
  site: LunarSite,
  win: LaunchWindow
): Record<SystemKey, number> {
  const cold = parseTemperature(site.temperature) <= -100

  return {
    power: 22 + (cold ? 5 : 0) + (win.sun < 60 ? 5 : 0),
    comms: 22,
    safety:
      20 + (cold ? 8 : 0) + Math.round(win.solarActivity * 40),
  }
}

/* how many points one item adds to one system here */
export function itemContribution(
  item: EquipmentItem,
  key: SystemKey | 'science',
  site: LunarSite,
  win: LaunchWindow
) {
  const value = item.stats[key]

  if (key === 'power' && item.sunDependent) {
    return Math.round(value * solarFactor(site, win))
  }

  if (key === 'science' && item.id === 'water') {
    /* the ice drill finds more at ice-rich sites */
    return site.ice === 'VERY HIGH' || site.ice === 'HIGH'
      ? value + 6
      : value
  }

  return value
}

export function getSupply(
  site: LunarSite,
  win: LaunchWindow,
  items: EquipmentItem[]
) {
  const baseComms = Math.round(
    (site.communication / 100) * (win.earth / 100) * 30
  )

  const sum = (key: SystemKey | 'science') =>
    items.reduce(
      (total, item) =>
        total + itemContribution(item, key, site, win),
      0
    )

  return {
    power: sum('power'),
    comms: baseComms + sum('comms'),
    safety: (RISK_SAFETY[site.risk] ?? 6) + sum('safety'),
    science: (ICE_SCIENCE[site.ice] ?? 6) + sum('science'),
  }
}

const EXPLAIN: Record<SystemKey, (ok: boolean) => string> = {
  power: (ok) =>
    ok
      ? 'Enough energy to keep lights, heaters and computers running.'
      : 'Not enough energy. The base would freeze and shut down.',
  comms: (ok) =>
    ok
      ? 'Mission control on Earth can hear the crew clearly.'
      : 'The radio link to Earth is too weak to land safely.',
  safety: (ok) =>
    ok
      ? 'The crew is protected from cold and space radiation.'
      : 'The crew is not protected enough from cold or radiation.',
}

/* ---------------- main evaluation ---------------- */

export function evaluateMission(
  siteId: string,
  equipmentIds: string[],
  windowId: string,
  budget = EQUIPMENT_BUDGET
): MissionResult {
  const site = findSite(siteId)
  const win = findWindow(windowId)
  const items = findItems(equipmentIds)

  const need = getRequirements(site, win)
  const have = getSupply(site, win, items)

  const checks: SystemCheck[] = (
    ['power', 'comms', 'safety'] as SystemKey[]
  ).map((key) => {
    const ok = have[key] >= need[key]
    return {
      key,
      ...SYSTEM_META[key],
      have: have[key],
      need: need[key],
      ok,
      explain: EXPLAIN[key](ok),
    }
  })

  const shortages: Shortage[] = checks
    .filter((c) => !c.ok)
    .map((c) => ({
      key: c.key,
      label: c.label,
      icon: c.icon,
      have: c.have,
      need: c.need,
      missing: c.need - c.have,
    }))

  const spent = items.reduce((s, i) => s + i.cost, 0)
  const massUsed = items.reduce((s, i) => s + i.mass, 0)

  /* heavier lander = more fuel; rough ground = more hovering */
  const terrain = TERRAIN_OFFSET[site.terrain] ?? 12
  const fuelUsed = Math.min(
    96,
    Math.round(52 + (massUsed / MASS_LIMIT) * 26 + terrain * 0.4)
  )

  /* good radio link = better navigation = closer to the target */
  const commsMargin = Math.max(0, have.comms - need.comms)
  const landingOffset = Math.max(
    6,
    Math.round(
      18 +
        terrain +
        (site.risk === 'MEDIUM' ? 12 : site.risk === 'HIGH' ? 24 : 0) -
        Math.min(14, commsMargin * 0.5)
    )
  )
  const landingGrade =
    landingOffset < 30 ? 'A' : landingOffset < 50 ? 'B' : 'C'

  const performance = rateEquipment(site, win, items, need)

  return {
    success: shortages.length === 0,
    siteId: site.id,
    windowId: win.id,
    equipmentIds: items.map((i) => i.id),
    checks,
    shortages,
    science: have.science,
    scienceGoal: SCIENCE_GOAL,
    budget,
    spent,
    remainingBudget: budget - spent,
    massUsed,
    fuelUsed,
    landingOffset,
    landingGrade,
    performance,
  }
}

function rateEquipment(
  site: LunarSite,
  win: LaunchWindow,
  items: EquipmentItem[],
  need: Record<SystemKey, number>
): EquipmentPerformance[] {
  return items.map((item) => {
    const without = getSupply(
      site,
      win,
      items.filter((i) => i.id !== item.id)
    )

    const savedSystem = (['power', 'comms', 'safety'] as SystemKey[])
      .find((key) => without[key] < need[key])

    const efficiency = item.sunDependent
      ? Math.round(solarFactor(site, win) * 100)
      : item.stats.power < 0
        ? 70
        : 100

    if (savedSystem) {
      return {
        item,
        rating: 'saver',
        efficiency,
        note: `Without it, ${SYSTEM_META[savedSystem].label.toLowerCase()} would have been too low.`,
      }
    }

    if (item.stats.science > 0) {
      return {
        item,
        rating: 'science',
        efficiency,
        note:
          item.stats.power < 0
            ? 'Great for science, but it used up some power.'
            : 'Added extra science to the mission.',
      }
    }

    /* still useful if a system it helps would get close to the line */
    const helpedSystem = (['power', 'comms', 'safety'] as SystemKey[])
      .filter((key) => itemContribution(item, key, site, win) > 0)
      .find((key) => without[key] < need[key] * 1.4)

    if (helpedSystem) {
      return {
        item,
        rating: 'helper',
        efficiency,
        note: `Gave your ${SYSTEM_META[helpedSystem].label.toLowerCase()} a safe extra margin.`,
      }
    }

    return {
      item,
      rating: 'extra',
      efficiency,
      note: 'Nice backup, but the mission would have worked without it.',
    }
  })
}

/* ---------------- repair helpers ---------------- */

/* how much one extra item would help each shortage */
export function repairValue(
  item: EquipmentItem,
  siteId: string,
  windowId: string
): Partial<Record<SystemKey, number>> {
  const site = findSite(siteId)
  const win = findWindow(windowId)
  const out: Partial<Record<SystemKey, number>> = {}

  for (const key of ['power', 'comms', 'safety'] as SystemKey[]) {
    const v = itemContribution(item, key, site, win)
    if (v > 0) out[key] = v
  }

  return out
}

/* cheapest set of new items that fixes every shortage
   within the money and mass that are left (null = impossible) */
export function findCheapestFix(
  siteId: string,
  equipmentIds: string[],
  windowId: string,
  budget = EQUIPMENT_BUDGET
): string[] | null {
  const base = evaluateMission(siteId, equipmentIds, windowId, budget)
  if (base.success) return []

  const candidates = equipmentList.filter(
    (item) => !equipmentIds.includes(item.id)
  )

  let best: { ids: string[]; cost: number } | null = null

  for (let mask = 1; mask < 1 << candidates.length; mask++) {
    const extra = candidates.filter((_, i) => mask & (1 << i))
    const cost = extra.reduce((s, i) => s + i.cost, 0)
    const mass = extra.reduce((s, i) => s + i.mass, 0)

    if (cost > base.remainingBudget) continue
    if (base.massUsed + mass > MASS_LIMIT) continue
    if (best && cost >= best.cost) continue

    const ids = [...equipmentIds, ...extra.map((i) => i.id)]
    if (evaluateMission(siteId, ids, windowId, budget).success) {
      best = { ids: extra.map((i) => i.id), cost }
    }
  }

  return best ? best.ids : null
}

/* ---------------- stars (for kids) ---------------- */

export function countStars(
  result: MissionResult,
  firstAttempt: boolean
) {
  let stars = result.success ? 1 : 0
  if (firstAttempt) stars += 1
  if (result.science >= result.scienceGoal) stars += 1
  return stars
}
