import { useMemo } from 'react'

import {
  isFloorSite,
  windowsFor,
  skyFor,
  longestBelowHorizon,
} from '../data/launchWindows'
import { findSite, findWindow } from '../data/missionEngine'

import HorizonChart from './HorizonChart'

import './MissionReplay.css'

type Props = {
  siteId: string
  windowId: string
}

/* honesty line shown under every replay */
const ESTIMATE_NOTE =
  'Sun and Earth numbers are NASA-based (LRO/LOLA and JPL Horizons). Signal strength, oxygen, fuel and crew are game estimates, not NASA data.'

export default function MissionReplay({ siteId, windowId }: Props) {
  const site = findSite(siteId)
  const picked = findWindow(windowId)

  const info = useMemo(() => {
    const all = windowsFor(site)
    const mine = all.find((w) => w.id === windowId)
    const sky = skyFor(site, windowId)

    if (!mine || (!sky && !isFloorSite(site))) return null

    const best = all.reduce((a, b) => (b.sun > a.sun ? b : a))
    const worst = all.reduce((a, b) => (b.sun < a.sun ? b : a))

    return {
      all,
      mine,
      best,
      worst,
      sky,
      darkDays: sky ? longestBelowHorizon(sky.sun, sky.stepHours) : 0,
      blackoutDays: sky ? longestBelowHorizon(sky.earth, sky.stepHours) : 0,
    }
  }, [site, windowId])

  if (!info) return null

  const { mine, best, worst, sky, darkDays, blackoutDays } = info

  const nice = (m: string) => m.charAt(0) + m.slice(1).toLowerCase()
  const monthWord = nice(mine.month)

  /* crater floor: no flat-horizon chart, only the NASA averages */
  if (!sky) {
    return (
      <section className="mr-box" aria-label="Mission replay">
        <header className="mr-head">
          <small>MISSION REPLAY</small>
          <h2>Your landing sky: {picked.month}</h2>
        </header>

        <p className="mr-text">
          You landed on the crater floor, where the walls hide most of the
          sky. NASA LRO/LOLA says the Sun reaches this spot only about{' '}
          {site.sunlight}% of the time and Earth about {site.communication}%.
          In {monthWord} the estimate is Sun {mine.sun}% and Earth{' '}
          {mine.earth}%. Solar panels make almost nothing here, so a power
          source that does not need the Sun matters most. The ice and the
          cold are why scientists want to go there.
        </p>

        <p className="mr-note">{ESTIMATE_NOTE}</p>
      </section>
    )
  }

  const verdict =
    darkDays >= 1
      ? `In ${monthWord} the Sun stayed below the horizon for about ${darkDays.toFixed(0)} days at ${site.name}. Your lander had to live on its batteries.`
      : mine.sun >= 40
        ? `In ${monthWord} the Sun was above the horizon all month at ${site.name}, so solar panels could work every day.`
        : `In ${monthWord} the Sun was low but never fully gone at ${site.name}.`

  const sunniest = info.all.filter((w) => w.sun === best.sun)

  const compare = sunniest.some((w) => w.id === mine.id)
    ? `You picked one of the sunniest months at this site (Sun ${best.sun}%).`
    : `The sunniest months here reach Sun ${best.sun}% (${sunniest
        .map((w) => nice(w.month))
        .join(', ')}). The darkest is ${nice(worst.month)} (Sun ${worst.sun}%).`

  const radio =
    blackoutDays >= 1
      ? `Radio: Earth was below the horizon for up to ${blackoutDays.toFixed(1)} days, so there was no direct link then.`
      : 'Radio: Earth was never hidden for a full day, so direct contact was possible all month.'

  return (
    <section className="mr-box" aria-label="Mission replay">
      <header className="mr-head">
        <small>MISSION REPLAY</small>
        <h2>Your landing sky: {picked.month}</h2>
      </header>

      <p className="mr-text">
        {verdict} {radio} {compare}
      </p>

      <HorizonChart sky={sky} siteName={site.name} monthName={mine.month} />

      <p className="mr-note">{ESTIMATE_NOTE}</p>
    </section>
  )
}
