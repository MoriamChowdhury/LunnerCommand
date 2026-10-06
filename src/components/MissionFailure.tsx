import { useMemo, useState } from 'react'

import type { CSSProperties } from 'react'

import { MASS_LIMIT, equipmentList } from '../data/equipment'

import {
  evaluateMission,
  findCheapestFix,
  findSite,
  findWindow,
  repairValue,
  type MissionResult,
  type SystemKey,
} from '../data/missionEngine'

import VoiceControl from './VoiceControl'
import { saidAny, useMissionVoice } from './useMissionVoice'

import './MissionFailure.css'

/* =========================================================
   TYPES
   ========================================================= */

type MissionFailureProps = {
  result: MissionResult
  budget: number
  onFixAndContinue: (addedIds: string[]) => void
  onRestart: () => void
}

type CSSVars = CSSProperties &
  Record<`--${string}`, string | number>

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

const SHORTAGE_HELP: Record<SystemKey, string> = {
  power:
    'Your base needs more energy. Solar panels make power and batteries store it for dark times.',
  comms:
    'Your radio signal to Earth is too weak. A relay antenna can pass messages around the mountains.',
  safety:
    'Your crew needs more protection from the freezing cold and from space radiation.',
}

const SYSTEM_ICON: Record<SystemKey, string> = {
  power: '⚡',
  comms: '📡',
  safety: '🛡',
}

const pad = (n: number) => String(n).padStart(2, '0')

/* =========================================================
   COMPONENT
   ========================================================= */

export default function MissionFailure({
  result,
  budget,
  onFixAndContinue,
  onRestart,
}: MissionFailureProps) {
  const site = findSite(result.siteId)
  const win = findWindow(result.windowId)

  const [repairing, setRepairing] = useState(false)
  const [added, setAdded] = useState<string[]>([])

  const cheapestFix = useMemo(
    () =>
      findCheapestFix(
        result.siteId,
        result.equipmentIds,
        result.windowId,
        budget
      ),
    [result, budget]
  )

  const canFix = cheapestFix !== null

  /* live result while the player adds modules */
  const live = useMemo(
    () =>
      evaluateMission(
        result.siteId,
        [...result.equipmentIds, ...added],
        result.windowId,
        budget
      ),
    [result, added, budget]
  )

  const candidates = equipmentList.filter(
    (item) => !result.equipmentIds.includes(item.id)
  )

  const toggle = (id: string) => {
    setAdded((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id]
    )
  }

  const shortageKeys = result.shortages.map((s) => s.key)

  /* in repair mode show every system that started short,
     so the player can watch it turn green */
  const rows = repairing
    ? live.checks.filter((c) => shortageKeys.includes(c.key))
    : result.checks.filter((c) => !c.ok)

  /* ---------------- VOICE ---------------- */

  const problemsLine = (shortages: MissionResult['shortages']) =>
    shortages
      .map((s) => `${s.label.toLowerCase()} is ${s.missing} points short`)
      .join('. ')

  const intro = `Mission failed. But don't worry, the crew is safe. ${problemsLine(result.shortages)}. ${
    canFix
      ? `You still have ${result.remainingBudget} million dollars. Say fix to repair the lander.`
      : `You only have ${result.remainingBudget} million dollars left, and that is not enough to fix it. Say restart to plan a new mission. Your saved bonus stays with you.`
  }`

  /* add or remove a module by its spoken name */
  const handleModuleVoice = (text: string, adding: boolean) => {
    const item = equipmentList.find((eq) =>
      eq.voiceAliases.some((alias) => saidAny(text, [alias]))
    )

    if (!item) {
      speak('Which module? For example, say add battery.')
      return
    }

    if (result.equipmentIds.includes(item.id)) {
      speak(`The ${item.shortName} is already on the lander.`)
      return
    }

    const isAdded = added.includes(item.id)

    if (adding === isAdded) {
      speak(
        adding
          ? `The ${item.shortName} is already added.`
          : `The ${item.shortName} is not in the repair list.`
      )
      return
    }

    if (adding && item.cost > live.remainingBudget) {
      speak(`Not enough money. The ${item.shortName} costs ${item.cost} million, and you have ${live.remainingBudget} million left.`)
      return
    }

    if (adding && live.massUsed + item.mass > MASS_LIMIT) {
      speak(`The ${item.shortName} is too heavy. The lander would be over its weight limit.`)
      return
    }

    const nextIds = adding
      ? [...added, item.id]
      : added.filter((x) => x !== item.id)
    const next = evaluateMission(
      result.siteId,
      [...result.equipmentIds, ...nextIds],
      result.windowId,
      budget
    )

    setAdded(nextIds)
    speak(
      `${item.shortName} ${adding ? 'added' : 'removed'}. ${
        next.success
          ? 'All systems go! Say continue to land.'
          : `Still to fix: ${problemsLine(next.shortages)}.`
      }`
    )
  }

  const handleVoice = (text: string) => {
    if (saidAny(text, ['help', 'what can i say', 'commands'])) {
      speak(
        repairing
          ? 'You can say: add, or remove, followed by a module name. Or say auto fix, status, continue, or cancel.'
          : canFix
            ? 'You can say: fix, or status.'
            : 'You can say: restart, or status.'
      )
      return
    }

    if (saidAny(text, ['status', 'problems', 'what went wrong', 'report'])) {
      speak(
        live.success
          ? 'All systems go! Say continue to land.'
          : `${problemsLine(live.shortages)}. You have ${live.remainingBudget} million dollars left.`
      )
      return
    }

    if (!repairing) {
      if (saidAny(text, ['fix', 'repair'])) {
        if (canFix) {
          setRepairing(true)
          speak('Repair bay open. Say add, followed by a module name, or say auto fix.')
        } else {
          speak('There is not enough money to fix the lander. Say restart to plan a new mission.')
        }
      } else if (saidAny(text, ['restart', 'start over', 'new mission'])) {
        if (canFix) {
          speak('You still have enough money to fix it! Say fix to repair the lander.')
        } else {
          onRestart()
        }
      } else {
        speak('Sorry, I did not catch that. Say help to hear the commands.')
      }
      return
    }

    if (saidAny(text, ['auto fix', 'autofix', 'auto', 'fix it for me'])) {
      setAdded(cheapestFix ?? [])
      speak('Auto fix complete. All systems go! Say continue to land.')
    } else if (saidAny(text, ['add', 'install', 'buy'])) {
      handleModuleVoice(text, true)
    } else if (saidAny(text, ['remove', 'take out', 'delete'])) {
      handleModuleVoice(text, false)
    } else if (saidAny(text, ['continue', 'land', 'landing', 'go'])) {
      if (live.success) {
        onFixAndContinue(added)
      } else {
        speak(`Not yet. ${problemsLine(live.shortages)}.`)
      }
    } else if (saidAny(text, ['cancel', 'back'])) {
      setRepairing(false)
      setAdded([])
      speak('Repair cancelled.')
    } else {
      speak('Sorry, I did not catch that. Say help to hear the commands.')
    }
  }

  const voice = useMissionVoice({ onCommand: handleVoice, intro })
  const { speak } = voice
  const voiceHint = repairing
    ? live.success
      ? 'Say “continue”'
      : 'Say “add battery” or “auto fix”'
    : canFix
      ? 'Say “fix”'
      : 'Say “restart”'

  /* ---------------- RENDER ---------------- */

  return (
    <main className="mf-page">
      {/* ===================== BACKGROUND ===================== */}

      <div className="mf-space" aria-hidden="true">
        <div className="mf-stars mf-stars-a" />
        <div className="mf-stars mf-stars-b" />
        <div className="mf-nebula mf-nebula-a" />
        <div className="mf-nebula mf-nebula-b" />
        <div className="mf-alarm" />
        <div className="mf-horizon" />
      </div>

      {/* ===================== NAV ===================== */}

      <header className="mf-nav">
        <div className="mf-brand">
          <span className="mf-brand-mark">M</span>
          <span className="mf-brand-copy">
            <strong>MOONIX</strong>
            <small>LUNAR MISSION CONTROL</small>
          </span>
        </div>

        <div className="mf-path">
          <span>MISSION</span>
          <i>/</i>
          <span>{site.code}</span>
          <i>/</i>
          <strong>{repairing ? 'REPAIR' : 'ANOMALY'}</strong>
        </div>

        <div className="mf-nav-right">
          <div className={`mf-status ${live.success ? 'is-fixed' : ''}`}>
            <span className="mf-status-dot" />
            <span>
              {live.success
                ? 'ALL SYSTEMS GO'
                : 'LANDER HOLDING IN ORBIT'}
            </span>
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

      <div className="mf-stepper">
        {MISSION_STEPS.map((step, index) => (
          <div
            key={step}
            className={`mf-step ${index < 3 ? 'is-done' : ''} ${
              index === 3 ? 'is-active' : ''
            }`}
          >
            <span className="mf-step-num">
              {index < 3 ? '✓' : pad(index + 1)}
            </span>
            <strong>{step}</strong>
            {index < MISSION_STEPS.length - 1 && (
              <span className="mf-step-line">
                <i />
              </span>
            )}
          </div>
        ))}
      </div>

      <section className="mf-shell">
        {/* ===================== HEADING ===================== */}

        <div className="mf-heading">
          <div className="mf-eyebrow">
            <span className="mf-eyebrow-line" />
            <span>
              {site.code} · {win.month} ·{' '}
              {repairing ? 'REPAIR BAY' : 'LANDING ABORTED'}
            </span>
          </div>

          <h1 className="mf-title">
            {repairing ? (
              <>
                Repair <span>Bay</span>
              </>
            ) : (
              <>
                Mission <span>Failed</span>
              </>
            )}
          </h1>

          <p>
            {repairing ? (
              <>
                Add new modules to fix every problem. Watch the
                bars — when they all pass the <b>white line</b>,
                you are ready to land.
              </>
            ) : (
              <>
                Don’t worry — the crew is safe! The computer
                stopped the landing because some systems were{' '}
                <b>too weak</b>. Real space missions fail tests too.
                Let’s see what was missing.
              </>
            )}
          </p>
        </div>

        <div className={`mf-grid ${repairing ? 'is-repairing' : ''}`}>
          {/* ===================== SHORTAGES ===================== */}

          <div className="mf-panel">
            <div className="mf-panel-head">
              <span>01</span>
              <div>
                <small>WHAT WENT WRONG</small>
                <h2>
                  {repairing
                    ? `${live.shortages.length} of ${result.shortages.length} problems left`
                    : `${result.shortages.length} ${
                        result.shortages.length === 1
                          ? 'problem'
                          : 'problems'
                      } found`}
                </h2>
              </div>
            </div>

            <ul className="mf-shortages">
              {rows.map((row) => {
                const pct = Math.min(
                  100,
                  (row.have / (row.need * 1.5)) * 100
                )
                const needPct = (1 / 1.5) * 100
                const helpers = candidates
                  .filter((item) => repairValue(item, result.siteId, result.windowId)[row.key])
                  .sort((a, b) => a.cost - b.cost)

                return (
                  <li
                    key={row.key}
                    className={row.ok ? 'is-ok' : 'is-bad'}
                  >
                    <div className="mf-short-top">
                      <span className="mf-short-icon">
                        {SYSTEM_ICON[row.key]}
                      </span>
                      <div>
                        <strong>{row.label}</strong>
                        <small>
                          {row.ok
                            ? 'FIXED ✓'
                            : `MISSING ${row.need - row.have} POINTS`}
                        </small>
                      </div>
                      <em>
                        {row.have} / {row.need}
                      </em>
                    </div>

                    <div className="mf-bar mf-bar-need">
                      <i style={{ width: `${pct}%` }} />
                      <b style={{ left: `${needPct}%` }} />
                    </div>

                    {!repairing && (
                      <>
                        <p>{SHORTAGE_HELP[row.key]}</p>
                        {helpers.length > 0 && (
                          <div className="mf-helpers">
                            <span>WHAT HELPS:</span>
                            {helpers.map((item) => (
                              <b key={item.id}>
                                {item.icon} {item.shortName} · $
                                {item.cost}M
                              </b>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </li>
                )
              })}
            </ul>

            <div className="mf-money">
              <div>
                <small>MONEY LEFT</small>
                <strong>${live.remainingBudget}M</strong>
              </div>
              <div>
                <small>MASS LEFT</small>
                <strong>{MASS_LIMIT - live.massUsed} kg</strong>
              </div>
            </div>
          </div>

          {/* ===================== REPAIR BAY ===================== */}

          {repairing && (
            <div className="mf-panel">
              <div className="mf-panel-head">
                <span>02</span>
                <div>
                  <small>TAP A MODULE TO ADD IT</small>
                  <h2>Spare Modules</h2>
                </div>
                <button
                  className="mf-auto"
                  type="button"
                  onClick={() => setAdded(cheapestFix ?? [])}
                >
                  ✦ AUTO FIX
                </button>
              </div>

              <ul className="mf-modules">
                {candidates.map((item) => {
                  const isAdded = added.includes(item.id)
                  const help = repairValue(
                    item,
                    result.siteId,
                    result.windowId
                  )
                  const tooExpensive =
                    !isAdded && item.cost > live.remainingBudget
                  const tooHeavy =
                    !isAdded &&
                    live.massUsed + item.mass > MASS_LIMIT
                  const disabled = tooExpensive || tooHeavy

                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={`mf-module ${isAdded ? 'is-added' : ''}`}
                        style={{ '--accent': item.color } as CSSVars}
                        disabled={disabled}
                        onClick={() => toggle(item.id)}
                        aria-pressed={isAdded}
                      >
                        <span className="mf-module-icon">
                          {item.icon}
                        </span>
                        <span className="mf-module-copy">
                          <strong>{item.shortName}</strong>
                          <small>
                            ${item.cost}M · {item.mass} kg
                          </small>
                          <span className="mf-module-help">
                            {(Object.keys(help) as SystemKey[]).map(
                              (key) => (
                                <i
                                  key={key}
                                  className={
                                    shortageKeys.includes(key)
                                      ? 'is-needed'
                                      : ''
                                  }
                                >
                                  {SYSTEM_ICON[key]} +{help[key]}
                                </i>
                              )
                            )}
                            {Object.keys(help).length === 0 && (
                              <i>Science only</i>
                            )}
                          </span>
                        </span>
                        <span className="mf-module-state">
                          {isAdded
                            ? '✓ ADDED'
                            : tooExpensive
                              ? 'NO MONEY'
                              : tooHeavy
                                ? 'TOO HEAVY'
                                : '+ ADD'}
                        </span>
                      </button>
                    </li>
                  )
                })}

                {candidates.length === 0 && (
                  <li className="mf-empty">
                    Every module is already on board.
                  </li>
                )}
              </ul>

              <p className="mf-tip">
                💡 Tip: icons in <b>gold</b> fix one of your
                problems.
              </p>
            </div>
          )}
        </div>

        {/* ===================== OPTIONS ===================== */}

        {!repairing && (
          <div className="mf-panel mf-options">
            {canFix ? (
              <>
                <span className="mf-options-icon">🔧</span>
                <div>
                  <small>GOOD NEWS</small>
                  <p>
                    You still have <b>${result.remainingBudget}M</b>{' '}
                    left. That is enough to send extra modules up
                    to your lander and fix the problems.
                  </p>
                  <p className="mf-muted">
                    Remember: landing after a repair does not earn
                    the first-try bonus.
                  </p>
                </div>
              </>
            ) : (
              <>
                <span className="mf-options-icon">↺</span>
                <div>
                  <small>NOT ENOUGH MONEY OR ROOM</small>
                  <p>
                    You only have <b>${result.remainingBudget}M</b>{' '}
                    left, and that cannot buy what the lander needs
                    (or it would be too heavy). You will need to
                    plan the mission again from the start.
                  </p>
                  <p className="mf-muted">
                    Any bonus you already earned stays with you.
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* ===================== FOOTER ===================== */}

        <div className="mf-footer">
          {repairing ? (
            <>
              <button
                className="mf-back"
                type="button"
                onClick={() => {
                  setRepairing(false)
                  setAdded([])
                }}
              >
                <span>←</span>
                CANCEL REPAIR
              </button>

              {live.success ? (
                <button
                  className="mf-go is-good"
                  type="button"
                  onClick={() => onFixAndContinue(added)}
                >
                  <span>CONTINUE LANDING</span>
                  <b>→</b>
                </button>
              ) : (
                <p className="mf-waiting">
                  Fix all problems to continue…
                </p>
              )}
            </>
          ) : (
            <>
              <span />
              {canFix ? (
                <button
                  className="mf-go"
                  type="button"
                  onClick={() => setRepairing(true)}
                >
                  <span>FIX AND CONTINUE</span>
                  <b>🔧</b>
                </button>
              ) : (
                <button
                  className="mf-go is-bad"
                  type="button"
                  onClick={onRestart}
                >
                  <span>RESTART MISSION</span>
                  <b>↺</b>
                </button>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  )
}
