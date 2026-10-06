import { useEffect, useMemo, useState } from 'react'

import type { CSSProperties } from 'react'

import { MASS_LIMIT } from '../data/equipment'

import {
  evaluateMission,
  findItems,
  findSite,
  findWindow,
  type MissionResult,
} from '../data/missionEngine'

import VoiceControl from './VoiceControl'
import { saidAny, useMissionVoice } from './useMissionVoice'

import './MissionSimulation.css'

/* =========================================================
   TYPES
   ========================================================= */

type MissionSimulationProps = {
  selectedSite: string
  selectedEquipment: string[]
  selectedWindow: string
  budget: number
  onBack: () => void
  onComplete: (result: MissionResult) => void
}

type Status = 'ready' | 'running' | 'landed' | 'aborted'

type PhaseState = 'pending' | 'active' | 'done' | 'failed' | 'skipped'

type CSSVars = CSSProperties &
  Record<`--${string}`, string | number>

/* =========================================================
   CONSTANTS + HELPERS
   ========================================================= */

const MISSION_STEPS = [
  'SITE',
  'EQUIPMENT',
  'LAUNCH WINDOW',
  'MISSION',
  'RESULTS',
]

const PHASES = [
  {
    id: 'deorbit',
    label: 'Deorbit Burn',
    kid: 'The engine fires to slow the lander down, so the Moon’s gravity can pull it out of orbit.',
    alt: [100000, 15000],
    vel: [1680, 600],
    ms: 2200,
  },
  {
    id: 'braking',
    label: 'Braking Burn',
    kid: 'Full engine power! The lander brakes hard, from faster than a jet to much slower.',
    alt: [15000, 2000],
    vel: [600, 120],
    ms: 2200,
  },
  {
    id: 'check',
    label: 'Systems Check',
    kid: 'The computer checks power, radio link and crew safety. If one is too low, it is not safe to land.',
    alt: [2000, 1500],
    vel: [120, 80],
    ms: 2600,
  },
  {
    id: 'pitch',
    label: 'Pitch-Over',
    kid: 'The lander turns upright and scans the ground for big rocks and holes.',
    alt: [1500, 150],
    vel: [80, 15],
    ms: 2000,
  },
  {
    id: 'terminal',
    label: 'Final Descent',
    kid: 'Slowly, slowly… dropping straight down like an elevator. Dust is flying everywhere!',
    alt: [150, 0],
    vel: [15, 1],
    ms: 2000,
  },
]

const CHECK_INDEX = 2

/* what the flight controller says as each phase starts */
const PHASE_CALLOUTS = [
  'Deorbit burn. The engine is firing to slow us down.',
  'Braking burn. Full engine power!',
  'Systems check. Testing power, radio link and crew safety.',
  'All systems go! Pitch over. Scanning the ground for rocks.',
  'Final descent. One hundred meters. Stand by.',
]

const STARTS = PHASES.map((_, i) =>
  PHASES.slice(0, i).reduce((sum, p) => sum + p.ms, 0)
)

const TOTAL_MS = STARTS[STARTS.length - 1] + PHASES[PHASES.length - 1].ms
const ABORT_MS = STARTS[CHECK_INDEX] + PHASES[CHECK_INDEX].ms

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const easeOut = (t: number) => 1 - (1 - t) * (1 - t)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const pad = (n: number) => String(n).padStart(2, '0')

const formatAltitude = (m: number) =>
  m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`

const spokenAltitude = (m: number) =>
  m >= 1000
    ? `${(m / 1000).toFixed(1)} kilometers`
    : `${Math.round(m)} meters`

/* lander height on screen: log scale so the last 100 m still moves */
const altitudeToPercent = (m: number) =>
  (Math.log10(m + 1) / Math.log10(100001)) * 100

/* =========================================================
   COMPONENT
   ========================================================= */

export default function MissionSimulation({
  selectedSite,
  selectedEquipment,
  selectedWindow,
  budget,
  onBack,
  onComplete,
}: MissionSimulationProps) {
  const site = findSite(selectedSite)
  const win = findWindow(selectedWindow)
  const items = findItems(selectedEquipment)

  const result = useMemo(
    () =>
      evaluateMission(
        selectedSite,
        selectedEquipment,
        selectedWindow,
        budget
      ),
    [selectedSite, selectedEquipment, selectedWindow, budget]
  )

  const [status, setStatus] = useState<Status>('ready')
  const [elapsed, setElapsed] = useState(0)

  /* ---------------- DESCENT CLOCK ---------------- */

  useEffect(() => {
    if (status !== 'running') return

    const end = result.success ? TOTAL_MS : ABORT_MS
    const start = performance.now()

    const timer = window.setInterval(() => {
      const now = performance.now() - start

      if (now >= end) {
        window.clearInterval(timer)
        setElapsed(end)
        setStatus(result.success ? 'landed' : 'aborted')
      } else {
        setElapsed(now)
      }
    }, 50)

    return () => window.clearInterval(timer)
  }, [status, result.success])

  /* ---------------- DERIVED ---------------- */

  let phaseIndex = -1
  for (let i = 0; i < PHASES.length; i++) {
    if (status !== 'ready' && elapsed >= STARTS[i]) phaseIndex = i
  }

  const phase = phaseIndex >= 0 ? PHASES[phaseIndex] : null
  const phaseT = phase
    ? clamp01((elapsed - STARTS[phaseIndex]) / phase.ms)
    : 0

  const altitude =
    status === 'landed'
      ? 0
      : phase
        ? lerp(phase.alt[0], phase.alt[1], easeOut(phaseT))
        : PHASES[0].alt[0]

  const velocity =
    status === 'landed'
      ? 0
      : phase
        ? lerp(phase.vel[0], phase.vel[1], easeOut(phaseT))
        : PHASES[0].vel[0]

  const fuelLeft = Math.max(
    0,
    100 - result.fuelUsed * (elapsed / TOTAL_MS)
  )

  const overall = Math.round((elapsed / TOTAL_MS) * 100)

  const checksShown =
    phaseIndex > CHECK_INDEX || status === 'aborted'
      ? 3
      : phaseIndex === CHECK_INDEX
        ? Math.min(3, Math.floor(phaseT * 3.4))
        : 0

  const phaseState = (i: number): PhaseState => {
    if (status === 'ready') return 'pending'
    if (status === 'landed') return 'done'
    if (status === 'aborted') {
      if (i < CHECK_INDEX) return 'done'
      if (i === CHECK_INDEX) return 'failed'
      return 'skipped'
    }
    if (i < phaseIndex) return 'done'
    if (i === phaseIndex) return 'active'
    return 'pending'
  }

  const burning =
    status === 'running' && phaseIndex !== CHECK_INDEX

  const landerTop = 100 - altitudeToPercent(altitude)

  /* ---------------- VOICE ---------------- */

  const handleVoice = (text: string) => {
    if (saidAny(text, ['help', 'what can i say', 'commands'])) {
      speak(
        status === 'ready'
          ? 'You can say: begin landing, status, or back.'
          : status === 'running'
            ? 'The lander is on its way down. Say status to hear the flight data.'
            : 'Say result to continue, or status to hear what happened.'
      )
      return
    }

    if (saidAny(text, ['status', 'report', 'how are we'])) {
      if (status === 'ready') {
        speak(
          `Ready for descent. Target ${site.name}, in ${win.month.toLowerCase()}. ${items.length} modules on board. Say begin landing when you are ready.`
        )
      } else if (status === 'running') {
        speak(
          `Altitude ${spokenAltitude(altitude)}. Speed ${Math.round(velocity)} meters per second. Fuel ${Math.round(fuelLeft)} percent.`
        )
      } else {
        speak(
          status === 'landed'
            ? `We are on the surface of ${site.name}. Fuel left: ${Math.round(fuelLeft)} percent.`
            : `Landing aborted. ${result.shortages.map((s) => `${s.label.toLowerCase()} was ${s.missing} points short`).join('. ')}.`
        )
      }
      return
    }

    if (
      status === 'ready' &&
      saidAny(text, ['begin landing', 'begin', 'land', 'landing', 'start', 'go'])
    ) {
      setStatus('running')
      return
    }

    if (
      (status === 'landed' || status === 'aborted') &&
      saidAny(text, ['result', 'results', 'continue', 'next', 'what went wrong'])
    ) {
      onComplete(result)
      return
    }

    if (status === 'ready' && saidAny(text, ['back', 'go back'])) {
      onBack()
      return
    }

    if (status !== 'running') {
      speak('Sorry, I did not catch that. Say help to hear the commands.')
    }
  }

  const voice = useMissionVoice({
    onCommand: handleVoice,
    intro: `Mission simulation ready. Target: ${site.name}, in ${win.month.toLowerCase()}. Press begin landing, or just say begin landing, when you are ready.`,
  })

  const { speak } = voice

  /* flight controller call-outs during the descent */
  useEffect(() => {
    if (status === 'running' && phaseIndex >= 0) {
      speak(PHASE_CALLOUTS[phaseIndex])
    }

    if (status === 'landed') {
      speak(
        `Touchdown confirmed! Your crew is safely on ${site.name}. Say result to see how you did.`
      )
    }

    if (status === 'aborted') {
      const checks = result.checks
        .map((c) => `${c.label.toLowerCase()}: ${c.ok ? 'go' : 'no go'}`)
        .join('. ')
      speak(
        `${checks}. Landing aborted! The lander is flying back to a safe orbit. The crew is safe. Say result to find out what went wrong.`
      )
    }
  }, [status, phaseIndex, speak, site.name, result])

  /* ---------------- RENDER ---------------- */

  return (
    <main className={`ms-page is-${status}`}>
      {/* ===================== BACKGROUND ===================== */}

      <div className="ms-space" aria-hidden="true">
        <div className="ms-stars ms-stars-a" />
        <div className="ms-stars ms-stars-b" />
        <div className="ms-nebula ms-nebula-a" />
        <div className="ms-nebula ms-nebula-b" />
        <div className="ms-earth" />
        <div className="ms-horizon" />
      </div>

      {/* ===================== NAV ===================== */}

      <header className="ms-nav">
        <button
          className="ms-brand"
          type="button"
          onClick={onBack}
          disabled={status === 'running'}
          aria-label="Return to launch window"
        >
          <span className="ms-brand-mark">M</span>
          <span className="ms-brand-copy">
            <strong>MOONIX</strong>
            <small>LUNAR MISSION CONTROL</small>
          </span>
        </button>

        <div className="ms-path">
          <span>MISSION</span>
          <i>/</i>
          <span>{site.code}</span>
          <i>/</i>
          <strong>LANDING</strong>
        </div>

        <div className="ms-nav-right">
          <div className="ms-status">
            <span className="ms-status-dot" />
            <span>
              {status === 'ready' && 'READY FOR DESCENT'}
              {status === 'running' && 'DESCENT IN PROGRESS'}
              {status === 'landed' && 'TOUCHDOWN CONFIRMED'}
              {status === 'aborted' && 'LANDING ABORTED'}
            </span>
          </div>

          <VoiceControl
            voiceOn={voice.voiceOn}
            isListening={voice.isListening}
            status={voice.status}
            heard={voice.heard}
            hint={
              status === 'ready'
                ? 'Say “begin landing”'
                : status === 'running'
                  ? 'Say “status”'
                  : 'Say “result”'
            }
            onToggle={voice.toggleVoice}
          />
        </div>
      </header>

      {/* ===================== STEPPER ===================== */}

      <div className="ms-stepper">
        {MISSION_STEPS.map((step, index) => (
          <div
            key={step}
            className={`ms-step ${index < 3 ? 'is-done' : ''} ${
              index === 3 ? 'is-active' : ''
            }`}
          >
            <span className="ms-step-num">
              {index < 3 ? '✓' : pad(index + 1)}
            </span>
            <strong>{step}</strong>
            {index < MISSION_STEPS.length - 1 && (
              <span className="ms-step-line">
                <i />
              </span>
            )}
          </div>
        ))}
      </div>

      <section className="ms-shell">
        {/* ===================== HEADING ===================== */}

        <div className="ms-heading">
          <div className="ms-eyebrow">
            <span className="ms-eyebrow-line" />
            <span>PHASE 05 / LANDING</span>
          </div>

          <h1 className="ms-title">
            Mission <span>Simulation</span>
          </h1>

          <p>
            This is the big moment! Press <b>BEGIN LANDING</b> and
            watch your lander fly from orbit down to the Moon. On
            the way, the computer checks if your equipment is
            strong enough to land safely.
          </p>
        </div>

        <div className="ms-grid">
          {/* ===================== LEFT: MISSION DATA ===================== */}

          <div className="ms-col">
            <div className="ms-panel">
              <div className="ms-panel-head">
                <span>01</span>
                <div>
                  <small>LANDING SITE</small>
                  <h2>{site.name}</h2>
                </div>
                <em className={`ms-risk is-${site.risk.toLowerCase()}`}>
                  {site.risk} RISK
                </em>
              </div>

              <dl className="ms-facts">
                <div>
                  <dt>☀ Sunlight</dt>
                  <dd>{site.sunlight}%</dd>
                </div>
                <div>
                  <dt>🌡 Temperature</dt>
                  <dd>{site.temperature}</dd>
                </div>
                <div>
                  <dt>🧊 Ice</dt>
                  <dd>{site.ice}</dd>
                </div>
                <div>
                  <dt>⛰ Ground</dt>
                  <dd>{site.terrain}</dd>
                </div>
              </dl>
            </div>

            <div className="ms-panel">
              <div className="ms-panel-head">
                <span>02</span>
                <div>
                  <small>LAUNCH WINDOW</small>
                  <h2>{win.month}</h2>
                </div>
              </div>

              <dl className="ms-facts">
                <div>
                  <dt>☀ Sun up</dt>
                  <dd>{win.sun}%</dd>
                </div>
                <div>
                  <dt>🌍 Earth visible</dt>
                  <dd>{win.earth}%</dd>
                </div>
              </dl>
              <p className="ms-note">{win.note}</p>
            </div>

            <div className="ms-panel">
              <div className="ms-panel-head">
                <span>03</span>
                <div>
                  <small>PAYLOAD</small>
                  <h2>{items.length} modules on board</h2>
                </div>
              </div>

              <div className="ms-payload">
                {items.length ? (
                  items.map((item) => (
                    <span
                      key={item.id}
                      style={{ '--accent': item.color } as CSSVars}
                      title={item.name}
                    >
                      <b>{item.icon}</b>
                      {item.shortName}
                    </span>
                  ))
                ) : (
                  <em>No modules installed</em>
                )}
              </div>

              <div className="ms-budget">
                <div>
                  <small>SPENT</small>
                  <strong>
                    ${result.spent}M<em> / ${budget}M</em>
                  </strong>
                </div>
                <div>
                  <small>MASS</small>
                  <strong>
                    {result.massUsed}
                    <em> / {MASS_LIMIT} kg</em>
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* ===================== CENTER: DESCENT VIEW ===================== */}

          <div className="ms-col ms-col-center">
            <div className="ms-panel ms-view">
              <div className="ms-view-scale" aria-hidden="true">
                <span>100 km</span>
                <span>10 km</span>
                <span>1 km</span>
                <span>100 m</span>
                <span>0</span>
              </div>

              <div className="ms-view-stage">
                <div
                  className={`ms-lander ${burning ? 'is-burning' : ''}`}
                  style={{ top: `${Math.min(88, landerTop)}%` }}
                  aria-label={`Lander altitude ${formatAltitude(altitude)}`}
                >
                  <span className="ms-lander-body" />
                  <span className="ms-lander-legs" />
                  <span className="ms-flame" />
                </div>

                {status === 'landed' && (
                  <div className="ms-dust" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </div>
                )}

                <div className="ms-surface" />
              </div>

              <div className="ms-now">
                {status === 'ready' && (
                  <>
                    <small>WAITING</small>
                    <p>
                      Your lander is circling the Moon 100 km up.
                      When you are ready, start the landing.
                    </p>
                  </>
                )}

                {status === 'running' && phase && (
                  <>
                    <small>
                      NOW: {phase.label.toUpperCase()}
                    </small>
                    <p>{phase.kid}</p>
                  </>
                )}

                {status === 'landed' && (
                  <>
                    <small className="is-good">
                      ✓ TOUCHDOWN CONFIRMED
                    </small>
                    <p>
                      “The Eagle has landed” — and so have you!
                      Your crew is safely on {site.name}.
                    </p>
                  </>
                )}

                {status === 'aborted' && (
                  <>
                    <small className="is-bad">
                      ✕ LANDING ABORTED
                    </small>
                    <p>
                      The systems check found a problem, so the
                      lander flew back up to a safe orbit. Nobody
                      got hurt — let’s find out what went wrong.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ===================== RIGHT: TELEMETRY ===================== */}

          <div className="ms-col">
            <div className="ms-panel">
              <div className="ms-panel-head">
                <span>04</span>
                <div>
                  <small>TELEMETRY = LIVE DATA FROM THE LANDER</small>
                  <h2>Flight Data</h2>
                </div>
                {status === 'running' && (
                  <span className="ms-live">
                    <i />
                    LIVE
                  </span>
                )}
              </div>

              <div className="ms-cards">
                <div className="ms-card">
                  <small>ALTITUDE</small>
                  <strong>{formatAltitude(altitude)}</strong>
                  <div className="ms-bar">
                    <i
                      style={{
                        width: `${altitudeToPercent(altitude)}%`,
                        background: 'var(--ms-cyan)',
                      }}
                    />
                  </div>
                  <span>Height above the ground</span>
                </div>

                <div className="ms-card">
                  <small>SPEED</small>
                  <strong>{Math.round(velocity)} m/s</strong>
                  <div className="ms-bar">
                    <i
                      style={{
                        width: `${(velocity / 1680) * 100}%`,
                        background: 'var(--ms-violet)',
                      }}
                    />
                  </div>
                  <span>Must be almost 0 to land</span>
                </div>

                <div className="ms-card">
                  <small>FUEL</small>
                  <strong>{Math.round(fuelLeft)}%</strong>
                  <div className="ms-bar">
                    <i
                      style={{
                        width: `${fuelLeft}%`,
                        background: 'var(--ms-gold)',
                      }}
                    />
                  </div>
                  <span>Heavier landers burn more</span>
                </div>
              </div>
            </div>

            <div className="ms-panel">
              <div className="ms-panel-head">
                <span>05</span>
                <div>
                  <small>GO / NO-GO</small>
                  <h2>Systems Check</h2>
                </div>
              </div>

              <ul className="ms-checks">
                {result.checks.map((check, i) => {
                  const shown = i < checksShown
                  const pct = Math.min(
                    100,
                    (check.have / Math.max(1, check.need * 1.5)) * 100
                  )
                  const needPct = (1 / 1.5) * 100

                  return (
                    <li
                      key={check.key}
                      className={
                        shown ? (check.ok ? 'is-ok' : 'is-bad') : ''
                      }
                    >
                      <div className="ms-check-top">
                        <span>
                          {check.icon} {check.label}
                        </span>
                        <strong>
                          {shown
                            ? `${check.have} / ${check.need} ${
                                check.ok ? '✓' : '✕'
                              }`
                            : 'WAITING…'}
                        </strong>
                      </div>

                      <div className="ms-bar ms-bar-need">
                        <i style={{ width: shown ? `${pct}%` : '0%' }} />
                        <b style={{ left: `${needPct}%` }} />
                      </div>

                      {shown && <p>{check.explain}</p>}
                    </li>
                  )
                })}
              </ul>

              <p className="ms-hint">
                The white line on each bar is the minimum needed.
              </p>
            </div>
          </div>
        </div>

        {/* ===================== DESCENT TIMELINE ===================== */}

        <div className="ms-panel ms-timeline-panel">
          <div className="ms-panel-head">
            <span>06</span>
            <div>
              <small>FROM ORBIT TO SURFACE</small>
              <h2>Descent Timeline</h2>
            </div>
            <strong className="ms-overall">{overall}%</strong>
          </div>

          <div className="ms-bar ms-bar-overall">
            <i
              className={status === 'aborted' ? 'is-bad' : ''}
              style={{ width: `${overall}%` }}
            />
          </div>

          <ol className="ms-timeline">
            {PHASES.map((p, i) => (
              <li key={p.id} className={`is-${phaseState(i)}`}>
                <span className="ms-node">
                  {phaseState(i) === 'done'
                    ? '✓'
                    : phaseState(i) === 'failed'
                      ? '✕'
                      : pad(i + 1)}
                </span>
                <strong>{p.label}</strong>
                <small>
                  {formatAltitude(p.alt[0])} →{' '}
                  {formatAltitude(p.alt[1])}
                </small>
              </li>
            ))}

            <li
              className={`is-${
                status === 'landed'
                  ? 'done'
                  : status === 'aborted'
                    ? 'skipped'
                    : 'pending'
              }`}
            >
              <span className="ms-node">
                {status === 'landed' ? '✓' : '⌂'}
              </span>
              <strong>Touchdown</strong>
              <small>On the Moon!</small>
            </li>
          </ol>
        </div>

        {/* ===================== FOOTER ===================== */}

        <div className="ms-footer">
          <button
            className="ms-back"
            type="button"
            onClick={onBack}
            disabled={status !== 'ready'}
          >
            <span>←</span>
            BACK TO LAUNCH WINDOW
          </button>

          {status === 'ready' && (
            <button
              className="ms-go"
              type="button"
              onClick={() => setStatus('running')}
            >
              <span>BEGIN LANDING</span>
              <b>▼</b>
            </button>
          )}

          {status === 'running' && (
            <div className="ms-go is-busy" aria-live="polite">
              <span>LANDING… {overall}%</span>
              <b className="ms-spinner" />
            </div>
          )}

          {status === 'landed' && (
            <button
              className="ms-go is-good"
              type="button"
              onClick={() => onComplete(result)}
            >
              <span>SEE MISSION RESULT</span>
              <b>→</b>
            </button>
          )}

          {status === 'aborted' && (
            <button
              className="ms-go is-bad"
              type="button"
              onClick={() => onComplete(result)}
            >
              <span>FIND OUT WHAT WENT WRONG</span>
              <b>→</b>
            </button>
          )}
        </div>
      </section>
    </main>
  )
}
