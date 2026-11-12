import { useMemo } from 'react'

import type { SkyData } from '../data/launchWindows'

import './HorizonChart.css'

type Props = {
  sky: SkyData
  siteName: string
  monthName: string
  /* true when no month is chosen yet and the best one is shown */
  isBestMonth?: boolean
}

const W = 640
const LEFT = 62
const RIGHT = 22
const PANEL_H = 64
const GAP = 14
const STRIP_H = 12

/* start/end sample index of every run where test(i) is true */
function runs(n: number, test: (i: number) => boolean) {
  const out: [number, number][] = []
  let start = -1

  for (let i = 0; i < n; i++) {
    if (test(i)) {
      if (start < 0) start = i
    } else if (start >= 0) {
      out.push([start, i])
      start = -1
    }
  }

  if (start >= 0) out.push([start, n])

  return out
}

const longest = (r: [number, number][]) =>
  r.reduce((m, [a, b]) => Math.max(m, b - a), 0)

export default function HorizonChart({
  sky,
  siteName,
  monthName,
  isBestMonth,
}: Props) {
  const n = Math.min(sky.sun.length, sky.earth.length)
  const perDay = 24 / sky.stepHours
  const days = n / perDay

  const model = useMemo(() => {
    const innerW = W - LEFT - RIGHT
    const x = (i: number) => LEFT + (i / (n - 1)) * innerW
    const xEnd = (i: number) => LEFT + (i / n) * innerW

    const panel = (values: number[], top: number) => {
      const lo = Math.min(0, ...values)
      const hi = Math.max(0, ...values)
      const pad = Math.max(0.2, (hi - lo) * 0.12)
      const min = lo - pad
      const max = hi + pad
      const y = (v: number) =>
        top + PANEL_H - ((v - min) / (max - min)) * PANEL_H

      const line = values
        .slice(0, n)
        .map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
        .join(' ')

      return { y, line, zero: y(0), min, max }
    }

    const sunUp = (i: number) => sky.sun[i] > 0
    const earthUp = (i: number) => sky.earth[i] > 0
    const bothUp = (i: number) => sunUp(i) && earthUp(i)

    const bothRuns = runs(n, bothUp)

    return {
      x,
      xEnd,
      sunPanel: panel(sky.sun.slice(0, n), 0),
      earthPanel: panel(sky.earth.slice(0, n), PANEL_H + GAP),
      stripTop: (PANEL_H + GAP) * 2,
      bothRuns,
      darkDays: longest(runs(n, (i) => !sunUp(i))) / perDay,
      noEarthDays: longest(runs(n, (i) => !earthUp(i))) / perDay,
      bothDays: longest(bothRuns) / perDay,
    }
  }, [sky, n, perDay])

  const H = (PANEL_H + GAP) * 2 + STRIP_H + 20
  const fmt = (d: number) => (d < 0.05 ? 'none' : `${d.toFixed(1)} days`)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * (days - 1)) + 1)

  return (
    <figure className="hz">
      <figcaption className="hz-head">
        <strong>
          SKY AT {siteName.toUpperCase()} · {monthName}
        </strong>
        <span>{isBestMonth ? 'best month shown (no month chosen yet)' : 'chosen month'}</span>
      </figcaption>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Height of the Sun and the Earth above a flat horizon at ${siteName} in ${monthName}`}
        className="hz-svg"
      >
        {/* SUN panel */}
        <text x={4} y={14} className="hz-label hz-label-sun">SUN</text>
        <text x={4} y={26} className="hz-sub">height °</text>

        <line x1={LEFT} x2={W - RIGHT} y1={model.sunPanel.zero} y2={model.sunPanel.zero} className="hz-horizon" />
        <path d={model.sunPanel.line} className="hz-line hz-line-sun" />

        {/* EARTH panel */}
        <text x={4} y={PANEL_H + GAP + 14} className="hz-label hz-label-earth">EARTH</text>
        <text x={4} y={PANEL_H + GAP + 26} className="hz-sub">height °</text>

        <line x1={LEFT} x2={W - RIGHT} y1={model.earthPanel.zero} y2={model.earthPanel.zero} className="hz-horizon" />
        <path d={model.earthPanel.line} className="hz-line hz-line-earth" />

        {/* above / below strips */}
        <text x={4} y={model.stripTop + 10} className="hz-sub">BOTH UP</text>
        <rect x={LEFT} y={model.stripTop} width={W - LEFT - RIGHT} height={STRIP_H} className="hz-strip-bg" />
        {model.bothRuns.map(([a, b]) => (
          <rect
            key={`b${a}`}
            x={model.x(a)}
            y={model.stripTop}
            width={Math.max(1.5, model.xEnd(b) - model.x(a))}
            height={STRIP_H}
            className="hz-strip-both"
          />
        ))}

        {/* day axis */}
        {ticks.map((d) => (
          <text
            key={d}
            x={LEFT + ((d - 1) / Math.max(1, days - 1)) * (W - LEFT - RIGHT)}
            y={H - 4}
            textAnchor="middle"
            className="hz-sub"
          >
            day {d}
          </text>
        ))}
      </svg>

      <ul className="hz-stats">
        <li>
          <span>Longest time without Sun</span>
          <b>{fmt(model.darkDays)}</b>
        </li>
        <li>
          <span>Longest time without Earth</span>
          <b>{fmt(model.noEarthDays)}</b>
        </li>
        <li>
          <span>Longest time with both up</span>
          <b>{fmt(model.bothDays)}</b>
        </li>
      </ul>

      <p className="hz-note">
        Lines show the top edge of the Sun and of the Earth. Above the dashed
        line (0°) it can be seen. Flat horizon: mountains and crater walls are
        not included, so the real sky is darker. Data: NASA JPL Horizons, 2027.
      </p>
    </figure>
  )
}