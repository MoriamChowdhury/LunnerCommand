import { useEffect, useState } from 'react'

import { SITE_SCIENCE_SOURCE } from '../data/lunarSites'
import { WINDOW_SCIENCE_SOURCE } from '../data/launchWindows'

import './DataSources.css'

/* a small button on every screen that opens an honest list:
   what is NASA data, what is our method, what is a game estimate */
export default function DataSources() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button
        type="button"
        className="ds-open"
        onClick={() => setOpen(true)}
        aria-label="Open data sources"
      >
        ⓘ DATA SOURCES
      </button>

      {open && (
        <div
          className="ds-backdrop"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <section
            className="ds-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Data sources"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="ds-head">
              <div>
                <small>MOONIX</small>
                <h2>What is real NASA data, and what is a game?</h2>
              </div>
              <button
                type="button"
                className="ds-close"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </header>

            <div className="ds-body">
              <h3 className="ds-nasa">NASA AND OFFICIAL DATA</h3>
              <ul>
                <li>
                  <b>Sunlight % and Earth-link %</b> at every site and crater
                  floor: NASA LRO / LOLA polar illumination maps, long-term
                  averages. {SITE_SCIENCE_SOURCE.citation}.{' '}
                  <a href={SITE_SCIENCE_SOURCE.url} target="_blank" rel="noreferrer">
                    NASA PGDA
                  </a>
                </li>
                <li>
                  <b>Sun and Earth height in the sky</b> for {WINDOW_SCIENCE_SOURCE.year}:{' '}
                  {WINDOW_SCIENCE_SOURCE.source}.{' '}
                  <a
                    href="https://ssd.jpl.nasa.gov/horizons/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    JPL Horizons
                  </a>
                </li>
                <li>
                  <b>Site coordinates:</b> IAU / USGS Gazetteer of Planetary
                  Nomenclature.
                </li>
              </ul>

              <h3 className="ds-method">OUR METHOD (made by Team Lunar Odyssey)</h3>
              <ul>
                <li>
                  Horizons gives the <b>season pattern</b> for each month. We scale
                  it so the yearly average matches the NASA LRO / LOLA value
                  (which already includes shadows from mountains). This is a
                  simple model, not an official NASA product.
                </li>
                <li>
                  <b>Site Index</b> = the average of Sun % and Earth-link %.
                </li>
              </ul>

              <h3 className="ds-game">GAME ESTIMATES (not NASA data)</h3>
              <ul>
                <li>
                  Signal strength, oxygen, fuel, crew, radiation and the
                  temperature panels (marked SIMULATED).
                </li>
                <li>Solar activity for each month.</li>
                <li>Terrain, landing risk, costs, mass and the power / radio / safety needs.</li>
                <li>
                  Extra rules on a dark crater floor: colder, riskier landing,
                  more ice, and a science bonus.
                </li>
              </ul>

              <h3 className="ds-limit">LIMITS</h3>
              <ul>
                <li>
                  The sky chart uses a flat horizon. Mountains and crater walls
                  are not included, so the real sky is darker.
                </li>
                <li>
                  On a crater floor the walls hide most of the sky, so the game
                  shows the NASA average instead of a chart.
                </li>
                <li>Moonix is for learning. It is not mission-planning software.</li>
              </ul>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
