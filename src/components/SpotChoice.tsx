import { SUN_USABLE, type LunarSite, type Spot } from '../data/lunarSites'

import './SpotChoice.css'

type Props = {
  /* the site (rim numbers) */
  site: LunarSite
  spot: Spot
  onChange: (spot: Spot) => void
}

export default function SpotChoice({ site, spot, onChange }: Props) {
  const darkFloor = site.floorSun < SUN_USABLE

  return (
    <section className="sc-box" aria-label="Choose the landing spot">
      <header className="sc-head">
        <small>LANDING SPOT</small>
        <strong>Where on {site.name} will you land?</strong>
      </header>

      <div className="sc-grid">
        <button
          type="button"
          className={`sc-card ${spot === 'rim' ? 'is-on' : ''}`}
          aria-pressed={spot === 'rim'}
          onClick={() => onChange('rim')}
        >
          <b>RIM</b>
          <span className="sc-nasa">
            ☀ {site.sunlight}% · ⌁ {site.communication}%
          </span>
          <em>
            The best-lit spot on the crater. Easier power and a better radio
            link.
          </em>
        </button>

        <button
          type="button"
          className={`sc-card ${spot === 'floor' ? 'is-on' : ''}`}
          aria-pressed={spot === 'floor'}
          onClick={() => onChange('floor')}
        >
          <b>FLOOR</b>
          <span className="sc-nasa">
            ☀ {site.floorSun}% · ⌁ {site.floorEarth}%
          </span>
          <em>
            {darkFloor
              ? 'The dark crater floor. Much colder and riskier, but this is where the ice is. Solar panels will make almost nothing, so plan for nuclear power.'
              : 'The crater centre. Less sunlight than the rim, but still workable.'}
          </em>
        </button>
      </div>

      <p className="sc-note">
        ☀ Sun and ⌁ Earth link are NASA LRO/LOLA long-term averages. The extra
        cold, landing risk and ice science on a dark floor are game rules.
      </p>
    </section>
  )
}
