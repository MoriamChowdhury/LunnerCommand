/* =========================================================
   MOONIX — LAUNCH WINDOWS
   Simplified, illustrative model (same one as the original
   demo): how much of each month the polar Sun and Earth sit
   above the local horizon, plus relative solar activity.
   ========================================================= */

export type LaunchWindow = {
  id: string
  month: string
  short: string

  /* % of the month the Sun is above the horizon */
  sun: number

  /* % of the month Earth is in direct line of sight */
  earth: number

  /* relative solar-particle activity, 0–0.4 */
  solarActivity: number

  note: string
}

export const launchWindows: LaunchWindow[] = [
  { id: 'jan', month: 'JANUARY', short: 'JAN', sun: 80, earth: 88, solarActivity: 0.1, note: 'Peak illumination — the best month for solar power.' },
  { id: 'feb', month: 'FEBRUARY', short: 'FEB', sun: 75, earth: 84, solarActivity: 0.12, note: 'Strong sunlight and a stable Earth link.' },
  { id: 'mar', month: 'MARCH', short: 'MAR', sun: 70, earth: 79, solarActivity: 0.18, note: 'Good option; sunlight begins to decline.' },
  { id: 'apr', month: 'APRIL', short: 'APR', sun: 65, earth: 74, solarActivity: 0.24, note: 'Battery backup strongly recommended.' },
  { id: 'may', month: 'MAY', short: 'MAY', sun: 60, earth: 70, solarActivity: 0.28, note: 'Solar power becomes challenging.' },
  { id: 'jun', month: 'JUNE', short: 'JUN', sun: 55, earth: 68, solarActivity: 0.22, note: 'Near the illumination minimum — avoid for solar missions.' },
  { id: 'jul', month: 'JULY', short: 'JUL', sun: 50, earth: 66, solarActivity: 0.16, note: 'Darkest window. Energy storage is critical.' },
  { id: 'aug', month: 'AUGUST', short: 'AUG', sun: 55, earth: 70, solarActivity: 0.2, note: 'Improving, but still a difficult power budget.' },
  { id: 'sep', month: 'SEPTEMBER', short: 'SEP', sun: 62, earth: 75, solarActivity: 0.3, note: 'Viable, with elevated solar activity.' },
  { id: 'oct', month: 'OCTOBER', short: 'OCT', sun: 68, earth: 81, solarActivity: 0.32, note: 'Solid sunlight, highest radiation risk of the year.' },
  { id: 'nov', month: 'NOVEMBER', short: 'NOV', sun: 74, earth: 86, solarActivity: 0.18, note: 'Excellent sunlight and communications.' },
  { id: 'dec', month: 'DECEMBER', short: 'DEC', sun: 78, earth: 90, solarActivity: 0.12, note: 'Nearly optimal — longest time before lunar night.' },
]
