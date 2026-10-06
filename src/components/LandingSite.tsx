import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
} from 'react'

import {
  lunarSites,
  type LunarSite,
} from '../data/lunarSites'

import './LandingSite.css'

type LandingSiteProps = {
  selectedSite: string
  onSelectSite: (site: string) => void
  onBack: () => void
  onContinue: () => void
}

type SpeechRecognitionResultLike = {
  [index: number]: {
    transcript: string
  }
}

type SpeechRecognitionEventLike = Event & {
  results: {
    length: number
    [index: number]: SpeechRecognitionResultLike
  }
}

type SpeechRecognitionInstance = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  abort: () => void
  onresult:
    | ((event: SpeechRecognitionEventLike) => void)
    | null
  onend: (() => void) | null
  onerror:
    | ((event: { error?: string }) => void)
    | null
}

type SpeechRecognitionConstructor =
  new () => SpeechRecognitionInstance

type CSSVars = CSSProperties &
  Record<`--${string}`, string | number>

/* =========================================================
   CONSTANTS + HELPERS
   ========================================================= */

/* the boot sequence plays once per app session */
let bootPlayed = false

const BOOT_MS = 2300

const CREW = [
  { id: 'lowe', name: 'CDR LOWE', role: 'Mission Commander', suit: 97, task: 'Landing zone survey' },
  { id: 'maya', name: 'LT. MAYA', role: 'Lander Pilot', suit: 95, task: 'Descent trajectory' },
  { id: 'okafor', name: 'DR. OKAFOR', role: 'Science Lead', suit: 98, task: 'Ice sample targeting' },
  { id: 'rossi', name: 'ENG. ROSSI', role: 'Flight Engineer', suit: 94, task: 'Power & thermal' },
]

/* deterministic particles (no randomness during render) */
const DUST = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  left: (i * 41.3) % 100,
  size: 1 + ((i * 7) % 3),
  dur: 16 + ((i * 5) % 12),
  delay: -((i * 3.7) % 22),
  drift: ((i * 17) % 60) - 30,
}))

/* orbit definitions inside the 600×600 hero stage */
const ORBITS = [
  { id: 'relay', label: 'RELAY-1', rx: 262, ry: 72, tilt: -14, dur: 26, color: '#72e8ff' },
  { id: 'gateway', label: 'GATEWAY', rx: 292, ry: 118, tilt: 12, dur: 40, color: '#e5bd72' },
]

const LANDING_DUR = 20

const pad = (n: number) => String(n).padStart(2, '0')

const formatMet = (seconds: number) =>
  `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`

const getSpeechRecognitionAPI = ():
  | SpeechRecognitionConstructor
  | undefined => {
  if (typeof window === 'undefined') return undefined

  const browserWindow = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }

  return (
    browserWindow.SpeechRecognition ||
    browserWindow.webkitSpeechRecognition
  )
}

/* south-pole projection → percent of the moon disc */
function markerPosition(site: LunarSite) {
  const lat = Math.abs(parseFloat(site.latitude))
  const lonRaw = parseFloat(site.longitude)
  const lon =
    ((/W/.test(site.longitude) ? -lonRaw : lonRaw) * Math.PI) / 180
  const d = (90 - lat) * 5.2

  return {
    x: 50 + Math.sin(lon) * d,
    y: 80 - Math.cos(lon) * d * 0.55,
  }
}

/* moon disc occupies 21%–79% of the stage (viewBox 126–474) */
const toStage = (p: { x: number; y: number }) => ({
  x: 126 + p.x * 3.48,
  y: 126 + p.y * 3.48,
})

const ellipsePath = (rx: number, ry: number, half = false) => {
  const front = `M ${300 + rx} 300 A ${rx} ${ry} 0 0 1 ${300 - rx} 300`
  if (half) return front
  return `${front} A ${rx} ${ry} 0 0 1 ${300 + rx} 300`
}

function spawnRipple(event: ReactMouseEvent<HTMLElement>) {
  const el = event.currentTarget
  const rect = el.getBoundingClientRect()
  const ripple = document.createElement('span')
  ripple.className = 'ls-ripple'
  ripple.style.left = `${event.clientX - rect.left}px`
  ripple.style.top = `${event.clientY - rect.top}px`
  el.appendChild(ripple)
  window.setTimeout(() => ripple.remove(), 700)
}

/* =========================================================
   COMPONENT
   ========================================================= */

function LandingSite({
  selectedSite,
  onSelectSite,
  onBack,
  onContinue,
}: LandingSiteProps) {
  const [activeTab, setActiveTab] =
    useState<'overview' | 'environment' | 'risk'>(
      'overview'
    )

  const [voiceOn, setVoiceOn] =
    useState(true)

  const [isListening, setIsListening] =
    useState(false)

  const [transcript, setTranscript] =
    useState('')

  const [voiceStatus, setVoiceStatus] =
    useState(() =>
      getSpeechRecognitionAPI()
        ? 'VOICE LINK READY'
        : 'VOICE INPUT NOT SUPPORTED'
    )

  const [showBoot, setShowBoot] =
    useState(() => !bootPlayed)

  const [introDelay] =
    useState(() => (bootPlayed ? 0.15 : BOOT_MS / 1000))

  const [met, setMet] = useState(0)

  const recognitionRef =
    useRef<SpeechRecognitionInstance | null>(null)

  const voiceOnRef = useRef(true)

  const shouldRestartRef = useRef(true)

  const mountedRef = useRef(true)

  const commandRef =
    useRef<(command: string) => void>(() => {})

  const rootRef = useRef<HTMLElement | null>(null)
  const layoutRef = useRef<HTMLDivElement | null>(null)
  const dashboardRef = useRef<HTMLElement | null>(null)
  const pointerFrame = useRef(0)
  const scrollFrame = useRef(0)

  const selected =
    lunarSites.find(
      (site) => site.id === selectedSite
    ) || lunarSites[0]

  const selectedIndex =
    lunarSites.findIndex(
      (site) => site.id === selected.id
    )

  const formattedIndex =
    String(selectedIndex + 1).padStart(2, '0')

  const scoreLabel = useMemo(() => {
    if (selected.score >= 90) return 'OPTIMAL'
    if (selected.score >= 80) return 'FAVORABLE'
    if (selected.score >= 70) return 'VIABLE'

    return 'CAUTION'
  }, [selected.score])

  /* landing sequence geometry for the selected site */
  const target = toStage(markerPosition(selected))
  const tx = Math.round(target.x)
  const ty = Math.round(target.y)

  const landingPath = `M 640 -40 C 540 30 250 10 130 170 C 40 290 120 460 250 482 C 330 494 ${tx + 70} ${ty - 110} ${tx} ${ty - 46} L ${tx} ${ty - 6}`

  const speak = useCallback((text: string) => {
    if (!voiceOnRef.current) return

    if (
      typeof window === 'undefined' ||
      !('speechSynthesis' in window)
    ) {
      return
    }

    window.speechSynthesis.cancel()

    const utterance =
      new SpeechSynthesisUtterance(text)

    utterance.rate = 0.92
    utterance.pitch = 0.86
    utterance.volume = 0.72

    const voices =
      window.speechSynthesis.getVoices()

    const preferredVoice =
      voices.find(
        (voice) =>
          voice.lang
            .toLowerCase()
            .startsWith('en-us')
      ) ||
      voices.find(
        (voice) =>
          voice.lang
            .toLowerCase()
            .startsWith('en')
      )

    if (preferredVoice) {
      utterance.voice = preferredVoice
    }

    window.speechSynthesis.speak(
      utterance
    )
  }, [])

  /* ---------------- NAVIGATION HELPERS ---------------- */

  const scrollToLayout = () => {
    layoutRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

  const scrollToData = () => {
    dashboardRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

  const chooseSite = (site: LunarSite) => {
    onSelectSite(site.id)
    setTranscript(`${site.name} selected`)
    setVoiceStatus(`SITE ${site.code} SELECTED`)
  }

  const selectSiteByVoice = (
    command: string
  ) => {
    const normalized =
      command.toLowerCase()

    const voiceSites = [
      {
        aliases: [
          'shackleton',
          'shackleton crater',
          'site one',
          'site 1',
          'mx 01',
          'mx-01',
        ],
        id: 'shackleton',
      },
      {
        aliases: [
          'cabeus',
          'cabeus crater',
          'site two',
          'site 2',
          'mx 02',
          'mx-02',
        ],
        id: 'cabeus',
      },
      {
        aliases: [
          'haworth',
          'haworth crater',
          'site three',
          'site 3',
          'mx 03',
          'mx-03',
        ],
        id: 'haworth',
      },
      {
        aliases: [
          'shoemaker',
          'shoemaker crater',
          'site four',
          'site 4',
          'mx 04',
          'mx-04',
        ],
        id: 'shoemaker',
      },
      {
        aliases: [
          'malapert',
          'malapert massif',
          'site five',
          'site 5',
          'mx 05',
          'mx-05',
        ],
        id: 'malapert',
      },
      {
        aliases: [
          'de gerlache',
          'gerlache',
          'de gerlache crater',
          'site six',
          'site 6',
          'mx 06',
          'mx-06',
        ],
        id: 'de-gerlache',
      },
    ]

    for (const site of voiceSites) {
      const matched =
        site.aliases.some((alias) =>
          normalized.includes(alias)
        )

      if (matched) {
        const target =
          lunarSites.find(
            (item) => item.id === site.id
          )

        if (target) {
          onSelectSite(target.id)

          setTranscript(
            `Selected ${target.name}`
          )

          setVoiceStatus(
            `SITE ${target.code} SELECTED`
          )

          speak(
            `${target.name} selected. Landing analysis updated.`
          )

          return true
        }
      }
    }

    return false
  }

  const processVoiceCommand = (
    command: string
  ) => {
    const normalized =
      command.toLowerCase().trim()

    if (!normalized) return

    setTranscript(command)

    if (
      normalized.includes('voice off') ||
      normalized.includes('turn voice off') ||
      normalized.includes('disable voice') ||
      normalized.includes('mute voice') ||
      normalized === 'mute'
    ) {
      voiceOnRef.current = false
      setVoiceOn(false)
      setVoiceStatus('VOICE LINK MUTED')

      if (recognitionRef.current) {
        shouldRestartRef.current = false

        try {
          recognitionRef.current.stop()
        } catch {
          // Ignore browser recognition errors.
        }
      }

      setIsListening(false)

      return
    }

    if (
      normalized.includes('voice on') ||
      normalized.includes('turn voice on') ||
      normalized.includes('enable voice') ||
      normalized.includes('activate voice')
    ) {
      voiceOnRef.current = true
      setVoiceOn(true)
      shouldRestartRef.current = true

      setVoiceStatus('VOICE LINK ACTIVE')

      speak(
        'Voice command system online.'
      )

      return
    }

    if (
      normalized === 'back' ||
      normalized.includes('go back') ||
      normalized.includes('back to brief') ||
      normalized.includes('mission brief')
    ) {
      setVoiceStatus('RETURNING TO BRIEF')

      speak(
        'Returning to mission brief.'
      )

      setTimeout(() => {
        onBack()
      }, 500)

      return
    }

    if (
      normalized.includes('enter mission') ||
      normalized.includes('show sites') ||
      normalized.includes('landing zones')
    ) {
      setVoiceStatus('OPENING SITE DATABASE')
      speak('Opening the landing zone database.')
      scrollToLayout()
      return
    }

    if (
      normalized.includes('explore') ||
      normalized.includes('lunar data') ||
      normalized.includes('show data')
    ) {
      setVoiceStatus('OPENING LUNAR DATA')
      speak(`Showing surface data for ${selected.name}.`)
      scrollToData()
      return
    }

    if (
      normalized === 'continue' ||
      normalized.includes('proceed') ||
      normalized.includes('confirm site') ||
      normalized.includes('select site')
    ) {
      if (!selectedSite) {
        setVoiceStatus(
          'SELECT A LANDING SITE'
        )

        speak(
          'Please select a landing site first.'
        )

        return
      }

      setVoiceStatus('ANALYSIS CONFIRMED')

      speak(
        `Proceeding with ${selected.name}.`
      )

      setTimeout(() => {
        onContinue()
      }, 450)

      return
    }

    if (
      normalized.includes('help') ||
      normalized.includes('commands') ||
      normalized.includes(
        'what can i say'
      )
    ) {
      setVoiceStatus(
        'COMMANDS: SITE, BACK, CONTINUE'
      )

      speak(
        'You can say a landing site name, enter mission, explore lunar data, back, or continue.'
      )

      return
    }

    if (selectSiteByVoice(normalized)) {
      return
    }

    setVoiceStatus('COMMAND NOT RECOGNIZED')

    speak(
      'Command not recognized. Try a site name, back, or continue.'
    )
  }

  /* always call the newest handler from the long-lived listener */
  useEffect(() => {
    commandRef.current = processVoiceCommand
  })

  /* ---------------- BOOT SEQUENCE ---------------- */

  useEffect(() => {
    if (!showBoot) return

    bootPlayed = true

    const skip = () => setShowBoot(false)
    const timer = window.setTimeout(skip, BOOT_MS)

    window.addEventListener('keydown', skip)

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('keydown', skip)
    }
  }, [showBoot])

  /* ---------------- MISSION ELAPSED TIME ---------------- */

  useEffect(() => {
    const start = Date.now()

    const timer = window.setInterval(() => {
      setMet(Math.floor((Date.now() - start) / 1000))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [])

  /* ---------------- SCROLL JOURNEY + REVEALS ---------------- */

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const handleScroll = (event: Event) => {
      const source =
        event.target instanceof HTMLElement
          ? event.target
          : document.scrollingElement

      if (!source) return

      window.cancelAnimationFrame(scrollFrame.current)
      scrollFrame.current = window.requestAnimationFrame(() => {
        const progress = Math.min(
          1.6,
          source.scrollTop / Math.max(1, window.innerHeight)
        )
        root.style.setProperty('--scroll', progress.toFixed(3))
      })
    }

    window.addEventListener('scroll', handleScroll, {
      capture: true,
      passive: true,
    })

    root.classList.add('ls-reveal-ready')

    const observer =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            (entries) => {
              for (const entry of entries) {
                if (entry.isIntersecting) {
                  entry.target.classList.add('is-revealed')
                  observer?.unobserve(entry.target)
                }
              }
            },
            { threshold: 0.12 }
          )
        : null

    const targets = root.querySelectorAll('[data-reveal]')

    targets.forEach((el) => {
      if (observer) observer.observe(el)
      else el.classList.add('is-revealed')
    })

    return () => {
      window.removeEventListener('scroll', handleScroll, {
        capture: true,
      })
      window.cancelAnimationFrame(scrollFrame.current)
      window.cancelAnimationFrame(pointerFrame.current)
      observer?.disconnect()
    }
  }, [])

  /* ---------------- MOUSE PARALLAX ---------------- */

  const handlePointer = (
    event: ReactMouseEvent<HTMLElement>
  ) => {
    const x = event.clientX / window.innerWidth - 0.5
    const y = event.clientY / window.innerHeight - 0.5

    window.cancelAnimationFrame(pointerFrame.current)
    pointerFrame.current = window.requestAnimationFrame(() => {
      const root = rootRef.current
      if (!root) return
      root.style.setProperty('--mx', x.toFixed(3))
      root.style.setProperty('--my', y.toFixed(3))
    })
  }

  /* ---------------- SPEECH RECOGNITION ---------------- */

  useEffect(() => {
    mountedRef.current = true

    const bootOffset = bootPlayed ? 0 : BOOT_MS

    const SpeechRecognitionAPI =
      getSpeechRecognitionAPI()

    const greetingTimer =
      window.setTimeout(() => {
        speak(
          'Landing site analysis online, Commander. Select a lunar landing site.'
        )
      }, 1500 + bootOffset)

    /* status was already set to NOT SUPPORTED at init */
    if (!SpeechRecognitionAPI) {
      return () => {
        mountedRef.current = false
        window.clearTimeout(greetingTimer)
      }
    }

    const recognition =
      new SpeechRecognitionAPI()

    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onresult = (
      event: SpeechRecognitionEventLike
    ) => {
      const latestIndex =
        event.results.length - 1

      const result =
        event.results[latestIndex]

      if (!result) return

      const spokenText =
        result[0]?.transcript || ''

      commandRef.current(
        spokenText
      )
    }

    recognition.onend = () => {
      if (
        !mountedRef.current ||
        !voiceOnRef.current ||
        !shouldRestartRef.current
      ) {
        setIsListening(false)
        return
      }

      setIsListening(true)

      try {
        recognition.start()
      } catch {
        // Browser may reject immediate restart.
      }
    }

    recognition.onerror = (
      event
    ) => {
      if (
        event.error ===
        'not-allowed'
      ) {
        setVoiceStatus(
          'MICROPHONE PERMISSION DENIED'
        )

        setIsListening(false)
        return
      }

      if (
        event.error ===
        'no-speech'
      ) {
        setVoiceStatus(
          'LISTENING FOR COMMAND'
        )

        return
      }

      setVoiceStatus(
        'VOICE LINK RECOVERING'
      )
    }

    recognitionRef.current =
      recognition

    const startTimer =
      window.setTimeout(() => {
        if (!mountedRef.current) {
          return
        }

        try {
          recognition.start()

          setIsListening(true)

          setVoiceStatus(
            'LISTENING FOR COMMAND'
          )
        } catch {
          setVoiceStatus(
            'VOICE LINK READY'
          )
        }
      }, 900 + bootOffset)

    return () => {
      mountedRef.current = false

      window.clearTimeout(
        startTimer
      )

      window.clearTimeout(
        greetingTimer
      )

      shouldRestartRef.current =
        false

      try {
        recognition.stop()
      } catch {
        // Ignore cleanup errors.
      }

      if (
        'speechSynthesis' in
        window
      ) {
        window.speechSynthesis.cancel()
      }
    }
  }, [speak])

  useEffect(() => {
    voiceOnRef.current =
      voiceOn
  }, [voiceOn])

  const toggleVoice = () => {
    if (!recognitionRef.current) {
      return
    }

    if (voiceOn) {
      voiceOnRef.current = false
      setVoiceOn(false)
      setVoiceStatus(
        'VOICE LINK MUTED'
      )

      shouldRestartRef.current =
        false

      try {
        recognitionRef.current.stop()
      } catch {
        // Ignore browser error.
      }

      setIsListening(false)

      if (
        'speechSynthesis' in
        window
      ) {
        window.speechSynthesis.cancel()
      }

      return
    }

    voiceOnRef.current = true
    setVoiceOn(true)
    shouldRestartRef.current = true

    setVoiceStatus(
      'VOICE LINK ACTIVE'
    )

    try {
      recognitionRef.current.start()

      setIsListening(true)
    } catch {
      // Recognition may already be active.
    }

    speak(
      'Voice command system online.'
    )
  }

  const manualStartListening = () => {
    if (!recognitionRef.current) {
      return
    }

    voiceOnRef.current = true
    setVoiceOn(true)
    shouldRestartRef.current = true

    try {
      recognitionRef.current.start()

      setIsListening(true)
      setVoiceStatus(
        'LISTENING FOR COMMAND'
      )
    } catch {
      // Already listening.
    }
  }

  return (
    <main
      ref={rootRef}
      className="lunar-landing ls-enhanced"
      style={{ '--intro': `${introDelay}s` } as CSSVars}
      onMouseMove={handlePointer}
    >
      {/* =====================================================
          ANIMATED SPACE BACKGROUND
      ====================================================== */}

      <div className="landing-space">
        <div className="ls-depth ls-depth-far">
          <div className="landing-stars-a" />
        </div>

        <div className="ls-depth ls-depth-mid">
          <div className="landing-stars-b" />
          <div className="landing-nebula landing-nebula-a" />
          <div className="landing-nebula landing-nebula-b" />
        </div>

        <div className="ls-depth ls-depth-near">
          <div className="ls-stars-near" />
          <div className="ls-dust">
            {DUST.map((p) => (
              <span
                key={p.id}
                style={
                  {
                    left: `${p.left}%`,
                    width: `${p.size}px`,
                    height: `${p.size}px`,
                    animationDuration: `${p.dur}s`,
                    animationDelay: `${p.delay}s`,
                    '--drift': `${p.drift}px`,
                  } as CSSVars
                }
              />
            ))}
          </div>
        </div>

        <div className="landing-grid" />
        <div className="landing-scan" />

        <div className="landing-vignette" />

        {/* Distant moon */}
        <div className="background-moon">
          <div className="background-moon-glow" />
          <div className="background-moon-surface">
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>

        {/* Animated rover */}
        <div className="background-rover">
          <div className="rover-antenna">
            <i />
          </div>

          <div className="rover-body">
            <div className="rover-window" />
            <div className="rover-light" />
          </div>

          <div className="rover-wheel rover-wheel-a" />
          <div className="rover-wheel rover-wheel-b" />
          <div className="rover-wheel rover-wheel-c" />

          <div className="rover-beam" />
        </div>

        {/* Tiny astronaut silhouette */}
        <div className="background-astronaut">
          <div className="astronaut-backpack" />
          <div className="astronaut-head" />
          <div className="astronaut-body" />
          <div className="astronaut-leg astronaut-leg-a" />
          <div className="astronaut-leg astronaut-leg-b" />
        </div>

        <div className="orbital-line orbital-line-a" />
        <div className="orbital-line orbital-line-b" />

        {/* slow distant probes */}
        <span className="ls-probe ls-probe-a">
          <i />
        </span>
        <span className="ls-probe ls-probe-b">
          <i />
        </span>
      </div>

      {/* =====================================================
          BOOT SEQUENCE (skippable)
      ====================================================== */}

      {showBoot && (
        <button
          type="button"
          className="ls-boot"
          onClick={() => setShowBoot(false)}
          aria-label="Skip start-up sequence"
        >
          <span className="ls-boot-core">
            <span className="ls-boot-emblem">
              <i />
              <i />
              <b>◐</b>
            </span>

            <strong>LUNAR COMMANDER</strong>
            <small>INITIALIZING MISSION SYSTEM…</small>

            <span className="ls-boot-lines">
              <span>ORBITAL SYSTEM ........ <em>ONLINE</em></span>
              <span>LUNAR DATABASE ........ <em>ONLINE</em></span>
              <span>COMMUNICATION ......... <em>ONLINE</em></span>
              <span>MISSION CONTROL ....... <em>READY</em></span>
            </span>

            <span className="ls-boot-bar">
              <i />
            </span>

            <span className="ls-boot-skip">CLICK OR PRESS ANY KEY TO SKIP</span>
          </span>
        </button>
      )}

      {/* =====================================================
          TOP NAVIGATION
      ====================================================== */}

      <header className="analysis-nav">
        <button
          className="analysis-brand"
          type="button"
          onClick={onBack}
          aria-label="Return to mission brief"
        >
          <span className="analysis-brand-mark">
            M
          </span>

          <span className="analysis-brand-copy">
            <strong>MOONIX</strong>
            <small>
              LUNAR OPERATIONS SYSTEM
            </small>
          </span>
        </button>

        <div className="analysis-path">
          <span>MISSION</span>
          <i>/</i>
          <span>ANALYSIS</span>
          <i>/</i>
          <strong>LANDING SITE</strong>
          <i>/</i>
          <span className="ls-nav-met">MET {formatMet(met)}</span>
        </div>

        <div
          className={`analysis-status ${
            isListening
              ? 'voice-listening'
              : ''
          }`}
        >
          <span className="status-dot" />

          <span>
            {voiceStatus}
          </span>
        </div>
      </header>

      {/* =====================================================
          MAIN
      ====================================================== */}

      <section className="landing-shell">

        {/* ===================================================
            HERO — CINEMATIC LUNAR SYSTEM
        ==================================================== */}

        <div className="ls-hero">
          <div className="ls-hero-copy">
            <div className="landing-heading-copy">
              <div className="landing-eyebrow ls-intro ls-intro-1">
                <span className="eyebrow-line" />
                <span>
                  PHASE 02 / SURFACE ANALYSIS
                </span>
              </div>

              <h1 className="ls-intro ls-intro-2">
                SELECT
                <span>LANDING SITE</span>
              </h1>

              <p className="ls-intro ls-intro-3">
                Evaluate candidate lunar
                landing zones using
                illumination, terrain,
                communication, thermal
                conditions and resource
                availability.
              </p>
            </div>

            {/* CTA */}
            <div className="ls-cta-row ls-intro ls-intro-4">
              <button
                type="button"
                className="ls-cta ls-cta-primary"
                onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
                  spawnRipple(event)
                  scrollToLayout()
                }}
              >
                <span className="ls-cta-scan" />
                <span className="ls-cta-label">
                  <small>01 · LANDING ZONES</small>
                  ENTER MISSION
                </span>
                <b>↓</b>
              </button>

              <button
                type="button"
                className="ls-cta ls-cta-ghost"
                onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
                  spawnRipple(event)
                  scrollToData()
                }}
              >
                <span className="ls-cta-scan" />
                <span className="ls-cta-label">
                  <small>02 · SURFACE DATA</small>
                  EXPLORE LUNAR DATA
                </span>
                <b>→</b>
              </button>
            </div>

            {/* HUD readouts */}
            <div className="ls-hud-grid ls-intro ls-intro-5">
              <div className="ls-hud-cell">
                <small>MISSION STATUS</small>
                <strong className="is-good">
                  <i />
                  ONLINE
                </strong>
              </div>

              <div className="ls-hud-cell">
                <small>LUNAR DISTANCE</small>
                <strong>384,400 KM</strong>
              </div>

              <div className="ls-hud-cell">
                <small>ORBIT</small>
                <strong>ACTIVE · 100 KM</strong>
              </div>

              <div className="ls-hud-cell">
                <small>SIGNAL</small>
                <strong>
                  {selected.communication >= 85 ? 'STABLE' : 'VARIABLE'} · {selected.communication}%
                </strong>
              </div>

              <div className="ls-hud-cell">
                <small>MISSION TIMER</small>
                <strong className="is-gold">MET {formatMet(met)}</strong>
              </div>

              <div className="ls-hud-cell">
                <small>TARGET</small>
                <strong>{selected.code}</strong>
              </div>
            </div>

            {/* =================================================
                VOICE CONSOLE
            ================================================== */}

            <div className="voice-console ls-intro ls-intro-6">
              <button
                className={`voice-orb ${
                  isListening
                    ? 'listening'
                    : ''
                } ${
                  voiceOn
                    ? 'enabled'
                    : 'disabled'
                }`}
                type="button"
                onClick={
                  voiceOn
                    ? toggleVoice
                    : manualStartListening
                }
                aria-label={
                  voiceOn
                    ? 'Turn voice commands off'
                    : 'Turn voice commands on'
                }
              >
                <i />
                <i />
                <i />

                <span className="voice-orb-core">
                  {isListening
                    ? '◉'
                    : voiceOn
                      ? '◌'
                      : '×'}
                </span>
              </button>

              <div className="voice-console-info">
                <small>
                  COMMAND INTERFACE
                </small>

                <strong>
                  {isListening
                    ? 'LISTENING'
                    : voiceOn
                      ? 'VOICE ONLINE'
                      : 'VOICE MUTED'}
                </strong>

                <span>
                  {voiceOn
                    ? 'Say a site name or command'
                    : 'Tap the orb to reactivate'}
                </span>
              </div>
            </div>
          </div>

          {/* =================================================
              HERO STAGE
          ================================================== */}

          <div className="ls-stage-wrap ls-intro ls-intro-stage">
            <div className="ls-stage">
              <span className="ls-stage-corner ls-c-tl" />
              <span className="ls-stage-corner ls-c-tr" />
              <span className="ls-stage-corner ls-c-bl" />
              <span className="ls-stage-corner ls-c-br" />

              <div className="ls-stage-hud ls-stage-hud-top">
                <span>
                  <i />
                  ORBITAL TRACKING // LIVE
                </span>
                <span>INC 90.0° · ALT 100 KM</span>
              </div>

              {/* earth */}
              <div className="ls-earth">
                <span className="ls-earth-land" />
                <span className="ls-earth-cloud" />
                <span className="ls-earth-night" />
                <em>EARTH</em>
              </div>

              {/* back orbits (behind moon) */}
              <svg
                className="ls-orbits ls-orbits-back"
                viewBox="0 0 600 600"
                aria-hidden="true"
              >
                <defs>
                  <radialGradient id="lsEngine">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="45%" stopColor="#72e8ff" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#72e8ff" stopOpacity="0" />
                  </radialGradient>
                </defs>

                {ORBITS.map((o) => (
                  <g key={o.id} transform={`rotate(${o.tilt} 300 300)`}>
                    <path
                      d={ellipsePath(o.rx, o.ry)}
                      className="ls-orbit-path"
                      style={{ stroke: o.color }}
                    />

                    <path
                      d={ellipsePath(o.rx, o.ry)}
                      className="ls-orbit-trail"
                      style={{ stroke: o.color }}
                      pathLength={1}
                    >
                      <animate
                        attributeName="stroke-dashoffset"
                        values="0.07;-0.93"
                        dur={`${o.dur}s`}
                        repeatCount="indefinite"
                      />
                    </path>

                    <g className="ls-ship" style={{ color: o.color }}>
                      <circle cx="-9" r="6" fill="url(#lsEngine)" />
                      <path d="M -6 -3 L 7 0 L -6 3 Z" />
                      <animateMotion
                        dur={`${o.dur}s`}
                        repeatCount="indefinite"
                        rotate="auto"
                        path={ellipsePath(o.rx, o.ry)}
                      />
                      <animate
                        attributeName="opacity"
                        dur={`${o.dur}s`}
                        repeatCount="indefinite"
                        calcMode="discrete"
                        values="0;0.6"
                        keyTimes="0;0.5"
                      />
                    </g>
                  </g>
                ))}
              </svg>

              {/* moon */}
              <div className="ls-moon-parallax">
                <div className="ls-moon-float">
                  <div className="ls-moon-atmo" />
                  <div className="ls-moon">
                    <div className="ls-moon-base" />
                    <div className="ls-moon-texture" />
                    <div className="ls-moon-light" />
                    <div className="ls-moon-shadow" />
                    <div className="ls-moon-grid" />
                  </div>
                  <div className="ls-moon-rim" />
                </div>
              </div>

              {/* front orbits (in front of moon) */}
              <svg
                className="ls-orbits ls-orbits-front"
                viewBox="0 0 600 600"
                aria-hidden="true"
              >
                <line
                  className="ls-comm-beam"
                  x1="92"
                  y1="92"
                  x2={tx}
                  y2={ty}
                />

                {ORBITS.map((o) => (
                  <g key={o.id} transform={`rotate(${o.tilt} 300 300)`}>
                    <path
                      d={ellipsePath(o.rx, o.ry, true)}
                      className="ls-orbit-path ls-orbit-front"
                      style={{ stroke: o.color }}
                    />

                    <g className="ls-ship" style={{ color: o.color }}>
                      <circle cx="-11" r="8" fill="url(#lsEngine)" className="ls-engine" />
                      <rect x="-5" y="-9" width="4" height="6" className="ls-ship-panel" />
                      <rect x="-5" y="3" width="4" height="6" className="ls-ship-panel" />
                      <path d="M -7 -3.5 L 9 0 L -7 3.5 Z" />
                      <animateMotion
                        dur={`${o.dur}s`}
                        repeatCount="indefinite"
                        rotate="auto"
                        path={ellipsePath(o.rx, o.ry)}
                      />
                      <animate
                        attributeName="opacity"
                        dur={`${o.dur}s`}
                        repeatCount="indefinite"
                        calcMode="discrete"
                        values="1;0"
                        keyTimes="0;0.5"
                      />
                    </g>
                  </g>
                ))}
              </svg>

              {/* landing sequence — own svg so it restarts per site */}
              <svg
                key={selected.id}
                className="ls-orbits ls-landing"
                viewBox="0 0 600 600"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="lsFlame" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="35%" stopColor="#e5bd72" />
                    <stop offset="100%" stopColor="#e5a36c" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* descent guide */}
                <g className="ls-zone" transform={`translate(${tx} ${ty})`}>
                  <ellipse rx="26" ry="9" className="ls-zone-ring" />
                  <ellipse rx="14" ry="5" className="ls-zone-ring ls-zone-ring-2" />
                  <animate
                    attributeName="opacity"
                    dur={`${LANDING_DUR}s`}
                    repeatCount="indefinite"
                    calcMode="discrete"
                    values="0.25;1;0.25"
                    keyTimes="0;0.5;0.82"
                  />
                </g>

                {/* light trail */}
                <path
                  d={landingPath}
                  className="ls-landing-trail"
                  pathLength={1}
                >
                  <animate
                    attributeName="stroke-dashoffset"
                    dur={`${LANDING_DUR}s`}
                    repeatCount="indefinite"
                    values="0.06;-0.84;-0.905;-0.94;-0.94"
                    keyTimes="0;0.5;0.62;0.8;1"
                  />
                  <animate
                    attributeName="opacity"
                    dur={`${LANDING_DUR}s`}
                    repeatCount="indefinite"
                    calcMode="discrete"
                    values="1;0"
                    keyTimes="0;0.8"
                  />
                </path>

                {/* cruise ship (nose follows the path) */}
                <g className="ls-cruiser">
                  <circle cx="-12" r="9" fill="url(#lsEngine)" className="ls-engine" />
                  <path d="M -8 -4 L 11 0 L -8 4 Z" />
                  <rect x="-6" y="-10" width="5" height="6" className="ls-ship-panel" />
                  <rect x="-6" y="4" width="5" height="6" className="ls-ship-panel" />
                  <animateMotion
                    dur={`${LANDING_DUR}s`}
                    repeatCount="indefinite"
                    rotate="auto"
                    path={landingPath}
                    calcMode="linear"
                    keyPoints="0;0.9;0.965;1;1"
                    keyTimes="0;0.5;0.62;0.8;1"
                  />
                  <animate
                    attributeName="opacity"
                    dur={`${LANDING_DUR}s`}
                    repeatCount="indefinite"
                    calcMode="discrete"
                    values="1;0"
                    keyTimes="0;0.62"
                  />
                </g>

                {/* lander (upright for powered descent) */}
                <g className="ls-lander">
                  <g className="ls-lander-flame">
                    <path d="M -4 6 L 0 26 L 4 6 Z" fill="url(#lsFlame)" />
                    <animate
                      attributeName="opacity"
                      dur={`${LANDING_DUR}s`}
                      repeatCount="indefinite"
                      calcMode="discrete"
                      values="0;1;0"
                      keyTimes="0;0.62;0.8"
                    />
                  </g>
                  <path d="M -7 -8 L 7 -8 L 9 4 L -9 4 Z" className="ls-lander-body" />
                  <path d="M -9 4 L -13 10 M 9 4 L 13 10 M -15 10 L -11 10 M 11 10 L 15 10" className="ls-lander-legs" />
                  <circle cy="-11" r="3" className="ls-lander-cap" />
                  <animateMotion
                    dur={`${LANDING_DUR}s`}
                    repeatCount="indefinite"
                    path={landingPath}
                    calcMode="linear"
                    keyPoints="0;0.9;0.965;1;1"
                    keyTimes="0;0.5;0.62;0.8;1"
                  />
                  <animate
                    attributeName="opacity"
                    dur={`${LANDING_DUR}s`}
                    repeatCount="indefinite"
                    calcMode="discrete"
                    values="0;1"
                    keyTimes="0;0.62"
                  />
                </g>

                {/* touchdown dust */}
                <ellipse cx={tx} cy={ty + 4} rx="0" ry="0" className="ls-dust-ring">
                  <animate attributeName="rx" dur={`${LANDING_DUR}s`} repeatCount="indefinite" values="0;0;38;38" keyTimes="0;0.79;0.92;1" />
                  <animate attributeName="ry" dur={`${LANDING_DUR}s`} repeatCount="indefinite" values="0;0;10;10" keyTimes="0;0.79;0.92;1" />
                  <animate attributeName="opacity" dur={`${LANDING_DUR}s`} repeatCount="indefinite" values="0;0;0.9;0;0" keyTimes="0;0.79;0.81;0.94;1" />
                </ellipse>

                {/* touchdown confirmation */}
                <g className="ls-touchdown" transform={`translate(${tx} ${ty - 66})`}>
                  <rect x="-78" y="-15" width="156" height="30" rx="2" />
                  <text y="-2">TOUCHDOWN CONFIRMED</text>
                  <text y="10" className="ls-touchdown-sub">
                    {selected.code} · {selected.latitude}
                  </text>
                  <animate
                    attributeName="opacity"
                    dur={`${LANDING_DUR}s`}
                    repeatCount="indefinite"
                    calcMode="discrete"
                    values="0;1;0"
                    keyTimes="0;0.81;0.99"
                  />
                </g>
              </svg>

              {/* interactive landing-zone markers */}
              {lunarSites.map((site) => {
                const p = toStage(markerPosition(site))
                const active = site.id === selected.id

                return (
                  <button
                    key={site.id}
                    type="button"
                    className={`ls-marker ${active ? 'is-active' : ''}`}
                    style={{
                      left: `${(p.x / 600) * 100}%`,
                      top: `${(p.y / 600) * 100}%`,
                    }}
                    onClick={() => chooseSite(site)}
                    aria-label={`Select ${site.name}`}
                  >
                    <i />
                    <span className="ls-marker-card">
                      <small>LANDING ZONE · {site.code}</small>
                      <strong>{site.name}</strong>
                      <em>
                        {site.latitude} {site.longitude}
                      </em>
                      <span>
                        ☀ {site.sunlight}% · ◇ {site.ice} · {site.risk}
                      </span>
                    </span>
                  </button>
                )
              })}

              {/* floating astronaut */}
              <div className="ls-astro" aria-hidden="true">
                <div className="ls-astro-body">
                  <span className="ls-astro-pack" />
                  <span className="ls-astro-leg ls-astro-leg-l" />
                  <span className="ls-astro-leg ls-astro-leg-r" />
                  <span className="ls-astro-arm ls-astro-arm-l" />
                  <span className="ls-astro-torso">
                    <i />
                  </span>
                  <span className="ls-astro-arm ls-astro-arm-r" />
                  <span className="ls-astro-helmet">
                    <span className="ls-astro-visor">
                      <i />
                    </span>
                    <span className="ls-astro-lamp" />
                  </span>
                </div>
                <span className="ls-astro-tag">EVA-1 · CDR LOWE</span>
              </div>

              <div className="ls-stage-hud ls-stage-hud-bottom">
                <span>
                  LANDING ZONE <b>{selected.code}</b>
                </span>
                <span>
                  {selected.latitude} · {selected.longitude}
                </span>
              </div>
            </div>

            <p className="ls-stage-hint">
              Hover a marker for site data · click to select
            </p>
          </div>
        </div>

        {/* ===================================================
            TRANSCRIPT
        ==================================================== */}

        <div className="voice-transcript" data-reveal>
          <div className="transcript-left">
            <span className="transcript-dot" />

            <small>
              VOICE TELEMETRY
            </small>

            <strong>
              {transcript ||
                'Awaiting Commander input...'}
            </strong>
          </div>

          <div className="voice-command-hint">
            <span>TRY</span>

            <b>MALAPERT</b>
            <b>CONTINUE</b>
            <b>BACK</b>
          </div>
        </div>

        {/* ===================================================
            ANALYSIS LAYOUT
        ==================================================== */}

        <div className="ls-section-label" data-reveal>
          <span>02</span>
          LUNAR EXPLORATION // CANDIDATE LANDING ZONES
          <i />
        </div>

        <div
          className="site-analysis-layout"
          ref={layoutRef}
          data-reveal
        >

          {/* =================================================
              SITE LIST
          ================================================== */}

          <aside className="site-list-panel">
            <div className="panel-heading">
              <div>
                <span className="panel-number">
                  01
                </span>

                <div>
                  <small>
                    CANDIDATE DATABASE
                  </small>

                  <h2>
                    Landing Zones
                  </h2>
                </div>
              </div>

              <span className="site-count">
                {String(
                  lunarSites.length
                ).padStart(2, '0')}
                <small>
                  SITES
                </small>
              </span>
            </div>

            <div className="site-list">
              {lunarSites.map(
                (site, index) => {
                  const active =
                    selected.id === site.id

                  return (
                    <button
                      key={site.id}
                      type="button"
                      className={`site-card ${
                        active
                          ? 'active'
                          : ''
                      }`}
                      style={{ '--i': index } as CSSVars}
                      onClick={() => chooseSite(site)}
                    >
                      <span className="site-card-index">
                        {String(
                          index + 1
                        ).padStart(2, '0')}
                      </span>

                      <span className="site-card-content">
                        <span className="site-card-top">
                          <strong>
                            {site.name}
                          </strong>

                          <span
                            className={`site-risk ${site.risk.toLowerCase()}`}
                          >
                            {site.risk}
                          </span>
                        </span>

                        <span className="site-card-region">
                          {site.region}
                        </span>

                        <span className="site-card-bottom">
                          <span>
                            {site.latitude}
                          </span>

                          <span>
                            {site.longitude}
                          </span>

                          <span className="site-card-score">
                            {site.score}
                          </span>
                        </span>
                      </span>

                      <span className="site-card-arrow">
                        →
                      </span>
                    </button>
                  )
                }
              )}
            </div>

            <div className="site-list-footer">
              <span className="live-dot" />
              <span>
                LIVE ORBITAL DATA
              </span>

              <span className="footer-divider" />

              <span>
                UPDATED 2026
              </span>
            </div>
          </aside>

          {/* =================================================
              DASHBOARD
          ================================================== */}

          <section
            className="site-dashboard"
            ref={dashboardRef}
          >

            <div className="dashboard-top">
              <div>
                <span className="dashboard-kicker">
                  SELECTED CANDIDATE /{' '}
                  {selected.code}
                </span>

                <h2 className="dashboard-location" key={selected.id}>
                  {selected.name}
                </h2>

                <p>
                  {selected.region}
                </p>
              </div>

              <div className="site-score-box">
                <span>
                  SITE INDEX
                </span>

                <strong>
                  {selected.score}
                </strong>

                <small>
                  {scoreLabel}
                </small>
              </div>
            </div>

            {/* =================================================
                MOON MAP
            ================================================== */}

            <div className="moon-map">
              <div className="map-header">
                <span>
                  SURFACE POSITION
                </span>

                <span>
                  {selected.latitude}
                  &nbsp;&nbsp;
                  {selected.longitude}
                </span>
              </div>

              <div className="moon-map-body">

                <div className="moon-surface">
                  <div className="moon-glow" />

                  <span className="moon-crater crater-a" />
                  <span className="moon-crater crater-b" />
                  <span className="moon-crater crater-c" />
                  <span className="moon-crater crater-d" />
                  <span className="moon-crater crater-e" />

                  <div className="landing-target">
                    <span />
                    <i />
                  </div>

                  <span className="map-ring ring-a" />
                  <span className="map-ring ring-b" />
                  <span className="map-ring ring-c" />

                  <div className="map-crosshair">
                    <span />
                    <span />
                  </div>

                  <div className="map-coordinate">
                    <span>
                      {selected.latitude}
                    </span>

                    <span>
                      {selected.longitude}
                    </span>
                  </div>
                </div>

                <div className="map-overlay">
                  <span>
                    LANDING ZONE
                  </span>

                  <strong>
                    {selected.code}
                  </strong>

                  <small>
                    TARGET LOCKED
                  </small>
                </div>
              </div>
            </div>

            {/* =================================================
                TABS
            ================================================== */}

            <div className="dashboard-tabs">
              <button
                type="button"
                className={
                  activeTab === 'overview'
                    ? 'active'
                    : ''
                }
                onClick={() =>
                  setActiveTab(
                    'overview'
                  )
                }
              >
                OVERVIEW
              </button>

              <button
                type="button"
                className={
                  activeTab ===
                  'environment'
                    ? 'active'
                    : ''
                }
                onClick={() =>
                  setActiveTab(
                    'environment'
                  )
                }
              >
                ENVIRONMENT
              </button>

              <button
                type="button"
                className={
                  activeTab === 'risk'
                    ? 'active'
                    : ''
                }
                onClick={() =>
                  setActiveTab('risk')
                }
              >
                RISK
              </button>
            </div>

            {/* =================================================
                OVERVIEW
            ================================================== */}

            {activeTab ===
              'overview' && (
              <>
                <div className="metric-grid">

                  <article className="metric-card">
                    <div className="metric-icon">
                      ☼
                    </div>

                    <div className="metric-info">
                      <span>
                        SOLAR
                        ILLUMINATION
                      </span>

                      <strong>
                        {selected.sunlight}%
                      </strong>

                      <div className="metric-bar">
                        <i
                          style={{
                            width: `${selected.sunlight}%`,
                          }}
                        />
                      </div>

                      <small>
                        POWER POTENTIAL
                      </small>
                    </div>
                  </article>

                  <article className="metric-card">
                    <div className="metric-icon">
                      ◈
                    </div>

                    <div className="metric-info">
                      <span>
                        COMMUNICATION
                      </span>

                      <strong>
                        {selected.communication}%
                      </strong>

                      <div className="metric-bar">
                        <i
                          style={{
                            width: `${selected.communication}%`,
                          }}
                        />
                      </div>

                      <small>
                        LINE OF SIGHT
                      </small>
                    </div>
                  </article>

                  <article className="metric-card">
                    <div className="metric-icon">
                      ◇
                    </div>

                    <div className="metric-info">
                      <span>
                        WATER ICE
                      </span>

                      <strong>
                        {selected.ice}
                      </strong>

                      <div className="metric-bar">
                        <i
                          className="gold-bar"
                          style={{
                            width:
                              selected.ice ===
                              'VERY HIGH'
                                ? '96%'
                                : selected.ice ===
                                    'HIGH'
                                  ? '82%'
                                  : '55%',
                          }}
                        />
                      </div>

                      <small>
                        RESOURCE POTENTIAL
                      </small>
                    </div>
                  </article>
                </div>

                <div className="environment-grid">

                  <article className="environment-card">
                    <span>
                      TEMPERATURE
                    </span>

                    <strong>
                      {selected.temperature}
                    </strong>

                    <small>
                      SURFACE ESTIMATE
                    </small>
                  </article>

                  <article className="environment-card">
                    <span>
                      TERRAIN
                    </span>

                    <strong>
                      {selected.terrain}
                    </strong>

                    <small>
                      LANDING SURFACE
                    </small>
                  </article>

                  <article className="environment-card">
                    <span>
                      RISK
                    </span>

                    <strong className="risk-value">
                      {selected.risk}
                    </strong>

                    <small>
                      OPERATIONAL RISK
                    </small>
                  </article>
                </div>
              </>
            )}

            {/* =================================================
                ENVIRONMENT
            ================================================== */}

            {activeTab ===
              'environment' && (
              <div className="detail-view">

                <div className="detail-view-heading">
                  <span>
                    ENVIRONMENTAL PROFILE
                  </span>

                  <strong>
                    {selected.code}
                  </strong>
                </div>

                <div className="environment-large-grid">

                  <div className="environment-large-card">
                    <span>
                      THERMAL CONDITION
                    </span>

                    <strong>
                      {selected.temperature}
                    </strong>

                    <p>
                      Estimated surface
                      temperature at the
                      selected candidate
                      location.
                    </p>
                  </div>

                  <div className="environment-large-card">
                    <span>
                      TERRAIN CLASS
                    </span>

                    <strong>
                      {selected.terrain}
                    </strong>

                    <p>
                      Terrain classification
                      based on landing
                      surface stability
                      indicators.
                    </p>
                  </div>

                  <div className="environment-large-card">
                    <span>
                      ICE POTENTIAL
                    </span>

                    <strong>
                      {selected.ice}
                    </strong>

                    <p>
                      Relative potential for
                      accessible water-ice
                      resources.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* =================================================
                RISK
            ================================================== */}

            {activeTab === 'risk' && (
              <div className="risk-panel">

                <div className="risk-main">
                  <span>
                    MISSION RISK ASSESSMENT
                  </span>

                  <strong>
                    {selected.risk}
                  </strong>

                  <p>
                    Current candidate risk
                    classification based on
                    terrain, illumination,
                    thermal conditions and
                    communication access.
                  </p>
                </div>

                <div className="risk-bars">

                  <div className="risk-row">
                    <span>
                      TERRAIN
                    </span>

                    <div>
                      <i
                        style={{
                          width:
                            selected.terrain ===
                            'EXCELLENT'
                              ? '24%'
                              : selected.terrain ===
                                  'STABLE'
                                ? '35%'
                                : '62%',
                        }}
                      />
                    </div>

                    <b>
                      {selected.terrain}
                    </b>
                  </div>

                  <div className="risk-row">
                    <span>
                      THERMAL
                    </span>

                    <div>
                      <i
                        style={{
                          width:
                            selected.temperature ===
                            '-180°C'
                              ? '92%'
                              : selected.temperature ===
                                  '-120°C'
                                ? '72%'
                                : selected.temperature ===
                                    '-100°C'
                                  ? '65%'
                                  : '45%',
                        }}
                      />
                    </div>

                    <b>
                      {selected.temperature}
                    </b>
                  </div>

                  <div className="risk-row">
                    <span>
                      COMMUNICATION
                    </span>

                    <div>
                      <i
                        style={{
                          width: `${selected.communication}%`,
                        }}
                      />
                    </div>

                    <b>
                      {selected.communication}%
                    </b>
                  </div>
                </div>
              </div>
            )}

            {/* =================================================
                DESCRIPTION
            ================================================== */}

            <div className="site-description">
              <span className="description-marker">
                //
              </span>

              <div>
                <small>
                  MISSION ANALYSIS
                </small>

                <p>
                  {selected.description}
                </p>
              </div>
            </div>

            <div className="dashboard-footer">

              <button
                className="dashboard-back"
                type="button"
                onClick={onBack}
              >
                <span>←</span>
                MISSION BRIEF
              </button>

              <div className="selection-status">
                <span className="selection-status-dot" />

                <div>
                  <small>
                    SELECTED TARGET
                  </small>

                  <strong>
                    {selected.code}
                    {' · '}
                    {selected.name}
                  </strong>
                </div>
              </div>

              <button
                className="continue-button"
                type="button"
                onClick={onContinue}
              >
                <span>
                  CONTINUE
                </span>

                <b>→</b>
              </button>
            </div>
          </section>
        </div>

        {/* ===================================================
            CREW + MISSION CONTROL
        ==================================================== */}

        <div className="ls-section-label" data-reveal>
          <span>03</span>
          SURFACE CREW // MISSION CONTROL
          <i />
        </div>

        <div className="ls-crew-control" data-reveal>
          <div className="ls-crew">
            {CREW.map((member, i) => (
              <article
                key={member.id}
                className="ls-crew-card"
                style={{ '--i': i } as CSSVars}
              >
                <span className="ls-card-sweep" />

                <div className="ls-crew-top">
                  <span className="ls-crew-helmet">
                    <i />
                  </span>
                  <span className="ls-crew-led" />
                </div>

                <strong>{member.name}</strong>
                <small>{member.role}</small>

                <div className="ls-crew-suit">
                  <span>SUIT O₂</span>
                  <b>{member.suit}%</b>
                </div>

                <div className="ls-bar">
                  <i style={{ width: `${member.suit}%` }} />
                </div>

                <em>{member.task}</em>
              </article>
            ))}
          </div>

          <div className="ls-control">
            <span className="ls-card-sweep" />

            <div className="ls-control-head">
              <div>
                <small>MISSION CONTROL // HOUSTON</small>
                <strong>Descent Readiness</strong>
              </div>
              <span className="ls-control-live">
                <i />
                LIVE
              </span>
            </div>

            {[
              { label: 'POWER (SUNLIGHT)', value: selected.sunlight, tone: 'gold' },
              { label: 'EARTH LINK', value: selected.communication, tone: 'cyan' },
              { label: 'SITE INDEX', value: selected.score, tone: 'green' },
              {
                label: 'ICE RESOURCE',
                value: selected.ice === 'VERY HIGH' ? 96 : selected.ice === 'HIGH' ? 82 : 55,
                tone: 'violet',
              },
            ].map((row) => (
              <div className={`ls-control-row is-${row.tone}`} key={row.label}>
                <div>
                  <span>{row.label}</span>
                  <b>{row.value}%</b>
                </div>
                <div className="ls-bar">
                  <i style={{ width: `${row.value}%` }} />
                </div>
              </div>
            ))}

            <div className="ls-control-foot">
              <span>
                DESCENT PROFILE <b>{selected.terrain}</b>
              </span>
              <span>
                SURFACE <b>{selected.temperature}</b>
              </span>
              <span>
                RISK <b className={`is-${selected.risk.toLowerCase()}`}>{selected.risk}</b>
              </span>
            </div>
          </div>
        </div>

        {/* ===================================================
            FINAL CTA
        ==================================================== */}

        <div className="ls-final" data-reveal>
          <div className="ls-final-orbit">
            <i />
            <i />
            <span />
          </div>

          <div className="ls-final-copy">
            <small>TARGET LOCKED · {selected.code}</small>
            <h2>
              Ready to land at <span>{selected.name}</span>?
            </h2>
            <p>
              Lock this landing zone and move on to outfitting
              your lander with the right equipment.
            </p>
          </div>

          <div className="ls-final-actions">
            <button
              type="button"
              className="ls-cta ls-cta-ghost"
              onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
                spawnRipple(event)
                onBack()
              }}
            >
              <span className="ls-cta-scan" />
              <span className="ls-cta-label">
                <small>RETURN</small>
                MISSION BRIEF
              </span>
              <b>←</b>
            </button>

            <button
              type="button"
              className="ls-cta ls-cta-primary"
              onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
                spawnRipple(event)
                window.setTimeout(() => onContinue(), 260)
              }}
            >
              <span className="ls-cta-scan" />
              <span className="ls-cta-label">
                <small>CONFIRM {selected.code}</small>
                CONFIGURE PAYLOAD
              </span>
              <b>→</b>
            </button>
          </div>
        </div>

        {/* ===================================================
            BOTTOM COORDINATE HUD
        ==================================================== */}

        <div className="landing-coordinate">
          <div className="landing-coordinate-left">
            <span className="coordinate-cross">
              +
            </span>

            <span>
              LUNAR SOUTH POLE
            </span>

            <i />

            <span>
              ORBITAL ANALYSIS
            </span>
          </div>

          <div className="landing-coordinate-right">
            <span>
              CANDIDATE {formattedIndex}/
              {String(
                lunarSites.length
              ).padStart(2, '0')}
            </span>

            <span>
              SYSTEM NOMINAL
            </span>
          </div>
        </div>
      </section>
    </main>
  )
}

export default LandingSite
