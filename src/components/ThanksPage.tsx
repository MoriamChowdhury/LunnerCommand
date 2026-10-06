import {
  countStars,
  findSite,
  findWindow,
  type MissionResult,
} from '../data/missionEngine'

import VoiceControl from './VoiceControl'
import { saidAny, useMissionVoice } from './useMissionVoice'

import './ThanksPage.css'

/* =========================================================
   TYPES
   ========================================================= */

type ThanksPageProps = {
  result: MissionResult
  firstAttempt: boolean
  bonusEarned: number
  totalBonus: number
  onBack: () => void
  onPlayAgain: () => void
}

/* =========================================================
   COMPONENT
   ========================================================= */

export default function ThanksPage({
  result,
  firstAttempt,
  bonusEarned,
  totalBonus,
  onBack,
  onPlayAgain,
}: ThanksPageProps) {
  const site = findSite(result.siteId)
  const win = findWindow(result.windowId)
  const stars = countStars(result, firstAttempt)

  /* ---------------- VOICE ---------------- */

  const intro = `Thank you for playing, Commander! You landed at ${site.name} and earned ${stars} out of 3 stars. Real NASA engineers plan Artemis missions just like you did. See you on the next mission. Bye bye!`

  const handleVoice = (text: string) => {
    if (saidAny(text, ['help', 'what can i say', 'commands'])) {
      speak('You can say: play again, or journal.')
    } else if (saidAny(text, ['play', 'again', 'next mission', 'new mission', 'next'])) {
      onPlayAgain()
    } else if (saidAny(text, ['journal', 'back', 'go back'])) {
      onBack()
    } else if (saidAny(text, ['bye', 'goodbye', 'see you'])) {
      speak('Bye bye, Commander! Come back soon!')
    } else if (saidAny(text, ['thank you', 'thanks'])) {
      speak('You are welcome, Commander! It was fun flying with you.')
    } else {
      speak('Say play again to start a new mission.')
    }
  }

  const voice = useMissionVoice({ onCommand: handleVoice, intro })
  const { speak } = voice
  const voiceHint = 'Say “play again”'

  return (
    <main className="tp-page">
      {/* ===================== BACKGROUND ===================== */}

      <div className="tp-space" aria-hidden="true">
        <div className="tp-stars tp-stars-a" />
        <div className="tp-stars tp-stars-b" />
        <div className="tp-nebula tp-nebula-a" />
        <div className="tp-nebula tp-nebula-b" />
        <div className="tp-earth" />
        <div className="tp-horizon" />
      </div>

      {/* ===================== NAV ===================== */}

      <header className="tp-nav">
        <div className="tp-brand">
          <span className="tp-brand-mark">M</span>
          <span className="tp-brand-copy">
            <strong>MOONIX</strong>
            <small>LUNAR MISSION CONTROL</small>
          </span>
        </div>

        <div className="tp-path">
          <span>MISSION</span>
          <i>/</i>
          <span>{site.code}</span>
          <i>/</i>
          <strong>COMPLETE</strong>
        </div>

        <div className="tp-nav-right">
          <div className="tp-status">
            <span className="tp-status-dot" />
            <span>MISSION COMPLETE</span>
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

      <section className="tp-shell">
        <div className="tp-stage">
          {/* ===================== ASTRONAUT ===================== */}

          <div className="tp-scene">
            <div className="tp-bubble" role="status">
              Bye, Commander! See you on the next mission! 👋
            </div>

            <div
              className="tp-astro"
              role="img"
              aria-label="An astronaut waving goodbye"
            >
              <span className="tp-astro-pack" />
              <span className="tp-astro-leg tp-astro-leg-l" />
              <span className="tp-astro-leg tp-astro-leg-r" />
              <span className="tp-astro-arm tp-astro-arm-l" />
              <span className="tp-astro-body">
                <i className="tp-astro-panel" />
                <i className="tp-astro-flag" />
              </span>
              <span className="tp-astro-arm tp-astro-arm-r">
                <i className="tp-astro-glove" />
              </span>
              <span className="tp-astro-helmet">
                <i className="tp-astro-visor" />
              </span>
            </div>

            <div className="tp-ground" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
          </div>

          {/* ===================== MESSAGE ===================== */}

          <div className="tp-copy">
            <div className="tp-eyebrow">
              <span className="tp-eyebrow-line" />
              <span>MISSION COMPLETE · {site.code}</span>
            </div>

            <h1 className="tp-title">
              Thank You for <span>Playing!</span>
            </h1>

            <p className="tp-lead">
              You planned a real Moon mission — you picked a
              landing site, chose the right equipment and found the
              best time to launch. That is exactly what NASA
              engineers do for the <b>Artemis</b> missions to the
              lunar south pole. Maybe one day it will be you!
            </p>

            <div className="tp-summary">
              <div>
                <small>LANDED AT</small>
                <strong>{site.name}</strong>
                <span>{win.month}</span>
              </div>

              <div>
                <small>STARS</small>
                <strong className="tp-gold">
                  {'★'.repeat(stars)}
                  <em>{'★'.repeat(3 - stars)}</em>
                </strong>
                <span>
                  {firstAttempt ? 'First-try landing' : 'Landed after repairs'}
                </span>
              </div>

              <div>
                <small>BONUS</small>
                <strong className="tp-gold">
                  {bonusEarned ? `+$${bonusEarned}M` : '—'}
                </strong>
                <span>Total saved: ${totalBonus}M</span>
              </div>
            </div>

            <div className="tp-footer">
              <button
                className="tp-back"
                type="button"
                onClick={onBack}
              >
                <span>←</span>
                BACK TO JOURNAL
              </button>

              <button
                className="tp-go is-good"
                type="button"
                onClick={onPlayAgain}
              >
                <span>PLAY NEXT MISSION</span>
                <b>🚀</b>
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
