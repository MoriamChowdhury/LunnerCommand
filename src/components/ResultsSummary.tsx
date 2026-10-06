import type { CSSProperties } from 'react'

import { MASS_LIMIT } from '../data/equipment'

import {
  findSite,
  findWindow,
  type EquipmentRating,
  type MissionResult,
} from '../data/missionEngine'

import VoiceControl from './VoiceControl'
import { saidAny, useMissionVoice } from './useMissionVoice'

import './ResultsSummary.css'

/* =========================================================
   TYPES
   ========================================================= */

type ResultsSummaryProps = {
  result: MissionResult
  firstAttempt: boolean
  attempts: number
  onBack: () => void
  onContinue: () => void
}

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

const DEBRIEF_STEPS = [
  'CONGRATULATIONS',
  'RESULTS',
  'WHAT YOU LEARNED',
  'JOURNAL',
]

const RATING_LABEL: Record<EquipmentRating, string> = {
  saver: '★ MISSION SAVER',
  helper: '✓ GOOD SUPPORT',
  science: '🔬 SCIENCE BOOSTER',
  extra: '＋ EXTRA BACKUP',
}

const pad = (n: number) => String(n).padStart(2, '0')

function fuelNote(fuelUsed: number) {
  if (fuelUsed < 70) return 'Great! A light lander needs less fuel to slow down.'
  if (fuelUsed < 82) return 'Good. Some fuel is left over for emergencies.'
  return 'Close call! A heavy lander burns lots of fuel. Try carrying less next time.'
}

function landingNote(grade: 'A' | 'B' | 'C') {
  if (grade === 'A') return 'Bullseye! Smooth ground and a strong radio link helped you land right on target.'
  if (grade === 'B') return 'Nice landing. Rough ground made the lander dodge a few rocks.'
  return 'You made it, but rocky ground pushed you far from the target spot.'
}

/* =========================================================
   COMPONENT
   ========================================================= */

export default function ResultsSummary({
  result,
  firstAttempt,
  attempts,
  onBack,
  onContinue,
}: ResultsSummaryProps) {
  const site = findSite(result.siteId)
  const win = findWindow(result.windowId)

  const budgetPct = Math.round((result.spent / result.budget) * 100)
  const massPct = Math.round((result.massUsed / MASS_LIMIT) * 100)
  const scienceOk = result.science >= result.scienceGoal

  /* ---------------- VOICE ---------------- */

  const intro = `Here is your mission report card. Your goal was to land safely at ${site.name}. ${result.checks
    .map((c) => `${c.label.toLowerCase()}: ${c.have} out of ${c.need} needed`)
    .join('. ')}. Science: ${result.science} points. You used ${result.fuelUsed} percent of your fuel and got landing grade ${result.landingGrade}. Say efficiency to hear more, or next to continue.`

  const efficiencyLine = () => {
    const savers = result.performance
      .filter((p) => p.rating === 'saver')
      .map((p) => p.item.shortName)

    return `${fuelNote(result.fuelUsed)} ${landingNote(result.landingGrade)} You spent ${result.spent} million of your ${result.budget} million dollars, and the lander weighed ${result.massUsed} kilograms. ${
      savers.length
        ? `Your mission savers were: ${savers.join(', ')}.`
        : 'Every module helped a little, and none was the only thing keeping you safe.'
    }`
  }

  const handleVoice = (text: string) => {
    if (saidAny(text, ['help', 'what can i say', 'commands'])) {
      speak('You can say: efficiency, repeat, next, or back.')
    } else if (saidAny(text, ['efficiency', 'details', 'fuel', 'more'])) {
      speak(efficiencyLine())
    } else if (saidAny(text, ['next', 'continue', 'learned', 'learn'])) {
      onContinue()
    } else if (saidAny(text, ['back', 'go back'])) {
      onBack()
    } else if (saidAny(text, ['repeat', 'again', 'read'])) {
      speak(intro)
    } else {
      speak('Sorry, I did not catch that. Say help to hear the commands.')
    }
  }

  const voice = useMissionVoice({ onCommand: handleVoice, intro })
  const { speak } = voice
  const voiceHint = 'Say “efficiency” or “next”'

  return (
    <main className="rs-page">
      {/* ===================== BACKGROUND ===================== */}

      <div className="rs-space" aria-hidden="true">
        <div className="rs-stars rs-stars-a" />
        <div className="rs-stars rs-stars-b" />
        <div className="rs-nebula rs-nebula-a" />
        <div className="rs-nebula rs-nebula-b" />
        <div className="rs-horizon" />
      </div>

      {/* ===================== NAV ===================== */}

      <header className="rs-nav">
        <div className="rs-brand">
          <span className="rs-brand-mark">M</span>
          <span className="rs-brand-copy">
            <strong>MOONIX</strong>
            <small>LUNAR MISSION CONTROL</small>
          </span>
        </div>

        <div className="rs-path">
          <span>MISSION</span>
          <i>/</i>
          <span>{site.code}</span>
          <i>/</i>
          <strong>RESULTS</strong>
        </div>

        <div className="rs-nav-right">
          <div className="rs-status">
            <span className="rs-status-dot" />
            <span>MISSION DEBRIEF</span>
          </div>

          <VoiceControl
            voiceOn={voice.voiceOn}
            isListening={voice.isListening}
            status={voice.status}
            heard={voice.heard}
            hint={voiceHint}
            onToggle={voice.toggleVoice}
          />
        </div>
      </header>

      {/* ===================== STEPPER ===================== */}

      <div className="rs-stepper">
        {MISSION_STEPS.map((step, index) => (
          <div
            key={step}
            className={`rs-step ${index < 4 ? 'is-done' : 'is-active'}`}
          >
            <span className="rs-step-num">
              {index < 4 ? '✓' : pad(index + 1)}
            </span>
            <strong>{step}</strong>
            {index < MISSION_STEPS.length - 1 && (
              <span className="rs-step-line">
                <i />
              </span>
            )}
          </div>
        ))}
      </div>

      <section className="rs-shell">
        <ol className="rs-trail">
          {DEBRIEF_STEPS.map((step, i) => (
            <li
              key={step}
              className={
                i < 1 ? 'is-done' : i === 1 ? 'is-active' : ''
              }
            >
              <b>{i < 1 ? '✓' : i + 1}</b>
              {step}
            </li>
          ))}
        </ol>

        {/* ===================== HEADING ===================== */}

        <div className="rs-heading">
          <div className="rs-eyebrow">
            <span className="rs-eyebrow-line" />
            <span>
              {site.code} · {win.month} · REPORT CARD
            </span>
          </div>

          <h1 className="rs-title">
            Results <span>Summary</span>
          </h1>

          <p>
            Here is your mission report card: what you were asked
            to do, what you achieved, and how well you used your
            fuel, money and equipment.
          </p>
        </div>

        <div className="rs-grid">
          {/* ===================== OBJECTIVE ===================== */}

          <div className="rs-panel">
            <div className="rs-panel-head">
              <span>01</span>
              <div>
                <small>WHAT YOU HAD TO DO</small>
                <h2>Mission Objective</h2>
              </div>
            </div>

            <p className="rs-objective">
              🎯 Land safely at <b>{site.name}</b> in{' '}
              <b>{win.month.toLowerCase()}</b> and set up a base
              with enough power, a clear radio link to Earth, and
              a safe home for the crew.
            </p>

            <ul className="rs-goals">
              {result.checks.map((check) => (
                <li key={check.key}>
                  <span>{check.icon}</span>
                  {check.label} at least <b>{check.need}</b>
                </li>
              ))}
              <li className="is-bonus">
                <span>🔬</span>
                Bonus goal: science at least{' '}
                <b>{result.scienceGoal}</b>
              </li>
            </ul>
          </div>

          {/* ===================== ACHIEVED ===================== */}

          <div className="rs-panel">
            <div className="rs-panel-head">
              <span>02</span>
              <div>
                <small>WHAT YOU DID</small>
                <h2>Achievements</h2>
              </div>
            </div>

            <ul className="rs-achieved">
              {result.checks.map((check) => (
                <li
                  key={check.key}
                  className={check.ok ? 'is-ok' : 'is-bad'}
                  style={{ '--accent': check.color } as CSSVars}
                >
                  <div className="rs-achieved-top">
                    <span>
                      {check.icon} {check.label}
                    </span>
                    <strong>
                      {check.have} / {check.need}{' '}
                      {check.ok ? '✓' : '✕'}
                    </strong>
                  </div>
                  <div className="rs-bar">
                    <i
                      style={{
                        width: `${Math.min(100, (check.have / (check.need * 1.5)) * 100)}%`,
                      }}
                    />
                  </div>
                </li>
              ))}

              <li
                className={scienceOk ? 'is-ok' : 'is-soft'}
                style={{ '--accent': '#b99cff' } as CSSVars}
              >
                <div className="rs-achieved-top">
                  <span>🔬 SCIENCE</span>
                  <strong>
                    {result.science} / {result.scienceGoal}{' '}
                    {scienceOk ? '✓' : '—'}
                  </strong>
                </div>
                <div className="rs-bar">
                  <i
                    style={{
                      width: `${Math.min(100, (result.science / (result.scienceGoal * 1.5)) * 100)}%`,
                    }}
                  />
                </div>
              </li>
            </ul>

            <div className="rs-attempts">
              {firstAttempt ? (
                <>
                  <b>🏅 First try!</b> You landed without any
                  repairs.
                </>
              ) : (
                <>
                  <b>🔧 Landed after {attempts - 1} repair
                  {attempts - 1 === 1 ? '' : 's'}.</b> Fixing
                  problems is a real engineering skill!
                </>
              )}
            </div>
          </div>
        </div>

        {/* ===================== EFFICIENCY ===================== */}

        <div className="rs-panel rs-efficiency">
          <div className="rs-panel-head">
            <span>03</span>
            <div>
              <small>HOW WELL YOU USED WHAT YOU HAD</small>
              <h2>Efficiency Notes</h2>
            </div>
          </div>

          <div className="rs-eff-grid">
            <div className="rs-eff">
              <small>⛽ FUEL USE</small>
              <strong>
                {result.fuelUsed}%<em> used</em>
              </strong>
              <div className="rs-bar">
                <i
                  style={{
                    width: `${result.fuelUsed}%`,
                    background: 'var(--rs-gold)',
                  }}
                />
              </div>
              <p>{fuelNote(result.fuelUsed)}</p>
            </div>

            <div className="rs-eff">
              <small>🎯 LANDING PRECISION</small>
              <strong>
                {result.landingOffset} m
                <em className={`rs-grade is-${result.landingGrade}`}>
                  GRADE {result.landingGrade}
                </em>
              </strong>
              <div className="rs-bar">
                <i
                  style={{
                    width: `${Math.max(8, 100 - result.landingOffset)}%`,
                    background: 'var(--rs-cyan)',
                  }}
                />
              </div>
              <p>{landingNote(result.landingGrade)}</p>
            </div>

            <div className="rs-eff">
              <small>💰 BUDGET</small>
              <strong>
                ${result.spent}M<em> of ${result.budget}M</em>
              </strong>
              <div className="rs-bar">
                <i
                  style={{
                    width: `${budgetPct}%`,
                    background: 'var(--rs-green)',
                  }}
                />
              </div>
              <p>
                You used {budgetPct}% of your money
                {budgetPct < 80
                  ? ' and saved some for later.'
                  : ' — almost everything!'}
              </p>
            </div>

            <div className="rs-eff">
              <small>⚖ LANDER MASS</small>
              <strong>
                {result.massUsed} kg<em> of {MASS_LIMIT}</em>
              </strong>
              <div className="rs-bar">
                <i
                  style={{
                    width: `${massPct}%`,
                    background: 'var(--rs-violet)',
                  }}
                />
              </div>
              <p>
                Heavier landers need more fuel. You filled{' '}
                {massPct}% of the space.
              </p>
            </div>
          </div>

          <h3 className="rs-sub">Equipment performance</h3>

          <ul className="rs-perf">
            {result.performance.map((perf) => (
              <li
                key={perf.item.id}
                style={{ '--accent': perf.item.color } as CSSVars}
              >
                <span className="rs-perf-icon">{perf.item.icon}</span>
                <div>
                  <strong>{perf.item.shortName}</strong>
                  <p>{perf.note}</p>
                </div>
                <div className="rs-perf-side">
                  <em className={`rs-rating is-${perf.rating}`}>
                    {RATING_LABEL[perf.rating]}
                  </em>
                  {perf.item.sunDependent && (
                    <small>Working at {perf.efficiency}%</small>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* ===================== FOOTER ===================== */}

        <div className="rs-footer">
          <button className="rs-back" type="button" onClick={onBack}>
            <span>←</span>
            BACK
          </button>

          <button
            className="rs-go is-good"
            type="button"
            onClick={onContinue}
          >
            <span>WHAT YOU LEARNED</span>
            <b>→</b>
          </button>
        </div>
      </section>
    </main>
  )
}
