import { lunarSites } from '../data/lunarSites'

import {
  findItems,
  findSite,
  findWindow,
  solarFactor,
  parseTemperature,
  type MissionResult,
  type Shortage,
} from '../data/missionEngine'

import VoiceControl from './VoiceControl'
import { saidAny, useMissionVoice } from './useMissionVoice'

import './WhatYouLearned.css'

/* =========================================================
   TYPES
   ========================================================= */

type WhatYouLearnedProps = {
  result: MissionResult
  firstAttempt: boolean
  /* problems found on the first landing try (empty if none) */
  initialShortages: Shortage[]
  onBack: () => void
  onContinue: () => void
}

type LessonKind = 'good' | 'tradeoff' | 'improve' | 'fact'

type Lesson = {
  kind: LessonKind
  title: string
  text: string
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

const KIND_META: Record<
  LessonKind,
  { icon: string; label: string }
> = {
  good: { icon: '✓', label: 'WHAT WORKED WELL' },
  tradeoff: { icon: '⚖', label: 'THE TRADE-OFF' },
  improve: { icon: '↑', label: 'HOW TO IMPROVE' },
  fact: { icon: '🚀', label: 'REAL NASA FACT' },
}

const pad = (n: number) => String(n).padStart(2, '0')

/* =========================================================
   LESSON BUILDER
   Looks at the player's own choices and picks one short,
   specific lesson for each kind.
   ========================================================= */

function buildLessons(
  result: MissionResult,
  firstAttempt: boolean,
  initialShortages: Shortage[]
): Lesson[] {
  const site = findSite(result.siteId)
  const win = findWindow(result.windowId)
  const items = findItems(result.equipmentIds)
  const has = (id: string) => result.equipmentIds.includes(id)
  const cold = parseTemperature(site.temperature) <= -100
  const sunPct = Math.round(solarFactor(site, win) * 100)

  const lessons: Lesson[] = []

  /* ---------- 1. what worked ---------- */

  if (has('battery') && (site.sunlight < 80 || win.sun < 60)) {
    lessons.push({
      kind: 'good',
      title: 'Battery for the dark',
      text: `${site.name} gets only ${site.sunlight}% sunlight. Your battery bank stored energy, so the base kept running when the Sun went down.`,
    })
  } else if (has('comms') && site.communication < 90) {
    lessons.push({
      kind: 'good',
      title: 'Strong radio link',
      text: `Mountains around ${site.name} can block Earth. Your relay antenna kept the crew talking to mission control.`,
    })
  } else if (has('thermal') && cold) {
    lessons.push({
      kind: 'good',
      title: 'Staying warm',
      text: `At ${site.temperature}, it is colder than anywhere on Earth. Your thermal shield kept the crew and computers warm.`,
    })
  } else if (has('solar') && sunPct >= 75) {
    lessons.push({
      kind: 'good',
      title: 'Sunny choice',
      text: `${site.name} in ${win.month.toLowerCase()} is a sunny combo. Your solar array worked at ${sunPct}% — lots of free energy!`,
    })
  } else {
    const saver = result.performance.find((p) => p.rating === 'saver')
    lessons.push({
      kind: 'good',
      title: saver ? `${saver.item.shortName} saved the day` : 'Smart site choice',
      text: saver
        ? `${saver.note} Picking it was a great decision.`
        : `${site.name} was a good choice: ${site.terrain.toLowerCase()} ground and ${site.risk.toLowerCase()} risk made landing easier.`,
    })
  }

  /* ---------- 2. trade-off ---------- */

  if (has('lab')) {
    lessons.push({
      kind: 'tradeoff',
      title: 'Science vs. power',
      text: 'The science lab gave lots of science points, but it used up 10 power points. More science means you need more energy.',
    })
  } else if (has('rover')) {
    lessons.push({
      kind: 'tradeoff',
      title: 'Explore vs. weight',
      text: 'The terrain vehicle lets the crew explore far away, but at 610 kg it is the heaviest module and made the lander burn more fuel.',
    })
  } else if (has('solar') && !has('battery')) {
    lessons.push({
      kind: 'tradeoff',
      title: 'Solar only works in sunlight',
      text: 'Solar panels are great while the Sun shines. Without a battery, there is nothing to power the base at night.',
    })
  } else if (result.fuelUsed >= 80) {
    lessons.push({
      kind: 'tradeoff',
      title: 'Safe vs. heavy',
      text: `More equipment makes the base safer, but the heavy lander used ${result.fuelUsed}% of its fuel just to land.`,
    })
  } else {
    lessons.push({
      kind: 'tradeoff',
      title: 'Money vs. safety',
      text: `You spent $${result.spent}M of $${result.budget}M. Buying more makes a mission safer, but leaves less money to fix surprises.`,
    })
  }

  /* ---------- 3. improve ---------- */

  const extra = result.performance.find((p) => p.rating === 'extra')
  const smoothest =
    lunarSites.find((s) => s.terrain === 'EXCELLENT') ??
    lunarSites[0]

  if (!firstAttempt && initialShortages.length) {
    const names = initialShortages
      .map((s) => s.label.toLowerCase())
      .join(' and ')
    lessons.push({
      kind: 'improve',
      title: 'Check before you launch',
      text: `Your first plan was short on ${names}. Next time, compare each system with what the site needs before launch — then you can win the first-try bonus!`,
    })
  } else if (result.science < result.scienceGoal) {
    lessons.push({
      kind: 'improve',
      title: 'Reach the science goal',
      text: `You got ${result.science} of ${result.scienceGoal} science points. Adding the ice drill or science lab would earn the third star.`,
    })
  } else if (result.landingGrade !== 'A' && smoothest.id !== site.id) {
    lessons.push({
      kind: 'improve',
      title: 'Land closer to target',
      text: `Rough ground pushed you ${result.landingOffset} m off target. A site with smooth ground, like ${smoothest.name}, makes a more precise landing.`,
    })
  } else if (extra) {
    lessons.push({
      kind: 'improve',
      title: 'Pack lighter',
      text: `The ${extra.item.shortName.toLowerCase()} was not really needed here. Leaving it behind saves $${extra.item.cost}M and ${extra.item.mass} kg.`,
    })
  } else {
    lessons.push({
      kind: 'improve',
      title: 'Try a harder challenge',
      text: 'Your plan was nearly perfect! Next time try a darker, colder site like Cabeus Crater, where the ice is richest.',
    })
  }

  /* ---------- 4. real-world fact ---------- */

  const factItem =
    result.performance.find((p) => p.rating === 'saver')?.item ??
    items[0]

  if (factItem) {
    lessons.push({
      kind: 'fact',
      title: factItem.name,
      text: factItem.realWorld,
    })
  }

  return lessons
}

/* =========================================================
   COMPONENT
   ========================================================= */

export default function WhatYouLearned({
  result,
  firstAttempt,
  initialShortages,
  onBack,
  onContinue,
}: WhatYouLearnedProps) {
  const site = findSite(result.siteId)
  const lessons = buildLessons(result, firstAttempt, initialShortages)

  /* ---------------- VOICE ---------------- */

  const readLesson = (i: number) =>
    `${KIND_META[lessons[i].kind].label.toLowerCase()}: ${lessons[i].title}. ${lessons[i].text}`

  const intro = `Here is what you learned. ${lessons
    .map((_, i) => `Number ${i + 1}. ${readLesson(i)}`)
    .join(' ')} Say next to open your mission journal.`

  const NUMBER_WORDS = [
    ['one', 'first', '1'],
    ['two', 'second', '2'],
    ['three', 'third', '3'],
    ['four', 'fourth', '4'],
  ]

  const handleVoice = (text: string) => {
    const picked = NUMBER_WORDS.findIndex((words) => saidAny(text, words))

    if (saidAny(text, ['help', 'what can i say', 'commands'])) {
      speak('You can say: read again, a number from one to four, next, or back.')
    } else if (picked >= 0 && picked < lessons.length) {
      speak(readLesson(picked))
    } else if (saidAny(text, ['read', 'again', 'repeat'])) {
      speak(intro)
    } else if (saidAny(text, ['next', 'continue', 'journal'])) {
      onContinue()
    } else if (saidAny(text, ['back', 'go back'])) {
      onBack()
    } else {
      speak('Sorry, I did not catch that. Say help to hear the commands.')
    }
  }

  const voice = useMissionVoice({ onCommand: handleVoice, intro })
  const { speak } = voice
  const voiceHint = 'Say “read again” or “next”'

  return (
    <main className="wl-page">
      {/* ===================== BACKGROUND ===================== */}

      <div className="wl-space" aria-hidden="true">
        <div className="wl-stars wl-stars-a" />
        <div className="wl-stars wl-stars-b" />
        <div className="wl-nebula wl-nebula-a" />
        <div className="wl-nebula wl-nebula-b" />
        <div className="wl-horizon" />
      </div>

      {/* ===================== NAV ===================== */}

      <header className="wl-nav">
        <div className="wl-brand">
          <span className="wl-brand-mark">M</span>
          <span className="wl-brand-copy">
            <strong>MOONIX</strong>
            <small>LUNAR MISSION CONTROL</small>
          </span>
        </div>

        <div className="wl-path">
          <span>MISSION</span>
          <i>/</i>
          <span>{site.code}</span>
          <i>/</i>
          <strong>LEARN</strong>
        </div>

        <div className="wl-nav-right">
          <div className="wl-status">
            <span className="wl-status-dot" />
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

      <div className="wl-stepper">
        {MISSION_STEPS.map((step, index) => (
          <div
            key={step}
            className={`wl-step ${index < 4 ? 'is-done' : 'is-active'}`}
          >
            <span className="wl-step-num">
              {index < 4 ? '✓' : pad(index + 1)}
            </span>
            <strong>{step}</strong>
            {index < MISSION_STEPS.length - 1 && (
              <span className="wl-step-line">
                <i />
              </span>
            )}
          </div>
        ))}
      </div>

      <section className="wl-shell">
        <ol className="wl-trail">
          {DEBRIEF_STEPS.map((step, i) => (
            <li
              key={step}
              className={
                i < 2 ? 'is-done' : i === 2 ? 'is-active' : ''
              }
            >
              <b>{i < 2 ? '✓' : i + 1}</b>
              {step}
            </li>
          ))}
        </ol>

        {/* ===================== HEADING ===================== */}

        <div className="wl-heading">
          <div className="wl-eyebrow">
            <span className="wl-eyebrow-line" />
            <span>LESSONS FROM YOUR CHOICES</span>
          </div>

          <h1 className="wl-title">
            What You <span>Learned</span>
          </h1>

          <p>
            Every choice you made — the site, the month and the
            equipment — changed how your mission went. Here are
            the <b>{lessons.length} big ideas</b> to remember.
          </p>
        </div>

        {/* ===================== LESSONS ===================== */}

        <ol className="wl-lessons">
          {lessons.map((lesson, i) => {
            const meta = KIND_META[lesson.kind]

            return (
              <li
                key={lesson.kind}
                className={`wl-lesson is-${lesson.kind}`}
                style={{ animationDelay: `${0.1 + i * 0.12}s` }}
              >
                <span className="wl-lesson-icon">{meta.icon}</span>
                <div>
                  <small>{meta.label}</small>
                  <h2>{lesson.title}</h2>
                  <p>{lesson.text}</p>
                </div>
              </li>
            )
          })}
        </ol>

        {/* ===================== FOOTER ===================== */}

        <div className="wl-footer">
          <button className="wl-back" type="button" onClick={onBack}>
            <span>←</span>
            BACK
          </button>

          <button
            className="wl-go is-good"
            type="button"
            onClick={onContinue}
          >
            <span>OPEN MISSION JOURNAL</span>
            <b>→</b>
          </button>
        </div>
      </section>
    </main>
  )
}
