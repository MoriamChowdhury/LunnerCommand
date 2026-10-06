import {
  countStars,
  findSite,
  findWindow,
  type MissionResult,
} from '../data/missionEngine'

import VoiceControl from './VoiceControl'
import { saidAny, useMissionVoice } from './useMissionVoice'

import './MissionSuccess.css'

/* =========================================================
   TYPES
   ========================================================= */

type MissionSuccessProps = {
  result: MissionResult
  firstAttempt: boolean
  /* bonus earned on this mission ($M), 0 after a repair */
  bonusEarned: number
  /* all permanent bonus saved so far ($M) */
  totalBonus: number
  onContinue: () => void
}

/* =========================================================
   CONSTANTS
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

const pad = (n: number) => String(n).padStart(2, '0')

/* =========================================================
   COMPONENT
   ========================================================= */

export default function MissionSuccess({
  result,
  firstAttempt,
  bonusEarned,
  totalBonus,
  onContinue,
}: MissionSuccessProps) {
  const site = findSite(result.siteId)
  const win = findWindow(result.windowId)
  const stars = countStars(result, firstAttempt)

  /* ---------------- VOICE ---------------- */

  const intro = `Congratulations, Commander! Touchdown confirmed at ${site.name}. You earned ${stars} out of 3 stars. ${
    firstAttempt && bonusEarned > 0
      ? `First try bonus unlocked! ${bonusEarned} million dollars will be added to your budget for every future mission.`
      : 'You fixed the problems and still landed. Great engineering! The first try bonus is only for landings with no repairs.'
  } Say continue to see your results.`

  const handleVoice = (text: string) => {
    if (saidAny(text, ['help', 'what can i say', 'commands'])) {
      speak('You can say: continue, repeat, or bonus.')
    } else if (saidAny(text, ['continue', 'next', 'results', 'result', 'summary'])) {
      onContinue()
    } else if (saidAny(text, ['repeat', 'again', 'say that again'])) {
      speak(intro)
    } else if (saidAny(text, ['bonus', 'money', 'budget'])) {
      speak(
        bonusEarned > 0
          ? `You earned ${bonusEarned} million dollars. Your total saved bonus is now ${totalBonus} million dollars.`
          : `No bonus this time, because the lander needed repairs. Your saved bonus is ${totalBonus} million dollars.`
      )
    } else {
      speak('Sorry, I did not catch that. Say continue to see your results.')
    }
  }

  const voice = useMissionVoice({ onCommand: handleVoice, intro })
  const { speak } = voice
  const voiceHint = 'Say “continue”'

  return (
    <main className="sc-page">
      {/* ===================== BACKGROUND ===================== */}

      <div className="sc-space" aria-hidden="true">
        <div className="sc-stars sc-stars-a" />
        <div className="sc-stars sc-stars-b" />
        <div className="sc-nebula sc-nebula-a" />
        <div className="sc-nebula sc-nebula-b" />
        <div className="sc-confetti">
          {Array.from({ length: 24 }).map((_, i) => (
            <i
              key={i}
              style={{
                left: `${(i * 41) % 100}%`,
                animationDelay: `${(i % 8) * 0.45}s`,
                animationDuration: `${5 + (i % 5)}s`,
              }}
            />
          ))}
        </div>
        <div className="sc-horizon" />
      </div>

      {/* ===================== NAV ===================== */}

      <header className="sc-nav">
        <div className="sc-brand">
          <span className="sc-brand-mark">M</span>
          <span className="sc-brand-copy">
            <strong>MOONIX</strong>
            <small>LUNAR MISSION CONTROL</small>
          </span>
        </div>

        <div className="sc-path">
          <span>MISSION</span>
          <i>/</i>
          <span>{site.code}</span>
          <i>/</i>
          <strong>SUCCESS</strong>
        </div>

        <div className="sc-nav-right">
          <div className="sc-status">
            <span className="sc-status-dot" />
            <span>TOUCHDOWN CONFIRMED</span>
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

      <div className="sc-stepper">
        {MISSION_STEPS.map((step, index) => (
          <div
            key={step}
            className={`sc-step ${index < 4 ? 'is-done' : 'is-active'}`}
          >
            <span className="sc-step-num">
              {index < 4 ? '✓' : pad(index + 1)}
            </span>
            <strong>{step}</strong>
            {index < MISSION_STEPS.length - 1 && (
              <span className="sc-step-line">
                <i />
              </span>
            )}
          </div>
        ))}
      </div>

      <section className="sc-shell">
        <ol className="sc-trail">
          {DEBRIEF_STEPS.map((step, i) => (
            <li key={step} className={i === 0 ? 'is-active' : ''}>
              <b>{i + 1}</b>
              {step}
            </li>
          ))}
        </ol>

        {/* ===================== HERO ===================== */}

        <div className="sc-hero">
          <div className="sc-badge" aria-hidden="true">
            <span>🌕</span>
          </div>

          <div className="sc-eyebrow">
            <span className="sc-eyebrow-line" />
            <span>
              {site.code} · {win.month} · TOUCHDOWN CONFIRMED
            </span>
          </div>

          <h1 className="sc-title">
            Congratulations, <span>Commander!</span>
          </h1>

          <p className="sc-lead">
            Your lander touched down safely on{' '}
            <b>{site.name}</b>. The crew is on the Moon and
            ready to start exploring. Great planning!
          </p>

          <div
            className="sc-stars-row"
            aria-label={`${stars} out of 3 stars`}
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={i < stars ? 'is-on' : ''}
                style={{ animationDelay: `${0.3 + i * 0.25}s` }}
              >
                ★
              </span>
            ))}
          </div>

          <ul className="sc-star-keys">
            <li className="is-on">★ Landed safely</li>
            <li className={firstAttempt ? 'is-on' : ''}>
              ★ Landed on the first try
            </li>
            <li
              className={
                result.science >= result.scienceGoal ? 'is-on' : ''
              }
            >
              ★ Science goal ({result.scienceGoal}+ points)
            </li>
          </ul>
        </div>

        {/* ===================== BONUS ===================== */}

        {firstAttempt && bonusEarned > 0 ? (
          <div className="sc-panel sc-bonus">
            <div className="sc-bonus-coin" aria-hidden="true">
              $
            </div>
            <div>
              <small>FIRST-TRY BONUS UNLOCKED</small>
              <strong>+${bonusEarned}M</strong>
              <p>
                You landed without any repairs! Mission control
                is adding <b>${bonusEarned} million</b> to your
                budget for every future mission. That means you
                can buy more equipment next time.
              </p>
              <span className="sc-bonus-total">
                TOTAL SAVED BONUS: ${totalBonus}M
              </span>
            </div>
          </div>
        ) : (
          <div className="sc-panel sc-nobonus">
            <span aria-hidden="true">🔧</span>
            <div>
              <small>LANDED AFTER REPAIRS</small>
              <p>
                You fixed the problems and still made it — that is
                what real engineers do! The first-try bonus is only
                for landings with no repairs. Plan carefully next
                time to win it.
              </p>
              {totalBonus > 0 && (
                <span className="sc-bonus-total">
                  YOUR SAVED BONUS IS SAFE: ${totalBonus}M
                </span>
              )}
            </div>
          </div>
        )}

        {/* ===================== QUICK LOOK ===================== */}

        <div className="sc-quick">
          <div className="sc-panel">
            <small>⛽ FUEL LEFT</small>
            <strong>{100 - result.fuelUsed}%</strong>
            <span>Fuel still in the tanks after landing</span>
          </div>

          <div className="sc-panel">
            <small>🎯 LANDING ACCURACY</small>
            <strong>
              {result.landingOffset} m
              <em className={`is-${result.landingGrade}`}>
                {result.landingGrade}
              </em>
            </strong>
            <span>How far from the target spot you landed</span>
          </div>

          <div className="sc-panel">
            <small>🔬 SCIENCE</small>
            <strong>{result.science} pts</strong>
            <span>Discoveries your equipment can make</span>
          </div>
        </div>

        {/* ===================== FOOTER ===================== */}

        <div className="sc-footer">
          <p className="sc-next-hint">
            Next: see the full results of your mission.
          </p>

          <button
            className="sc-go is-good"
            type="button"
            onClick={onContinue}
          >
            <span>SEE RESULTS SUMMARY</span>
            <b>→</b>
          </button>
        </div>
      </section>
    </main>
  )
}
