import { useEffect, useRef, useState } from 'react'
import './WelcomeScreen.css'

const STAR_COUNT = 90

const dialogues = [
  {
    speaker: 'CDR LOWE',
    location: 'LUNAR SURFACE',
    text: "Houston, Moonix Base. We've reached the Shackleton rim.",
  },
  {
    speaker: 'HOUSTON',
    location: 'EARTH CONTROL',
    text: 'Copy, Moonix Base. Signal is clear. Begin the surface assessment.',
  },
  {
    speaker: 'LT. MAYA',
    location: 'LUNAR SURFACE',
    text: 'Commander, solar exposure is rising. We should choose our outpost location carefully.',
  },
  {
    speaker: 'HOUSTON',
    location: 'EARTH CONTROL',
    text: 'Your mission begins now, Commander. Analyze the terrain and make your first decision.',
  },
]

type WelcomeScreenProps = {
  onMissionBrief: () => void
}

export default function WelcomeScreen({
  onMissionBrief,
}: WelcomeScreenProps) {
  const starFieldRef = useRef<HTMLDivElement>(null)

  const [voiceOn, setVoiceOn] = useState(true)

  const [commText, setCommText] = useState(
    'Welcome to Moonix, commander.'
  )

  const [beginBusy, setBeginBusy] = useState(false)

  const [showMissionIntro, setShowMissionIntro] =
    useState(false)

  const [dialogueIndex, setDialogueIndex] =
    useState(0)

  const [typedText, setTypedText] =
    useState('')

  const [dialogueFinished, setDialogueFinished] =
    useState(false)

  /* =====================================================
     STAR FIELD
  ===================================================== */

  useEffect(() => {
    const field = starFieldRef.current

    if (!field) return

    field.innerHTML = ''

    for (let i = 0; i < STAR_COUNT; i++) {
      const star = document.createElement('span')

      const size =
        Math.random() < 0.15
          ? 3
          : Math.random() < 0.5
          ? 2
          : 1

      star.style.width = `${size}px`
      star.style.height = `${size}px`

      star.style.left =
        `${Math.random() * 100}%`

      star.style.top =
        `${Math.random() * 100}%`

      const tint = Math.random()

      star.style.background =
        tint < 0.12
          ? '#bcd4ff'
          : tint < 0.22
          ? '#ffe9c2'
          : '#ffffff'

      star.style.setProperty(
        '--d',
        `${(2 + Math.random() * 3).toFixed(2)}s`
      )

      star.style.setProperty(
        '--delay',
        `${(Math.random() * 4).toFixed(2)}s`
      )

      field.appendChild(star)
    }
  }, [beginBusy])

  /* =====================================================
     VOICE
  ===================================================== */

  const pickVoice = (
    voices: SpeechSynthesisVoice[]
  ) => {
    const preferred = [
      /Google US English/i,
      /Microsoft Guy/i,
      /Microsoft David/i,
      /Daniel/i,
      /Alex/i,
      /Google UK English Male/i,
    ]

    for (const pattern of preferred) {
      const voice = voices.find((v) =>
        pattern.test(v.name)
      )

      if (voice) return voice
    }

    return (
      voices.find((v) =>
        /en-US|en_US|en-GB/i.test(v.lang)
      ) ||
      voices[0] ||
      null
    )
  }

  const speak = (text: string) => {
    if (
      !voiceOn ||
      !('speechSynthesis' in window)
    ) {
      return
    }

    window.speechSynthesis.cancel()

    const utterance =
      new SpeechSynthesisUtterance(text)

    utterance.rate = 0.92
    utterance.pitch = 0.9
    utterance.volume = 1
    utterance.lang = 'en-US'

    const voice = pickVoice(
      window.speechSynthesis.getVoices()
    )

    if (voice) {
      utterance.voice = voice
    }

    window.speechSynthesis.speak(
      utterance
    )
  }

  /* =====================================================
     WELCOME VOICE
  ===================================================== */

  useEffect(() => {
    const timer = setTimeout(() => {
      speak(
        "Welcome to Moonix, commander. We've been expecting you."
      )
    }, 600)

    return () => clearTimeout(timer)

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* =====================================================
     VOICE TOGGLE
  ===================================================== */

  const toggleSound = () => {
    setVoiceOn((current) => {
      const next = !current

      if (!next) {
        window.speechSynthesis.cancel()
      }

      return next
    })
  }

  /* =====================================================
     BEGIN MISSION
  ===================================================== */

  const handleBegin = () => {
    setCommText(
      'Copy that, commander. Initiating site survey...'
    )

    speak(
      'Copy that, commander. Initiating site survey.'
    )

    setBeginBusy(true)

    /*
      Loading screen runs for 2.6 seconds.
      Then the cinematic lunar scene starts.
    */

    setTimeout(() => {
      setBeginBusy(false)

      setDialogueIndex(0)

      setShowMissionIntro(true)

      setTimeout(() => {
        speak(dialogues[0].text)
      }, 650)
    }, 2600)
  }

  /* =====================================================
     NEXT DIALOGUE
  ===================================================== */

  const handleNextDialogue = () => {
    if (
      dialogueIndex <
      dialogues.length - 1
    ) {
      const next =
        dialogueIndex + 1

      setDialogueIndex(next)

      speak(
        dialogues[next].text
      )
    }
  }

  /* =====================================================
     TYPEWRITER DIALOGUE
  ===================================================== */

  useEffect(() => {
    if (!showMissionIntro) return

    const text =
      dialogues[dialogueIndex].text

    setTypedText('')
    setDialogueFinished(false)

    let index = 0

    const typing =
      window.setInterval(() => {
        index += 1

        setTypedText(
          text.slice(0, index)
        )

        if (
          index >= text.length
        ) {
          window.clearInterval(
            typing
          )

          setDialogueFinished(true)
        }
      }, 28)

    return () => {
      window.clearInterval(
        typing
      )
    }
  }, [
    dialogueIndex,
    showMissionIntro,
  ])

  /* =====================================================
     CINEMATIC LUNAR INTRO
  ===================================================== */

  if (showMissionIntro) {
    const currentDialogue =
      dialogues[dialogueIndex]

    const isHouston =
      currentDialogue.speaker ===
      'HOUSTON'

    return (
      <div className="cinematic-lunar-scene">

        {/* =====================================
            SPACE
        ====================================== */}

        <div className="cinematic-space">

          <div className="cinematic-stars stars-one" />

          <div className="cinematic-stars stars-two" />

          <div className="cinematic-stars stars-three" />

        </div>

        {/* cinematic fade */}

        <div className="cinematic-vignette" />

        <div className="film-grain" />

        {/* =====================================
            SUNLIGHT
        ====================================== */}

        <div className="lunar-sunlight" />

        <div className="sun-flare flare-one" />

        <div className="sun-flare flare-two" />

        {/* =====================================
            EARTH
        ====================================== */}

        <div className="cinematic-earth">

          <div className="cinematic-earth-land land-one" />

          <div className="cinematic-earth-land land-two" />

          <div className="cinematic-earth-land land-three" />

          <div className="cinematic-cloud cloud-one" />

          <div className="cinematic-cloud cloud-two" />

          <div className="cinematic-cloud cloud-three" />

          <div className="earth-atmosphere" />

          <div className="earth-night" />

        </div>

        {/* Earth HUD */}

        <div className="earth-info">

          <div className="earth-crosshair">
            <span />
            <span />
          </div>

          <div className="earth-info-text">

            <strong>
              EARTH
            </strong>

            <span>
              384,400 KM
            </span>

          </div>

        </div>

        {/* =====================================
            EARTH RADIO SIGNAL
        ====================================== */}

        <div
          className={
            isHouston
              ? 'radio-signal-container radio-active'
              : 'radio-signal-container'
          }
        >

          <span className="radio-wave wave-one" />

          <span className="radio-wave wave-two" />

          <span className="radio-wave wave-three" />

        </div>

        {/* =====================================
            TOP MISSION HUD
        ====================================== */}

        <div className="cinematic-top-hud">

          <div className="cinematic-mission-name">

            <span className="hud-small">
              MISSION
            </span>

            <strong>
              MOONIX
            </strong>

          </div>

          <div className="hud-center-line">

            <span>
              LUNAR SOUTH POLE
            </span>

            <span className="hud-divider">
              //
            </span>

            <span>
              EVA-01
            </span>

          </div>

          <div className="communication-status">

            <span className="online-light" />

            COMM ONLINE

          </div>

        </div>

        {/* =====================================
            DISTANT MOUNTAINS
        ====================================== */}

        <div className="lunar-horizon">

          <div className="mountain mountain-far-one" />

          <div className="mountain mountain-far-two" />

          <div className="mountain mountain-middle" />

          <div className="mountain mountain-near" />

        </div>

        {/* =====================================
            MOON GROUND
        ====================================== */}

        <div className="real-lunar-ground">

          <div className="ground-highlight" />

          <div className="real-crater crater-a" />

          <div className="real-crater crater-b" />

          <div className="real-crater crater-c" />

          <div className="real-crater crater-d" />

          <div className="moon-rock moon-rock-one" />

          <div className="moon-rock moon-rock-two" />

          <div className="moon-rock moon-rock-three" />

        </div>

        {/* =====================================
            DUST
        ====================================== */}

        <div className="lunar-dust">

          <span className="dust dust-1" />
          <span className="dust dust-2" />
          <span className="dust dust-3" />
          <span className="dust dust-4" />
          <span className="dust dust-5" />
          <span className="dust dust-6" />

        </div>

        {/* =====================================
            COMMANDER ASTRONAUT
        ====================================== */}

        <div className="astronaut-wrapper commander-wrapper">

          <div className="astronaut-shadow" />

          <div className="real-astronaut commander">

            {/* backpack */}

            <div className="astro-backpack">

              <div className="pack-line pack-line-one" />

              <div className="pack-line pack-line-two" />

            </div>

            {/* helmet */}

            <div className="astro-real-helmet">

              <div className="helmet-ring" />

              <div className="real-visor">

                <div className="visor-space-reflection" />

                <div className="visor-earth-reflection" />

                <div className="visor-glare" />

              </div>

              <div className="helmet-side-light" />

            </div>

            {/* body */}

            <div className="astro-real-body">

              <div className="body-shadow" />

              <div className="astro-control-panel">

                <span className="panel-red" />

                <span className="panel-blue" />

                <span className="panel-green" />

              </div>

              <div className="moonix-patch">
                M
              </div>

              <div className="body-belt" />

            </div>

            {/* LEFT ARM */}

            <div className="astro-real-arm arm-real-left">

              <div className="arm-joint" />

              <div className="astro-glove" />

            </div>

            {/* RIGHT ARM */}

            <div className="astro-real-arm arm-real-right">

              <div className="arm-joint" />

              <div className="astro-glove" />

            </div>

            {/* LEFT LEG */}

            <div className="astro-real-leg leg-real-left">

              <div className="leg-joint" />

              <div className="astro-boot" />

            </div>

            {/* RIGHT LEG */}

            <div className="astro-real-leg leg-real-right">

              <div className="leg-joint" />

              <div className="astro-boot" />

            </div>

          </div>

          <div className="astronaut-id">

            <span className="astronaut-id-dot" />

            CDR LOWE

          </div>

        </div>

        {/* =====================================
            MAYA ASTRONAUT
        ====================================== */}

        <div className="astronaut-wrapper maya-wrapper">

          <div className="astronaut-shadow" />

          <div className="real-astronaut maya">

            <div className="astro-backpack">

              <div className="pack-line pack-line-one" />

              <div className="pack-line pack-line-two" />

            </div>

            <div className="astro-real-helmet">

              <div className="helmet-ring" />

              <div className="real-visor">

                <div className="visor-space-reflection" />

                <div className="visor-glare" />

              </div>

            </div>

            <div className="astro-real-body">

              <div className="body-shadow" />

              <div className="astro-control-panel">

                <span className="panel-red" />

                <span className="panel-blue" />

                <span className="panel-green" />

              </div>

              <div className="body-belt" />

            </div>

            <div className="astro-real-arm arm-real-left">

              <div className="arm-joint" />

              <div className="astro-glove" />

            </div>

            <div className="astro-real-arm arm-real-right">

              <div className="arm-joint" />

              <div className="astro-glove" />

            </div>

            <div className="astro-real-leg leg-real-left">

              <div className="leg-joint" />

              <div className="astro-boot" />

            </div>

            <div className="astro-real-leg leg-real-right">

              <div className="leg-joint" />

              <div className="astro-boot" />

            </div>

          </div>

          <div className="astronaut-id">

            <span className="astronaut-id-dot" />

            LT. MAYA

          </div>

        </div>

        {/* =====================================
            DISTANT EXPLORER
        ====================================== */}

        <div className="astronaut-wrapper explorer-wrapper">

          <div className="astronaut-shadow" />

          <div className="real-astronaut explorer">

            <div className="astro-backpack" />

            <div className="astro-real-helmet">

              <div className="helmet-ring" />

              <div className="real-visor">

                <div className="visor-glare" />

              </div>

            </div>

            <div className="astro-real-body">

              <div className="astro-control-panel" />

              <div className="body-belt" />

            </div>

            <div className="astro-real-arm arm-real-left">

              <div className="astro-glove" />

            </div>

            <div className="astro-real-arm arm-real-right">

              <div className="astro-glove" />

            </div>

            <div className="astro-real-leg leg-real-left">

              <div className="astro-boot" />

            </div>

            <div className="astro-real-leg leg-real-right">

              <div className="astro-boot" />

            </div>

          </div>

        </div>

        {/* =====================================
            LEFT LOCATION HUD
        ====================================== */}

        <div className="lunar-location-panel">

          <div className="location-line" />

          <span>
            CURRENT LOCATION
          </span>

          <strong>
            SHACKLETON CRATER
          </strong>

          <small>
            89.9° S // LUNAR SOUTH POLE
          </small>

        </div>

        {/* =====================================
            TELEMETRY
        ====================================== */}

        <div className="telemetry-panel">

          <div className="telemetry-row">

            <span>
              O₂
            </span>

            <strong>
              97%
            </strong>

          </div>

          <div className="telemetry-row">

            <span>
              SUIT
            </span>

            <strong>
              NOMINAL
            </strong>

          </div>

          <div className="telemetry-row">

            <span>
              SIGNAL
            </span>

            <strong>
              98.4%
            </strong>

          </div>

        </div>

        {/* =====================================
            DIALOGUE HUD
        ====================================== */}

        <div
          className={
            isHouston
              ? 'cinematic-dialogue houston-dialogue'
              : 'cinematic-dialogue'
          }
        >

          {/* left decorative line */}

          <div className="dialogue-accent-line" />

          <div className="cinematic-dialogue-header">

            <div className="speaker-information">

              <span
                className={
                  isHouston
                    ? 'transmission-dot earth-transmission'
                    : 'transmission-dot'
                }
              />

              <div>

                <strong>
                  {currentDialogue.speaker}
                </strong>

                <small>
                  {currentDialogue.location}
                </small>

              </div>

            </div>

            <div className="radio-frequency">

              <span className="frequency-bars">

                <i />
                <i />
                <i />
                <i />

              </span>

              {isHouston
                ? 'EARTH LINK'
                : 'LOCAL COMMS'}

            </div>

          </div>

          {/* DIALOGUE TEXT */}

          <div className="cinematic-dialogue-text">

            {typedText}

            {!dialogueFinished && (
              <span className="typing-cursor">
                █
              </span>
            )}

          </div>

          {/* FOOTER */}

          <div className="cinematic-dialogue-footer">

            <div className="transmission-count">

              TRANSMISSION{' '}

              {String(
                dialogueIndex + 1
              ).padStart(2, '0')}

              {' / '}

              {String(
                dialogues.length
              ).padStart(2, '0')}

            </div>

            {dialogueIndex <
            dialogues.length - 1 ? (

              <button
                className="cinematic-next-button"
                onClick={
                  handleNextDialogue
                }
                disabled={
                  !dialogueFinished
                }
              >

                CONTINUE

                <span>
                  →
                </span>

              </button>

            ) : (

             <div className="cinematic-options">

  <button
    className="enter-brief-button"
    onClick={onMissionBrief}
    disabled={!dialogueFinished}
  >
    <span className="option-number">
      01
    </span>

    ENTER MISSION BRIEF

    <span>
      →
    </span>
  </button>

</div>

            )}

          </div>

        </div>

        {/* cinematic black bars */}

        <div className="cinematic-bar cinematic-bar-top" />

        <div className="cinematic-bar cinematic-bar-bottom" />

      </div>
    )
  }

  /* =====================================================
     LOADING SCREEN
  ===================================================== */

  if (beginBusy) {
    return (
      <div className="ao-scene loading-page">

        <div className="bg">

          <div className="nebula nebula-a" />

          <div className="nebula nebula-b" />

          <div
            className="starfield"
            ref={starFieldRef}
          />

        </div>

        <div className="loading-container">

          <div className="loader-ring" />

          <h2 className="loading-text">
            LOADING
          </h2>

          <p className="loading-subtext">
            Initializing lunar outpost systems
            and calibrating life support...
          </p>

          <div className="loader-progress">

            <div className="loader-progress-bar" />

          </div>

        </div>

      </div>
    )
  }

  /* =====================================================
     WELCOME SCREEN
  ===================================================== */

  return (
    <div className="ao-scene">

      {/* =====================================
          BACKGROUND
      ====================================== */}

      <div className="bg">

        <div className="nebula nebula-a" />

        <div className="nebula nebula-b" />

        <div
          id="starfield"
          className="starfield"
          ref={starFieldRef}
        />

        {/* constellation */}

        <svg
          className="constellation"
          viewBox="0 0 200 160"
        >

          <polyline
            points="
              20,20
              45,10
              70,35
              60,60
              30,50
              20,20
            "
            fill="none"
            stroke="#ffffff66"
            strokeWidth={1}
            strokeDasharray="3 3"
          />

          <circle
            cx={20}
            cy={20}
            r={2}
            fill="#fff"
          />

          <circle
            cx={45}
            cy={10}
            r={2}
            fill="#fff"
          />

          <circle
            cx={70}
            cy={35}
            r={2}
            fill="#fff"
          />

          <circle
            cx={60}
            cy={60}
            r={2}
            fill="#fff"
          />

          <circle
            cx={30}
            cy={50}
            r={2}
            fill="#fff"
          />

        </svg>

        {/* =====================================
            EARTH
        ====================================== */}

        <div className="world">

          <div className="world-texture" />

          <div className="world-clouds" />

        </div>

        {/* sparkles */}

        <svg
          className="sparkle sparkle-a"
          viewBox="0 0 40 40"
        >

          <path
            d="
              M20 0
              L24 16
              L40 20
              L24 24
              L20 40
              L16 24
              L0 20
              L16 16
              Z
            "
            fill="#fff"
          />

        </svg>

        <svg
          className="sparkle sparkle-b"
          viewBox="0 0 40 40"
        >

          <path
            d="
              M20 0
              L24 16
              L40 20
              L24 24
              L20 40
              L16 24
              L0 20
              L16 16
              Z
            "
            fill="#fff"
          />

        </svg>

        {/* galaxy */}

        <div className="galaxy" />

        {/* =====================================
            MARS
        ====================================== */}

        <div className="mars">

          <div className="mars-swirl" />

        </div>

        {/* =====================================
            SATURN
        ====================================== */}

        <div className="saturn">

          <div className="saturn-ring" />

        </div>

        {/* =====================================
            ROCKET
        ====================================== */}

        <div className="rocket-float">

          <svg
            viewBox="0 0 200 150"
            className="rocket-svg"
          >

            <g
              transform="
                rotate(-28 100 75)
              "
            >

              {/* fire */}

              <path
                d="
                  M52 96
                  Q40 108 46 126
                  Q56 110 66 118
                  Q58 104 52 96Z
                "
                fill="#ffb100"
              />

              <path
                d="
                  M56 98
                  Q48 108 53 120
                  Q60 108 67 114
                  Q60 104 56 98Z
                "
                fill="#ff6b4a"
              />

              {/* rocket body */}

              <path
                d="
                  M62 70
                  Q62 36 104 24
                  Q146 36 146 70
                  L146 92
                  Q104 104 62 92
                  Z
                "
                fill="#f4f0ea"
                stroke="#274472"
                strokeWidth={2.5}
              />

              {/* window */}

              <circle
                cx={104}
                cy={52}
                r={15}
                fill="#274472"
              />

              <circle
                cx={104}
                cy={52}
                r={11}
                fill="#7ec8e3"
              />

              {/* fins */}

              <path
                d="
                  M62 80
                  L40 96
                  L63 92Z
                "
                fill="#e63946"
              />

              <path
                d="
                  M146 80
                  L168 96
                  L145 92Z
                "
                fill="#e63946"
              />

              {/* bottom */}

              <path
                d="
                  M74 92
                  Q104 104 134 92
                  L127 114
                  Q104 122 81 114
                  Z
                "
                fill="#ff8b5e"
              />

              {/* rocket astronaut arm */}

              <g id="rocketArm">

                <circle
                  cx={112}
                  cy={86}
                  r={15}
                  fill="#eef3f8"
                  stroke="#274472"
                  strokeWidth={2.5}
                />

                <path
                  d="
                    M124 82
                    C140 74
                    148 58
                    144 44
                  "
                  stroke="#eef3f8"
                  strokeWidth={9}
                  strokeLinecap="round"
                  fill="none"
                />

                <circle
                  cx={144}
                  cy={42}
                  r={6}
                  fill="#eef3f8"
                />

              </g>

            </g>

          </svg>

        </div>

        {/* =====================================
            ROCKS
        ====================================== */}

        <svg
          className="rock rock-a"
          viewBox="0 0 100 70"
        >

          <path
            d="
              M10 40
              Q5 15 35 12
              Q65 2 85 22
              Q100 35 80 55
              Q55 70 30 62
              Q8 60 10 40Z
            "
            fill="#4b5563"
          />

        </svg>

        <svg
          className="rock rock-b"
          viewBox="0 0 100 70"
        >

          <path
            d="
              M8 35
              Q12 10 40 10
              Q70 5 88 25
              Q96 40 72 52
              Q45 65 22 55
              Q4 50 8 35Z
            "
            fill="#3f4652"
          />

        </svg>

        <svg
          className="rock rock-c"
          viewBox="0 0 100 70"
        >

          <path
            d="
              M10 40
              Q5 15 35 12
              Q65 2 85 22
              Q100 35 80 55
              Q55 70 30 62
              Q8 60 10 40Z
            "
            fill="#555d6a"
          />

        </svg>

        {/* =====================================
            WELCOME ASTRONAUT
        ====================================== */}

        <div className="astronaut-float">

          <svg
            viewBox="0 0 160 200"
            className="astronaut-svg"
          >

            {/* backpack */}

            <rect
              x={55}
              y={70}
              width={50}
              height={70}
              rx={14}
              fill="#c3cbd6"
            />

            {/* left arm */}

            <path
              d="
                M45 92
                C18 92
                12 118
                22 142
              "
              stroke="#eef3f8"
              strokeWidth={16}
              strokeLinecap="round"
              fill="none"
            />

            <circle
              cx={20}
              cy={144}
              r={9}
              fill="#eef3f8"
            />

            {/* body */}

            <rect
              x={45}
              y={75}
              width={70}
              height={80}
              rx={26}
              fill="#eef3f8"
              stroke="#274472"
              strokeWidth={3}
            />

            {/* badge */}

            <circle
              cx={80}
              cy={106}
              r={12}
              fill="#e63946"
            />

            <path
              d="
                M80 99
                l3 7
                h7
                l-6 4
                2 7
                -6-4
                -6 4
                2-7
                -6-4
                h7
                Z
              "
              fill="#fff"
            />

            {/* waving arm */}

            <g id="waveArm">

              <path
                d="
                  M115 90
                  C142 82
                  152 55
                  146 33
                "
                stroke="#eef3f8"
                strokeWidth={16}
                strokeLinecap="round"
                fill="none"
              />

              <circle
                cx={146}
                cy={31}
                r={9}
                fill="#eef3f8"
              />

            </g>

            {/* helmet */}

            <circle
              cx={80}
              cy={48}
              r={35}
              fill="#274472"
            />

            <circle
              cx={80}
              cy={48}
              r={29}
              fill="#3a6fa5"
            />

            <ellipse
              cx={71}
              cy={42}
              rx={9}
              ry={12}
              fill="#a9c9e8"
              opacity={0.65}
            />

            {/* legs */}

            <rect
              x={50}
              y={150}
              width={20}
              height={32}
              rx={8}
              fill="#eef3f8"
              transform="
                rotate(-10 60 150)
              "
            />

            <rect
              x={90}
              y={150}
              width={20}
              height={32}
              rx={8}
              fill="#eef3f8"
              transform="
                rotate(12 100 150)
              "
            />

            {/* boots */}

            <rect
              x={45}
              y={175}
              width={28}
              height={14}
              rx={6}
              fill="#274472"
              transform="
                rotate(-10 59 182)
              "
            />

            <rect
              x={86}
              y={178}
              width={28}
              height={14}
              rx={6}
              fill="#274472"
              transform="
                rotate(12 100 185)
              "
            />

          </svg>

        </div>

        {/* =====================================
            MOON
        ====================================== */}

        <div className="moon">

          <div className="moon-texture" />

          <div className="moon-shade" />

        </div>

      </div>

      {/* =====================================
          MAIN UI
      ====================================== */}

      <div className="screen">

        {/* HUD */}

        <div className="hud-top">

          <span className="hud-tag">
            MISSION LOG
          </span>

          <span className="hud-tag hud-status">

            SYS{' '}

            <b>
              ONLINE
            </b>

          </span>

        </div>

        <div className="spacer" />

        {/* =====================================
            TITLE
        ====================================== */}

        <div className="title-block">

          <div className="pill-badge">

            MISSION BRIEF

          </div>

          <h1>
            Moonix
          </h1>

          <p className="subtitle-text">

            Get ready to explore the lunar
            south pole.

            <br />

            Are you ready to launch?

          </p>

        </div>

        <div className="spacer" />

        {/* =====================================
            COMMANDER MESSAGE
        ====================================== */}

        <div className="comm-line">

          <span className="comm-tag">

            CDR&nbsp;LOWE

          </span>

          <span>
            {commText}
          </span>

        </div>

        {/* =====================================
            BUTTONS
        ====================================== */}

        <div className="cta-row">

          <button
            className="btn-primary"
            onClick={handleBegin}
            disabled={beginBusy}
          >

            BEGIN MISSION

          </button>

          <button
            className="btn-ghost"
            aria-pressed={voiceOn}
            onClick={toggleSound}
          >

            {voiceOn
              ? '🔊 VOICE: ON'
              : '🔇 VOICE: OFF'}

          </button>

        </div>

        {/* =====================================
            BOTTOM HUD
        ====================================== */}

        <div className="hud-bottom">

          <span>

            MOON // SOUTH POLE,
            SHACKLETON CRATER RIM

          </span>

        </div>

      </div>

    </div>
  )
}