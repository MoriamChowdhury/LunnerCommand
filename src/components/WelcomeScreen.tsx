import { useEffect, useRef, useState } from 'react'
import './WelcomeScreen.css'

const STAR_COUNT = 90

export default function WelcomeScreen() {
  const starFieldRef = useRef<HTMLDivElement>(null)
  const [voiceOn, setVoiceOn] = useState(true)
  const [commText, setCommText] = useState('Welcome to Artemis Outpost, commander.')
  const [beginBusy, setBeginBusy] = useState(false)

  // Generate the twinkling starfield once on mount.
  useEffect(() => {
    const field = starFieldRef.current
    if (!field) return
    for (let i = 0; i < STAR_COUNT; i++) {
      const s = document.createElement('span')
      const size = Math.random() < 0.15 ? 3 : Math.random() < 0.5 ? 2 : 1
      s.style.width = `${size}px`
      s.style.height = `${size}px`
      s.style.left = `${Math.random() * 100}%`
      s.style.top = `${Math.random() * 100}%`
      const tint = Math.random()
      s.style.background = tint < 0.12 ? '#bcd4ff' : tint < 0.22 ? '#ffe9c2' : '#fff'
      s.style.setProperty('--d', `${(2 + Math.random() * 3).toFixed(2)}s`)
      s.style.setProperty('--delay', `${(Math.random() * 4).toFixed(2)}s`)
      field.appendChild(s)
    }
  }, [])

  const pickVoice = (voices: SpeechSynthesisVoice[]) => {
    const preferred = [
      /Google US English/i, /Microsoft Guy/i, /Microsoft David/i,
      /Daniel/i, /Alex/i, /Google UK English Male/i
    ]
    for (const pattern of preferred) {
      const v = voices.find((v) => pattern.test(v.name))
      if (v) return v
    }
    return voices.find((v) => /en-US|en_US|en-GB/i.test(v.lang)) || voices[0] || null
  }

  const speak = (text: string) => {
    if (!voiceOn || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 1
    u.pitch = 0.95
    u.volume = 1
    u.lang = 'en-US'
    const voice = pickVoice(window.speechSynthesis.getVoices())
    if (voice) u.voice = voice
    window.speechSynthesis.speak(u)
  }

  // Greet the commander shortly after the scene loads.
  useEffect(() => {
    const t = setTimeout(
      () => speak("Welcome to Artemis Outpost, commander. We've been expecting you."),
      600
    )
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleSound = () => {
    setVoiceOn((v) => {
      const next = !v
      if (!next) window.speechSynthesis.cancel()
      return next
    })
  }

  const handleBegin = () => {
    setCommText('Copy that, commander. Initiating site survey...')
    speak('Copy that, commander. Initiating site survey.')
    setBeginBusy(true)
    setTimeout(() => setBeginBusy(false), 1800)
  }

  return (
    <div className="ao-scene">
      <div className="bg">
        <div className="nebula nebula-a" />
        <div className="nebula nebula-b" />
        <div id="starfield" className="starfield" ref={starFieldRef} />

        <svg className="constellation" viewBox="0 0 200 160">
          <polyline
            points="20,20 45,10 70,35 60,60 30,50 20,20"
            fill="none"
            stroke="#ffffff66"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          <circle cx={20} cy={20} r={2} fill="#fff" />
          <circle cx={45} cy={10} r={2} fill="#fff" />
          <circle cx={70} cy={35} r={2} fill="#fff" />
          <circle cx={60} cy={60} r={2} fill="#fff" />
          <circle cx={30} cy={50} r={2} fill="#fff" />
        </svg>

        <div className="world">
          <div className="world-texture" />
          <div className="world-clouds" />
        </div>
        <svg className="sparkle sparkle-a" viewBox="0 0 40 40">
          <path d="M20 0 L24 16 L40 20 L24 24 L20 40 L16 24 L0 20 L16 16Z" fill="#fff" />
        </svg>
        <svg className="sparkle sparkle-b" viewBox="0 0 40 40">
          <path d="M20 0 L24 16 L40 20 L24 24 L20 40 L16 24 L0 20 L16 16Z" fill="#fff" />
        </svg>

        <div className="galaxy" />
        <div className="mars">
          <div className="mars-swirl" />
        </div>
        <div className="saturn">
          <div className="saturn-ring" />
        </div>

        <div className="rocket-float">
          <svg viewBox="0 0 200 150" className="rocket-svg">
            <g transform="rotate(-28 100 75)">
              <path d="M52 96 Q40 108 46 126 Q56 110 66 118 Q58 104 52 96Z" fill="#ffb100" />
              <path d="M56 98 Q48 108 53 120 Q60 108 67 114 Q60 104 56 98Z" fill="#ff6b4a" />
              <path
                d="M62 70 Q62 36 104 24 Q146 36 146 70 L146 92 Q104 104 62 92 Z"
                fill="#f4f0ea"
                stroke="#274472"
                strokeWidth={2.5}
              />
              <circle cx={104} cy={52} r={15} fill="#274472" />
              <circle cx={104} cy={52} r={11} fill="#7ec8e3" />
              <path d="M62 80 L40 96 L63 92Z" fill="#e63946" />
              <path d="M146 80 L168 96 L145 92Z" fill="#e63946" />
              <path d="M74 92 Q104 104 134 92 L127 114 Q104 122 81 114Z" fill="#ff8b5e" />
              <g id="rocketArm">
                <circle cx={112} cy={86} r={15} fill="#eef3f8" stroke="#274472" strokeWidth={2.5} />
                <path
                  d="M124 82 C140 74 148 58 144 44"
                  stroke="#eef3f8"
                  strokeWidth={9}
                  strokeLinecap="round"
                  fill="none"
                />
                <circle cx={144} cy={42} r={6} fill="#eef3f8" />
              </g>
            </g>
          </svg>
        </div>

        <svg className="rock rock-a" viewBox="0 0 100 70">
          <path d="M10 40 Q5 15 35 12 Q65 2 85 22 Q100 35 80 55 Q55 70 30 62 Q8 60 10 40Z" fill="#4b5563" />
        </svg>
        <svg className="rock rock-b" viewBox="0 0 100 70">
          <path d="M8 35 Q12 10 40 10 Q70 5 88 25 Q96 40 72 52 Q45 65 22 55 Q4 50 8 35Z" fill="#3f4652" />
        </svg>
        <svg className="rock rock-c" viewBox="0 0 100 70">
          <path d="M10 40 Q5 15 35 12 Q65 2 85 22 Q100 35 80 55 Q55 70 30 62 Q8 60 10 40Z" fill="#555d6a" />
        </svg>

        <div className="astronaut-float">
          <svg viewBox="0 0 160 200" className="astronaut-svg">
            <rect x={55} y={70} width={50} height={70} rx={14} fill="#c3cbd6" />
            <path d="M45 92 C18 92 12 118 22 142" stroke="#eef3f8" strokeWidth={16} strokeLinecap="round" fill="none" />
            <circle cx={20} cy={144} r={9} fill="#eef3f8" />
            <rect x={45} y={75} width={70} height={80} rx={26} fill="#eef3f8" stroke="#274472" strokeWidth={3} />
            <circle cx={80} cy={106} r={12} fill="#e63946" />
            <path d="M80 99 l3 7 h7 l-6 4 2 7 -6-4 -6 4 2-7 -6-4 h7Z" fill="#fff" />
            <g id="waveArm">
              <path d="M115 90 C142 82 152 55 146 33" stroke="#eef3f8" strokeWidth={16} strokeLinecap="round" fill="none" />
              <circle cx={146} cy={31} r={9} fill="#eef3f8" />
            </g>
            <circle cx={80} cy={48} r={35} fill="#274472" />
            <circle cx={80} cy={48} r={29} fill="#3a6fa5" />
            <ellipse cx={71} cy={42} rx={9} ry={12} fill="#a9c9e8" opacity={0.65} />
            <rect x={50} y={150} width={20} height={32} rx={8} fill="#eef3f8" transform="rotate(-10 60 150)" />
            <rect x={90} y={150} width={20} height={32} rx={8} fill="#eef3f8" transform="rotate(12 100 150)" />
            <rect x={45} y={175} width={28} height={14} rx={6} fill="#274472" transform="rotate(-10 59 182)" />
            <rect x={86} y={178} width={28} height={14} rx={6} fill="#274472" transform="rotate(12 100 185)" />
          </svg>
        </div>

        <div className="moon">
          <div className="moon-texture" />
          <div className="moon-shade" />
        </div>
      </div>

      <div className="screen">
        <div className="hud-top">
          <span className="hud-tag">MISSION LOG</span>
          <span className="hud-tag hud-status">
            SYS <b>ONLINE</b>
          </span>
        </div>

        <div className="spacer" />

        <div className="title-block">
          <div className="pill-badge">MISSION BRIEF</div>
          <h1>
            ARTEMIS
            <br />
            OUTPOST
          </h1>
          <p className="subtitle-text">
            Get ready to explore the lunar south pole.
            <br />
            Are you ready to launch?
          </p>
        </div>

        <div className="spacer" />

        <div className="comm-line">
          <span className="comm-tag">CDR&nbsp;LOWE</span>
          <span>{commText}</span>
        </div>

        <div className="cta-row">
          <button className="btn-primary" onClick={handleBegin} disabled={beginBusy} style={{ opacity: beginBusy ? 0.6 : 1 }}>
            BEGIN MISSION
          </button>
          <button className="btn-ghost" aria-pressed={voiceOn} onClick={toggleSound}>
            {voiceOn ? '🔊 VOICE: ON' : '🔇 VOICE: OFF'}
          </button>
        </div>

        <div className="hud-bottom">
          <span>MOON // SOUTH POLE, SHACKLETON CRATER RIM</span>
        </div>
      </div>
    </div>
  )
}