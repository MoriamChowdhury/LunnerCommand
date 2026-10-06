import { useEffect, useState } from 'react'

import {
  countStars,
  findItems,
  findSite,
  findWindow,
  type MissionResult,
} from '../data/missionEngine'

import {
  loadJournal,
  saveJournalEntry,
  type JournalEntry,
} from '../data/missionStorage'

import VoiceControl from './VoiceControl'
import { saidAny, useMissionVoice } from './useMissionVoice'

import './MissionJournal.css'

/* =========================================================
   TYPES
   ========================================================= */

type MissionJournalProps = {
  missionId: string
  result: MissionResult
  firstAttempt: boolean
  attempts: number
  bonusEarned: number
  onBack: () => void
  onNextMission: () => void
}

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

const NOTE_LIMIT = 280

const pad = (n: number) => String(n).padStart(2, '0')

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

const starText = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n)

/* =========================================================
   COMPONENT
   ========================================================= */

export default function MissionJournal({
  missionId,
  result,
  firstAttempt,
  attempts,
  bonusEarned,
  onBack,
  onNextMission,
}: MissionJournalProps) {
  const site = findSite(result.siteId)
  const win = findWindow(result.windowId)
  const items = findItems(result.equipmentIds)
  const stars = countStars(result, firstAttempt)

  const [saved] = useState(() =>
    loadJournal().find((e) => e.id === missionId)
  )
  const [note, setNote] = useState(saved?.note ?? '')
  const [date] = useState(
    () => saved?.date ?? new Date().toISOString()
  )
  const [noteSaved, setNoteSaved] = useState(Boolean(saved?.note))
  const [history] = useState(() =>
    loadJournal().filter((e) => e.id !== missionId).slice(0, 5)
  )

  const buildEntry = (text: string): JournalEntry => ({
    id: missionId,
    date,
    siteId: result.siteId,
    windowId: result.windowId,
    equipmentIds: result.equipmentIds,
    attempts,
    firstAttempt,
    bonusEarned,
    stars,
    note: text.trim(),
  })

  const entry = buildEntry(note)

  /* the automatic entry is saved as soon as the page opens */
  useEffect(() => {
    saveJournalEntry(buildEntry(saved?.note ?? ''))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSave = () => {
    saveJournalEntry(entry)
    setNoteSaved(true)
  }

  const handleNext = () => {
    saveJournalEntry(entry)
    onNextMission()
  }

  /* ---------------- VOICE ---------------- */

  const story = `Log entry. Today my crew landed at ${site.name} in ${win.month.toLowerCase()}. We carried ${items.length} modules and spent ${result.spent} million dollars. ${
    firstAttempt
      ? 'We landed on the very first try!'
      : `It took ${attempts} tries, but we fixed our problems and made it.`
  } We scored ${result.science} science points.`

  const intro = `Mission journal. ${story} To write a note with your voice, say note, and then your idea. Say save to keep it, or next mission when you are done.`

  const handleVoice = (text: string, raw: string) => {
    /* "note ..." — everything after the word becomes the note */
    const noteMatch = raw.match(/\bnote\b[:,]?\s*(.*)$/i)

    if (noteMatch && !saidAny(text, ['save note', 'clear note', 'delete note'])) {
      const words = noteMatch[1].trim()

      if (!words) {
        speak('Say note, and then your idea. For example: note, take the battery next time.')
        return
      }

      const next = (note ? `${note.trim()} ${words}` : words).slice(0, NOTE_LIMIT)
      setNote(next.charAt(0).toUpperCase() + next.slice(1))
      setNoteSaved(false)
      speak('Got it. Say save to keep your note.')
      return
    }

    if (saidAny(text, ['help', 'what can i say', 'commands'])) {
      speak('You can say: note, followed by your idea. Or say save, clear note, read, next mission, or back.')
    } else if (saidAny(text, ['clear note', 'delete note', 'erase'])) {
      setNote('')
      setNoteSaved(false)
      speak('Note cleared.')
    } else if (saidAny(text, ['save'])) {
      if (!note.trim()) {
        speak('Your note is empty. Say note, and then your idea.')
      } else {
        handleSave()
        speak('Note saved in your journal.')
      }
    } else if (saidAny(text, ['next mission', 'next', 'finish', 'done'])) {
      handleNext()
    } else if (saidAny(text, ['back', 'go back'])) {
      onBack()
    } else if (saidAny(text, ['read', 'repeat', 'again'])) {
      speak(note.trim() ? `${story} Your note says: ${note}` : story)
    } else {
      speak('Sorry, I did not catch that. Say help to hear the commands.')
    }
  }

  const voice = useMissionVoice({ onCommand: handleVoice, intro })
  const { speak } = voice
  const voiceHint = 'Say “note …” or “next mission”'

  return (
    <main className="mj-page">
      {/* ===================== BACKGROUND ===================== */}

      <div className="mj-space" aria-hidden="true">
        <div className="mj-stars mj-stars-a" />
        <div className="mj-stars mj-stars-b" />
        <div className="mj-nebula mj-nebula-a" />
        <div className="mj-nebula mj-nebula-b" />
        <div className="mj-horizon" />
      </div>

      {/* ===================== NAV ===================== */}

      <header className="mj-nav">
        <div className="mj-brand">
          <span className="mj-brand-mark">M</span>
          <span className="mj-brand-copy">
            <strong>MOONIX</strong>
            <small>LUNAR MISSION CONTROL</small>
          </span>
        </div>

        <div className="mj-path">
          <span>MISSION</span>
          <i>/</i>
          <span>{site.code}</span>
          <i>/</i>
          <strong>JOURNAL</strong>
        </div>

        <div className="mj-nav-right">
          <div className="mj-status">
            <span className="mj-status-dot" />
            <span>LOG SAVED</span>
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

      <div className="mj-stepper">
        {MISSION_STEPS.map((step, index) => (
          <div
            key={step}
            className={`mj-step ${index < 4 ? 'is-done' : 'is-active'}`}
          >
            <span className="mj-step-num">
              {index < 4 ? '✓' : pad(index + 1)}
            </span>
            <strong>{step}</strong>
            {index < MISSION_STEPS.length - 1 && (
              <span className="mj-step-line">
                <i />
              </span>
            )}
          </div>
        ))}
      </div>

      <section className="mj-shell">
        <ol className="mj-trail">
          {DEBRIEF_STEPS.map((step, i) => (
            <li
              key={step}
              className={i < 3 ? 'is-done' : 'is-active'}
            >
              <b>{i < 3 ? '✓' : i + 1}</b>
              {step}
            </li>
          ))}
        </ol>

        {/* ===================== HEADING ===================== */}

        <div className="mj-heading">
          <div className="mj-eyebrow">
            <span className="mj-eyebrow-line" />
            <span>COMMANDER’S LOG</span>
          </div>

          <h1 className="mj-title">
            Mission <span>Journal</span>
          </h1>

          <p>
            Real astronauts write a log after every mission. Here
            is yours — add a note so you remember your best ideas
            for next time.
          </p>
        </div>

        <div className="mj-grid">
          {/* ===================== ENTRY ===================== */}

          <article className="mj-panel mj-entry">
            <div className="mj-entry-head">
              <div>
                <small>LOG ENTRY · {formatDate(entry.date)}</small>
                <h2>
                  {site.name} · {win.month}
                </h2>
              </div>
              <span
                className="mj-stars-text"
                aria-label={`${stars} out of 3 stars`}
              >
                {starText(stars)}
              </span>
            </div>

            <p className="mj-story">
              Today my crew landed at <b>{site.name}</b> in{' '}
              <b>{win.month.toLowerCase()}</b>. We carried{' '}
              <b>{items.length} modules</b> and spent{' '}
              <b>${result.spent}M</b>.{' '}
              {firstAttempt
                ? 'We landed on the very first try!'
                : `It took ${attempts} tries — we fixed our problems and made it.`}{' '}
              We scored <b>{result.science} science points</b> and
              landed {result.landingOffset} m from the target.
            </p>

            <ul className="mj-tags">
              {items.map((item) => (
                <li key={item.id}>
                  {item.icon} {item.shortName}
                </li>
              ))}
            </ul>

            <dl className="mj-facts">
              <div>
                <dt>TRIES</dt>
                <dd>{attempts}</dd>
              </div>
              <div>
                <dt>FUEL LEFT</dt>
                <dd>{100 - result.fuelUsed}%</dd>
              </div>
              <div>
                <dt>LANDING</dt>
                <dd>GRADE {result.landingGrade}</dd>
              </div>
              <div>
                <dt>BONUS</dt>
                <dd className={bonusEarned ? 'is-gold' : ''}>
                  {bonusEarned ? `+$${bonusEarned}M` : '—'}
                </dd>
              </div>
            </dl>

            <label className="mj-note">
              <span>✎ MY NOTE FOR NEXT TIME</span>
              <textarea
                value={note}
                maxLength={NOTE_LIMIT}
                rows={3}
                placeholder="What would you do differently? Which module was the most useful?"
                onChange={(e) => {
                  setNote(e.target.value)
                  setNoteSaved(false)
                }}
              />
            </label>

            <div className="mj-note-foot">
              <small>
                {note.length}/{NOTE_LIMIT}
              </small>
              <button
                type="button"
                className="mj-save"
                onClick={handleSave}
                disabled={noteSaved || !note.trim()}
              >
                {noteSaved ? '✓ SAVED' : 'SAVE NOTE'}
              </button>
            </div>
          </article>

          {/* ===================== HISTORY ===================== */}

          <aside className="mj-panel">
            <div className="mj-panel-head">
              <span>▤</span>
              <div>
                <small>YOUR EARLIER MISSIONS</small>
                <h2>Past Logs</h2>
              </div>
            </div>

            {history.length ? (
              <ul className="mj-history">
                {history.map((e) => (
                  <li key={e.id}>
                    <div>
                      <strong>{findSite(e.siteId).name}</strong>
                      <small>
                        {formatDate(e.date)} ·{' '}
                        {findWindow(e.windowId).short}
                      </small>
                      {e.note && <p>“{e.note}”</p>}
                    </div>
                    <span>{starText(e.stars)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mj-empty">
                This is your first log. Every mission you finish
                will be saved here.
              </p>
            )}
          </aside>
        </div>

        {/* ===================== FOOTER ===================== */}

        <div className="mj-footer">
          <button className="mj-back" type="button" onClick={onBack}>
            <span>←</span>
            BACK
          </button>

          <button
            className="mj-go is-good"
            type="button"
            onClick={handleNext}
          >
            <span>NEXT MISSION</span>
            <b>🚀</b>
          </button>
        </div>
      </section>
    </main>
  )
}
