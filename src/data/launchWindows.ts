/* =========================================================
   MOONIX — LAUNCH WINDOWS
   Real monthly geometry from NASA JPL Horizons (made by
   tools/build_window_data.py): for each site, the % of every
   month (2027) that the Sun and the Earth are above the horizon.

   How the numbers are made (a simple game model):
   - Horizons gives the SEASON pattern for each site (flat horizon,
     no mountains).
   - That pattern is scaled so its yearly average equals the NASA
     LRO/LOLA value, which already includes terrain shadows.
   - The result is capped at 100 %.
   Only "solarActivity" is still a game estimate (it cannot be
   predicted month by month).
   ========================================================= */

import windowScienceFile from './launchWindowsScience.json'
import type { LunarSite } from './lunarSites'

export type LaunchWindow = {
  id: string
  month: string
  short: string

  /* % of the month the Sun is above the horizon (site specific) */
  sun: number

  /* % of the month Earth is in direct line of sight (site specific) */
  earth: number

  /* relative solar-particle activity, 0-0.4 (GAME ESTIMATE) */
  solarActivity: number

  note: string
}

type SiteMonths = {
  sun_by_month: number[]
  earth_by_month: number[]
  sun_year_mean: number
  earth_year_mean: number
  lola_sun_mean: number
  lola_earth_mean: number
}

type WindowScienceFile = {
  year?: number
  source?: string
  sites: Record<string, SiteMonths>
}

const science = windowScienceFile as unknown as WindowScienceFile

export const WINDOW_SCIENCE_SOURCE = {
  year: science.year ?? 2027,
  source: science.source ?? 'NASA JPL Horizons',
}

const MONTH_BASE = [
  { id: 'jan', month: 'JANUARY', short: 'JAN', solarActivity: 0.1 },
  { id: 'feb', month: 'FEBRUARY', short: 'FEB', solarActivity: 0.12 },
  { id: 'mar', month: 'MARCH', short: 'MAR', solarActivity: 0.18 },
  { id: 'apr', month: 'APRIL', short: 'APR', solarActivity: 0.24 },
  { id: 'may', month: 'MAY', short: 'MAY', solarActivity: 0.28 },
  { id: 'jun', month: 'JUNE', short: 'JUN', solarActivity: 0.22 },
  { id: 'jul', month: 'JULY', short: 'JUL', solarActivity: 0.16 },
  { id: 'aug', month: 'AUGUST', short: 'AUG', solarActivity: 0.2 },
  { id: 'sep', month: 'SEPTEMBER', short: 'SEP', solarActivity: 0.3 },
  { id: 'oct', month: 'OCTOBER', short: 'OCT', solarActivity: 0.32 },
  { id: 'nov', month: 'NOVEMBER', short: 'NOV', solarActivity: 0.18 },
  { id: 'dec', month: 'DECEMBER', short: 'DEC', solarActivity: 0.12 },
]

const clamp100 = (n: number) => Math.max(0, Math.min(100, n))

/* season pattern x (NASA terrain average / flat-horizon average) */
function scaled(byMonth: number[], flatMean: number, nasaMean: number, month: number) {
  if (!flatMean) return Math.round(clamp100(nasaMean))
  return Math.round(clamp100((byMonth[month] * nasaMean) / flatMean))
}

function noteFor(sun: number, earth: number) {
  const power =
    sun >= 75
      ? 'Strong sunlight this month: good for solar power.'
      : sun >= 40
        ? 'Moderate sunlight: solar works, a battery helps.'
        : sun >= 5
          ? 'Weak sunlight: battery backup strongly recommended.'
          : 'No direct sunlight this month: you will depend on batteries.'

  const link =
    earth < 40
      ? ' The Earth link is weak.'
      : earth >= 80
        ? ' The Earth link is very good.'
        : ''

  return power + link
}

/* the 12 windows for one site (this is what the game shows) */
export function windowsFor(site: LunarSite): LaunchWindow[] {
  const m = science.sites?.[site.id]

  if (!m) {
    throw new Error(
      `launchWindowsScience.json has no data for "${site.id}". ` +
        'Run: python tools/build_window_data.py'
    )
  }

  return MONTH_BASE.map((base, i) => {
    const sun = scaled(m.sun_by_month, m.sun_year_mean, m.lola_sun_mean, i)
    const earth = scaled(m.earth_by_month, m.earth_year_mean, m.lola_earth_mean, i)

    return { ...base, sun, earth, note: noteFor(sun, earth) }
  })
}

/* one window made specific to a site (works on any window of the list) */
export function windowFor(site: LunarSite, win: LaunchWindow): LaunchWindow {
  return windowsFor(site).find((w) => w.id === win.id) ?? win
}

/* the plain list (ids, names, estimates) used where no site is known;
   sun / earth here are the average of all sites */
export const launchWindows: LaunchWindow[] = MONTH_BASE.map((base, i) => {
  const all = Object.values(science.sites)
  const avg = (pick: (s: SiteMonths) => number) =>
    Math.round(all.reduce((t, s) => t + pick(s), 0) / Math.max(1, all.length))

  const sun = avg((s) => scaled(s.sun_by_month, s.sun_year_mean, s.lola_sun_mean, i))
  const earth = avg((s) => scaled(s.earth_by_month, s.earth_year_mean, s.lola_earth_mean, i))

  return { ...base, sun, earth, note: noteFor(sun, earth) }
})