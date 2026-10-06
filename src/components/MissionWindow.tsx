import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import type {
  ChangeEvent,
  CSSProperties,
  FormEvent,
  MouseEvent as ReactMouseEvent,
} from 'react'

import {
  lunarSites,
  type LunarSite,
} from '../data/lunarSites'

import { equipmentList } from '../data/equipment'

import {
  launchWindows,
  type LaunchWindow,
} from '../data/launchWindows.ts'

import './MissionWindow.css'

/* =========================================================
   TYPES
   ========================================================= */

type MissionWindowProps = {
  selectedSite: string
  selectedEquipment: string[]
  selectedWindow: string
  onSelectWindow: (id: string) => void
  onBack: () => void
  onContinue: () => void
}

type SpeechRecognitionResultLike = {
  [index: number]: { transcript: string }
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

type Telemetry = {
  oxygen: number
  fuel: number
  energy: number
  comms: number
  surfaceTemp: number
  habitatTemp: number
  radiation: number
  crew: number
}

type PollResult = {
  id: string
  name: string
  role: string
  go: boolean
  note: string
}

type AlertLevel = 'critical' | 'warning' | 'info'

type MissionAlert = {
  id: string
  level: AlertLevel
  title: string
  detail: string
}

type PhaseState = 'done' | 'active' | 'pending'

type Phase = {
  id: string
  t: string
  title: string
  detail: string
  state: PhaseState
}

type Task = {
  id: string
  label: string
  kind: 'auto' | 'manual'
  done: boolean
  disabled?: boolean
}

type CommandSource = 'VOICE' | 'TEXT' | 'SYSTEM'

type HistoryEntry = {
  id: number
  time: string
  source: CommandSource
  command: string
  response: string
}

type AiMessage = {
  id: number
  text: string
}

type WaveMode = 'idle' | 'listening' | 'speaking'

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

const CREW = [
  { id: 'lowe', name: 'CDR LOWE', role: 'COMMANDER', bpm: 68 },
  { id: 'maya', name: 'LT. MAYA', role: 'PILOT', bpm: 72 },
  { id: 'okafor', name: 'DR. OKAFOR', role: 'SCIENCE LEAD', bpm: 64 },
  { id: 'rossi', name: 'ENG. ROSSI', role: 'FLIGHT ENGINEER', bpm: 75 },
]

const QUICK_COMMANDS = [
  'Status report',
  'Recommend window',
  'Run GO / NO-GO poll',
  'Radiation',
  'Scan surface',
  'Alerts',
]

const COUNTDOWN_START = 72 * 3600

/* orbit definitions in the 600×600 theater viewBox */
const ORBITS = [
  { id: 'relay', label: 'RELAY-1', rx: 250, ry: 64, tilt: -16, dur: 17, color: '#72e8ff' },
  { id: 'gateway', label: 'GATEWAY', rx: 286, ry: 104, tilt: 11, dur: 29, color: '#e5bd72' },
  { id: 'probe', label: 'LRO', rx: 205, ry: 44, tilt: 34, dur: 11, color: '#b99cff' },
]

/* deterministic background particles (no randomness during render) */
const PARTICLES = Array.from({ length: 26 }, (_, i) => ({
  id: i,
  left: (i * 37.7) % 100,
  size: 1 + ((i * 7) % 3),
  dur: 14 + ((i * 5) % 11),
  delay: -((i * 3.3) % 20),
  drift: ((i * 13) % 60) - 30,
}))

/* =========================================================
   HELPERS
   ========================================================= */

const clamp = (value: number) =>
  Math.max(0, Math.min(100, Math.round(value)))

const has = (ids: string[], id: string) => ids.includes(id)

const parseTemperature = (value: string) => {
  const n = parseInt(value.replace('−', '-'), 10)
  return Number.isNaN(n) ? -100 : n
}

const noise = (tick: number, seed: number, amp: number) =>
  Math.sin(tick * 1.37 + seed * 2.1) * amp +
  Math.sin(tick * 0.61 + seed) * amp * 0.5

const pad = (n: number) => String(n).padStart(2, '0')

const formatCountdown = (seconds: number) => {
  const s = Math.max(0, seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `T-${pad(h)}:${pad(m)}:${pad(s % 60)}`
}

const formatElapsed = (seconds: number) =>
  `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const hasWord = (text: string, word: string) =>
  new RegExp(`\\b${escapeRegExp(word)}\\b`).test(text)

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

/* ---------------- TELEMETRY MODEL ---------------- */

function computeTelemetry(
  site: LunarSite,
  ids: string[],
  win?: LaunchWindow
): Telemetry {
  const sun = win?.sun ?? 65
  const earth = win?.earth ?? 78
  const flare = win?.solarActivity ?? 0.2

  const solarGain = has(ids, 'solar')
    ? 34 * (site.sunlight / 100) * (sun / 80)
    : 0

  const energy = clamp(
    site.sunlight * 0.38 +
      sun * 0.22 +
      solarGain +
      (has(ids, 'battery') ? 16 : 0) +
      (has(ids, 'thermal') ? 3 : 0) -
      (has(ids, 'lab') ? 7 : 0) -
      (has(ids, 'rover') ? 5 : 0)
  )

  const riskPenalty =
    site.risk === 'HIGH' ? 8 : site.risk === 'MEDIUM' ? 4 : 0

  const oxygen = clamp(
    80 +
      (has(ids, 'water') ? 13 : 0) +
      (has(ids, 'shelter') ? 2 : 0) -
      riskPenalty
  )

  const iceRich = site.ice === 'VERY HIGH' || site.ice === 'HIGH'

  const fuel = clamp(
    68 +
      (has(ids, 'water') ? (iceRich ? 18 : 10) : 0) -
      (has(ids, 'rover') ? 6 : 0) +
      (sun >= 70 ? 4 : 0)
  )

  const comms = clamp(
    site.communication * 0.55 +
      earth * 0.3 +
      (has(ids, 'comms') ? 20 : 0)
  )

  const surfaceTemp = Math.round(
    parseTemperature(site.temperature) + (sun - 65) * 1.2
  )

  const habitatTemp = has(ids, 'thermal')
    ? 21
    : Math.round(15 - (65 - sun) * 0.15)

  const radiation =
    Math.round(
      Math.max(
        0.2,
        0.55 + flare * 2.2 - (has(ids, 'shelter') ? 0.45 : 0)
      ) * 100
    ) / 100

  const comfort =
    habitatTemp >= 18 && habitatTemp <= 24 ? 100 : 78

  const crew = clamp(
    (oxygen + (100 - radiation * 45) + comfort) / 3
  )

  return {
    oxygen,
    fuel,
    energy,
    comms,
    surfaceTemp,
    habitatTemp,
    radiation,
    crew,
  }
}

const readinessOf = (t: Telemetry) =>
  clamp((t.energy + t.oxygen + t.fuel + t.comms + t.crew) / 5)

function windowScore(
  site: LunarSite,
  ids: string[],
  win: LaunchWindow
) {
  const t = computeTelemetry(site, ids, win)
  return clamp(
    t.energy * 0.42 +
      t.comms * 0.28 +
      (100 - t.radiation * 45) * 0.3
  )
}

function runPoll(
  site: LunarSite,
  ids: string[],
  t: Telemetry,
  win: LaunchWindow | undefined
): PollResult[] {
  const readiness = readinessOf(t)

  return [
    {
      id: 'fido',
      name: 'FIDO',
      role: 'Flight Dynamics',
      go: Boolean(win),
      note: win ? `${win.month} trajectory loaded` : 'No launch window locked',
    },
    {
      id: 'gnc',
      name: 'GNC',
      role: 'Guidance & Landing',
      go: site.risk !== 'HIGH',
      note: `${site.terrain} terrain · ${site.risk} risk`,
    },
    {
      id: 'eecom',
      name: 'EECOM',
      role: 'Electrical & Power',
      go: t.energy >= 55,
      note: `Power margin ${t.energy}%`,
    },
    {
      id: 'inco',
      name: 'INCO',
      role: 'Communications',
      go: t.comms >= 65,
      note: `Earth link ${t.comms}%`,
    },
    {
      id: 'eva',
      name: 'EVA',
      role: 'Surface Operations',
      go: t.surfaceTemp > -150 || has(ids, 'thermal'),
      note: `Surface ${t.surfaceTemp}°C${has(ids, 'thermal') ? ' · shielded' : ''}`,
    },
    {
      id: 'surgeon',
      name: 'SURGEON',
      role: 'Crew Health',
      go: t.crew >= 70 && t.radiation < 1.1,
      note: `Crew ${t.crew}% · ${t.radiation.toFixed(2)} mSv/day`,
    },
    {
      id: 'flight',
      name: 'FLIGHT',
      role: 'Flight Director',
      go: readiness >= 60 && Boolean(win),
      note: `Mission readiness ${readiness}%`,
    },
  ]
}

function buildAlerts(
  site: LunarSite,
  ids: string[],
  t: Telemetry,
  win: LaunchWindow | undefined
): MissionAlert[] {
  const alerts: MissionAlert[] = []

  if (!win) {
    alerts.push({
      id: 'window',
      level: 'warning',
      title: 'LAUNCH WINDOW NOT LOCKED',
      detail: 'Select a month to compute the trajectory.',
    })
  }

  if (t.energy < 50) {
    alerts.push({
      id: 'power',
      level: 'critical',
      title: 'POWER MARGIN CRITICAL',
      detail: `Only ${t.energy}% — add storage or pick a sunnier month.`,
    })
  } else if (t.energy < 62) {
    alerts.push({
      id: 'power',
      level: 'warning',
      title: 'POWER MARGIN LOW',
      detail: `${t.energy}% available through lunar shadow.`,
    })
  }

  if (t.radiation >= 1) {
    alerts.push({
      id: 'rad',
      level: 'critical',
      title: 'SOLAR PARTICLE EVENT RISK',
      detail: has(ids, 'shelter')
        ? 'Storm shelter ready — monitor space weather.'
        : 'No storm shelter aboard the lander.',
    })
  } else if (t.radiation >= 0.8) {
    alerts.push({
      id: 'rad',
      level: 'warning',
      title: 'ELEVATED RADIATION',
      detail: `${t.radiation.toFixed(2)} mSv/day forecast.`,
    })
  }

  if (t.comms < 65) {
    alerts.push({
      id: 'comms',
      level: 'warning',
      title: 'EARTH LINK DEGRADED',
      detail: 'Terrain masking expected — relay advised.',
    })
  }

  if (t.surfaceTemp <= -150 && !has(ids, 'thermal')) {
    alerts.push({
      id: 'cold',
      level: 'critical',
      title: 'EXTREME COLD EXPOSURE',
      detail: `${t.surfaceTemp}°C at ${site.code} with no thermal shield.`,
    })
  }

  if (t.oxygen < 85) {
    alerts.push({
      id: 'o2',
      level: 'warning',
      title: 'O₂ RESERVE BELOW TARGET',
      detail: 'An ice extraction drill would extend reserves.',
    })
  }

  alerts.push({
    id: 'dsn',
    level: 'info',
    title: 'DSN PASS · CANBERRA 70M',
    detail: 'Deep Space Network downlink acquired.',
  })

  return alerts
}

/* south-pole projection for the site markers (percent of moon disc) */
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

const ellipsePath = (rx: number, ry: number, half = false) => {
  const cx = 300
  const cy = 300
  const front = `M ${cx + rx} ${cy} A ${rx} ${ry} 0 0 1 ${cx - rx} ${cy}`
  if (half) return front
  return `${front} A ${rx} ${ry} 0 0 1 ${cx + rx} ${cy}`
}

/* =========================================================
   SMALL PRESENTATIONAL COMPONENTS
   ========================================================= */

function TypeLine({
  text,
  speed = 16,
}: {
  text: string
  speed?: number
}) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (count >= text.length) return
    const timer = window.setTimeout(
      () => setCount((c) => Math.min(text.length, c + 2)),
      speed
    )
    return () => window.clearTimeout(timer)
  }, [count, text, speed])

  return (
    <>
      {text.slice(0, count)}
      {count < text.length && (
        <span className="mc-caret">▌</span>
      )}
    </>
  )
}

function RingGauge({
  label,
  value,
  display,
  unit,
  color,
  caption,
}: {
  label: string
  value: number
  display: string
  unit: string
  color: string
  caption: string
}) {
  const r = 34
  const c = 2 * Math.PI * r
  const offset = c * (1 - Math.max(0, Math.min(100, value)) / 100)
  const level = value < 50 ? 'is-bad' : value < 70 ? 'is-mid' : ''

  return (
    <div
      className={`mc-ring ${level}`}
      style={{ '--accent': color } as CSSVars}
    >
      <svg viewBox="0 0 84 84">
        <circle className="mc-ring-ticks" cx="42" cy="42" r="40" />
        <circle className="mc-ring-track" cx="42" cy="42" r={r} />
        <circle
          className="mc-ring-fill"
          cx="42"
          cy="42"
          r={r}
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>

      <div className="mc-ring-center">
        <strong>{display}</strong>
        <small>{unit}</small>
      </div>

      <div className="mc-ring-label">
        <span>{label}</span>
        <em>{caption}</em>
      </div>
    </div>
  )
}

function WaveformCanvas({ mode }: { mode: WaveMode }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const modeRef = useRef<WaveMode>(mode)

  useEffect(() => {
    modeRef.current = mode
  }, [mode])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let frame = 0
    let amp = 0.08
    let phase = 0

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width = Math.max(1, rect.width * dpr)
      canvas.height = Math.max(1, rect.height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    resize()

    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(resize)
        : null
    observer?.observe(canvas)

    const layers = [
      { color: 'rgba(114, 232, 255, 0.95)', freq: 1.6, speed: 0.09, scale: 1, width: 2 },
      { color: 'rgba(185, 156, 255, 0.55)', freq: 2.4, speed: -0.06, scale: 0.7, width: 1.5 },
      { color: 'rgba(229, 189, 114, 0.45)', freq: 3.3, speed: 0.13, scale: 0.45, width: 1 },
    ]

    const draw = () => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      const current = modeRef.current
      const target =
        current === 'speaking' ? 0.85 : current === 'listening' ? 0.45 : 0.08

      amp += (target - amp) * 0.06
      phase += 1

      ctx.clearRect(0, 0, w, h)

      ctx.strokeStyle = 'rgba(114, 232, 255, 0.08)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, h / 2)
      ctx.lineTo(w, h / 2)
      ctx.stroke()

      for (const layer of layers) {
        ctx.beginPath()
        ctx.lineWidth = layer.width
        ctx.strokeStyle = layer.color
        ctx.shadowColor = layer.color
        ctx.shadowBlur = 8

        for (let x = 0; x <= w; x += 2) {
          const p = x / w
          const envelope = Math.sin(Math.PI * p)
          const jitter =
            current === 'idle'
              ? 0
              : Math.sin(x * 0.21 + phase * 0.5) * 0.25
          const y =
            h / 2 +
            Math.sin(p * Math.PI * 2 * layer.freq + phase * layer.speed) *
              (h * 0.42) *
              amp *
              layer.scale *
              envelope *
              (1 + jitter)

          if (x === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }

        ctx.stroke()
      }

      ctx.shadowBlur = 0
      frame = window.requestAnimationFrame(draw)
    }

    frame = window.requestAnimationFrame(draw)

    return () => {
      window.cancelAnimationFrame(frame)
      observer?.disconnect()
    }
  }, [])

  return <canvas ref={canvasRef} className="mc-wave-canvas" />
}

/* =========================================================
   MAIN COMPONENT
   ========================================================= */

export default function MissionWindow({
  selectedSite,
  selectedEquipment,
  selectedWindow,
  onSelectWindow,
  onBack,
  onContinue,
}: MissionWindowProps) {
  const site =
    lunarSites.find((s) => s.id === selectedSite) ?? lunarSites[0]

  const win = launchWindows.find((w) => w.id === selectedWindow)

  /* ---------------- STATE ---------------- */

  const [booting, setBooting] = useState(true)
  const [tick, setTick] = useState(0)
  const [elapsed, setElapsed] = useState(0)

  const [voiceOn, setVoiceOn] = useState(true)
  const [isListening, setIsListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState(() =>
    getSpeechRecognitionAPI()
      ? 'VOICE LINK READY'
      : 'VOICE INPUT NOT SUPPORTED'
  )
  const [transcript, setTranscript] = useState('')
  const [draft, setDraft] = useState('')

  const [aiMessage, setAiMessage] = useState<AiMessage>(() => ({
    id: 0,
    text: `Mission control online. Target ${site.name}, ${selectedEquipment.length} payload modules secured. Lock a launch window, then run the GO / NO-GO poll.`,
  }))

  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [pollStep, setPollStep] = useState(-1)
  const [scanning, setScanning] = useState(false)
  const [scannedOnce, setScannedOnce] = useState(false)
  const [manualTasks, setManualTasks] = useState<string[]>([])
  const [launching, setLaunching] = useState(false)

  /* ---------------- REFS ---------------- */

  const pageRef = useRef<HTMLElement | null>(null)
  const frameRef = useRef(0)
  const recognitionRef =
    useRef<SpeechRecognitionInstance | null>(null)
  const voiceOnRef = useRef(true)
  const shouldRestartRef = useRef(true)
  const mountedRef = useRef(true)
  const startRef = useRef(0)
  const idRef = useRef(1)
  const commandRef = useRef<
    (text: string, source: CommandSource) => void
  >(() => {})

  /* ---------------- DERIVED ---------------- */

  const telemetry = useMemo(
    () => computeTelemetry(site, selectedEquipment, win),
    [site, selectedEquipment, win]
  )

  const readiness = readinessOf(telemetry)

  const scores = useMemo(
    () =>
      launchWindows.map((w) => ({
        id: w.id,
        score: windowScore(site, selectedEquipment, w),
        energy: computeTelemetry(site, selectedEquipment, w).energy,
      })),
    [site, selectedEquipment]
  )

  const bestWindow = useMemo(() => {
    const best = [...scores].sort((a, b) => b.score - a.score)[0]
    return launchWindows.find((w) => w.id === best.id) ?? launchWindows[0]
  }, [scores])

  const pollResults = useMemo(
    () => runPoll(site, selectedEquipment, telemetry, win),
    [site, selectedEquipment, telemetry, win]
  )

  const pollRunning =
    pollStep >= 0 && pollStep < pollResults.length
  const pollDone = pollStep >= pollResults.length
  const pollGo = pollDone && pollResults.every((r) => r.go)

  const alerts = useMemo(
    () => buildAlerts(site, selectedEquipment, telemetry, win),
    [site, selectedEquipment, telemetry, win]
  )

  const criticalCount = alerts.filter(
    (a) => a.level === 'critical'
  ).length

  const installed = equipmentList.filter((item) =>
    selectedEquipment.includes(item.id)
  )

  const hasRelay = selectedEquipment.includes('comms')

  /* live jitter so the dashboard breathes */
  const live = {
    oxygen: Math.min(100, telemetry.oxygen + noise(tick, 1, 0.6)),
    fuel: Math.min(100, telemetry.fuel + noise(tick, 2, 0.3)),
    energy: Math.min(100, telemetry.energy + noise(tick, 3, 1.4)),
    comms: Math.min(100, telemetry.comms + noise(tick, 4, 1.8)),
    surfaceTemp: telemetry.surfaceTemp + noise(tick, 5, 0.8),
    habitatTemp: telemetry.habitatTemp + noise(tick, 6, 0.15),
    radiation: Math.max(0.05, telemetry.radiation + noise(tick, 7, 0.02)),
  }

  const missionStatus = launching
    ? 'LAUNCH SEQUENCE'
    : pollGo
      ? 'GO FOR LAUNCH'
      : pollDone
        ? 'HOLD — NO-GO'
        : win
          ? 'WINDOW LOCKED'
          : 'PRE-LAUNCH'

  const statusTone = launching || pollGo
    ? 'is-go'
    : pollDone
      ? 'is-hold'
      : win
        ? 'is-ready'
        : 'is-idle'

  const phases: Phase[] = [
    {
      id: 'integ',
      t: 'T-72H',
      title: 'Payload Integration',
      detail: `${installed.length} modules secured`,
      state: 'done',
    },
    {
      id: 'window',
      t: 'T-48H',
      title: 'Launch Window Lock',
      detail: win ? win.month : 'Awaiting selection',
      state: win ? 'done' : 'active',
    },
    {
      id: 'poll',
      t: 'T-24H',
      title: 'GO / NO-GO Poll',
      detail: pollDone
        ? pollGo
          ? 'All stations GO'
          : 'Hold for resolution'
        : 'Flight director',
      state: pollGo ? 'done' : win ? 'active' : 'pending',
    },
    {
      id: 'fuel',
      t: 'T-06H',
      title: 'Propellant Loading',
      detail: 'LOX / LH₂ chill-down',
      state: launching ? 'done' : pollGo ? 'active' : 'pending',
    },
    {
      id: 'launch',
      t: 'T-0',
      title: 'Launch',
      detail: 'Liftoff · max-Q',
      state: launching ? 'active' : 'pending',
    },
    {
      id: 'loi',
      t: 'T+4D',
      title: 'Lunar Orbit Insertion',
      detail: 'Near-rectilinear halo orbit',
      state: 'pending',
    },
    {
      id: 'pdi',
      t: 'T+5D',
      title: 'Powered Descent',
      detail: `Target ${site.code}`,
      state: 'pending',
    },
    {
      id: 'surface',
      t: 'T+5D',
      title: 'Surface Operations',
      detail: site.name,
      state: 'pending',
    },
  ]

  const tasks: Task[] = [
    { id: 'window', label: 'Lock launch window', kind: 'auto', done: Boolean(win) },
    { id: 'poll', label: 'Complete GO / NO-GO poll', kind: 'auto', done: pollDone },
    { id: 'scan', label: 'Orbital surface scan of landing zone', kind: 'auto', done: scannedOnce },
    { id: 'o2', label: 'Verify O₂ reserves above 85%', kind: 'auto', done: telemetry.oxygen >= 85 },
    {
      id: 'relay',
      label: hasRelay ? 'Calibrate relay antenna' : 'Relay antenna — not installed',
      kind: 'manual',
      done: hasRelay && manualTasks.includes('relay'),
      disabled: !hasRelay,
    },
    { id: 'eva', label: 'Brief EVA crew on thermal limits', kind: 'manual', done: manualTasks.includes('eva') },
    { id: 'suits', label: 'Pressure-check EVA suits', kind: 'manual', done: manualTasks.includes('suits') },
  ]

  const tasksDone = tasks.filter((t) => t.done).length

  const selectedMarker = markerPosition(site)
  const beamX = 162 + selectedMarker.x * 2.76
  const beamY = 162 + selectedMarker.y * 2.76

  /* power chart geometry */
  const chart = useMemo(() => {
    const w = 600
    const h = 150
    const padX = 22
    const top = 18
    const bottom = 30
    const pts = scores.map((s, i) => ({
      x: padX + (i * (w - padX * 2)) / 11,
      y: top + (1 - s.energy / 100) * (h - top - bottom),
    }))
    const line = pts
      .map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ')
    const area = `${line} L ${pts[11].x} ${h - bottom} L ${pts[0].x} ${h - bottom} Z`
    return { w, h, pts, line, area, base: h - bottom }
  }, [scores])

  const selectedIndex = win
    ? launchWindows.findIndex((w) => w.id === win.id)
    : -1

  const waveMode: WaveMode = speaking
    ? 'speaking'
    : isListening
      ? 'listening'
      : 'idle'

  /* ---------------- SPEECH OUTPUT ---------------- */

  const speak = useCallback((text: string) => {
    if (!voiceOnRef.current) return
    if (
      typeof window === 'undefined' ||
      !('speechSynthesis' in window)
    ) {
      return
    }

    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.96
    utterance.pitch = 0.9
    utterance.volume = 0.85
    utterance.lang = 'en-US'

    const voices = window.speechSynthesis.getVoices()
    const preferred =
      voices.find((v) => /Google US English/i.test(v.name)) ||
      voices.find((v) => /Microsoft (Aria|Jenny|Guy|David)/i.test(v.name)) ||
      voices.find((v) => v.lang.toLowerCase().startsWith('en-us')) ||
      voices.find((v) => v.lang.toLowerCase().startsWith('en'))

    if (preferred) utterance.voice = preferred

    utterance.onstart = () => setSpeaking(true)
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)

    window.speechSynthesis.speak(utterance)
  }, [])

  /* ---------------- AI RESPONSE + HISTORY ---------------- */

  const respond = useCallback(
    (text: string, command: string, source: CommandSource) => {
      const id = idRef.current++
      const seconds = Math.floor(
        (Date.now() - startRef.current) / 1000
      )

      setAiMessage({ id, text })
      setHistory((prev) =>
        [
          {
            id,
            time: formatElapsed(seconds),
            source,
            command,
            response: text,
          },
          ...prev,
        ].slice(0, 12)
      )
      speak(text)
    },
    [speak]
  )

  /* ---------------- ACTIONS ---------------- */

  const selectWindow = (
    w: LaunchWindow,
    source: CommandSource,
    command?: string
  ) => {
    onSelectWindow(w.id)
    setPollStep(-1)

    const t = computeTelemetry(site, selectedEquipment, w)
    const score = windowScore(site, selectedEquipment, w)

    setVoiceStatus(`${w.short} WINDOW LOCKED`)
    respond(
      `${w.month} window locked. Power margin ${t.energy} percent, Earth link ${t.comms} percent, radiation ${t.radiation.toFixed(2)} millisieverts per day. Window score ${score}. ${w.note}`,
      command ?? `Select ${w.month}`,
      source
    )
  }

  const startPoll = (source: CommandSource, command = 'Run GO / NO-GO poll') => {
    if (pollRunning) return
    setPollStep(0)
    setVoiceStatus('GO / NO-GO POLL IN PROGRESS')
    respond(
      'Flight director, commencing GO NO-GO poll. All stations, report status.',
      command,
      source
    )
  }

  const startScan = (source: CommandSource, command = 'Scan surface') => {
    setScanning(true)
    setScannedOnce(true)
    window.setTimeout(() => setScanning(false), 4200)
    respond(
      `EVA-1 scanning ${site.name}. Ice potential ${site.ice.toLowerCase()}, terrain ${site.terrain.toLowerCase()}, surface temperature ${telemetry.surfaceTemp} degrees Celsius.`,
      command,
      source
    )
  }

  const toggleTask = (task: Task) => {
    if (task.kind !== 'manual' || task.disabled) return
    setManualTasks((prev) =>
      prev.includes(task.id)
        ? prev.filter((x) => x !== task.id)
        : [...prev, task.id]
    )
  }

  const handleLaunch = (source: CommandSource, command = 'Proceed to mission') => {
    if (!win) {
      respond(
        `Negative, Commander. Lock a launch window first. I recommend ${bestWindow.month}.`,
        command,
        source
      )
      return
    }

    setLaunching(true)
    setVoiceStatus('LAUNCH SEQUENCE STARTED')
    respond(
      pollGo
        ? `All stations go. ${win.month} launch sequence initiated. Godspeed, Moonix.`
        : `Proceeding without a clean poll. ${win.month} launch sequence initiated. Flight is watching closely.`,
      command,
      source
    )
    window.setTimeout(() => onContinue(), 1600)
  }

  /* ---------------- VOICE CONTROL ---------------- */

  const stopVoice = () => {
    voiceOnRef.current = false
    shouldRestartRef.current = false
    setVoiceOn(false)
    setIsListening(false)
    setSpeaking(false)
    setVoiceStatus('VOICE LINK MUTED')

    try {
      recognitionRef.current?.stop()
    } catch {
      /* ignore */
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
  }

  const startVoice = () => {
    voiceOnRef.current = true
    shouldRestartRef.current = true
    setVoiceOn(true)
    setVoiceStatus('VOICE LINK ACTIVE')

    try {
      recognitionRef.current?.start()
      if (recognitionRef.current) {
        setIsListening(true)
        setVoiceStatus('LISTENING FOR COMMAND')
      }
    } catch {
      /* already listening */
    }

    speak('Mission control voice link online.')
  }

  const processCommand = (raw: string, source: CommandSource) => {
    const text = raw.toLowerCase().trim()
    if (!text) return

    setTranscript(raw)

    if (/\b(mute|voice off|disable voice)\b/.test(text)) {
      stopVoice()
      return
    }

    if (/\b(help|commands|what can i say)\b/.test(text)) {
      respond(
        'You can say: status, a month name, recommend window, run poll, oxygen, fuel, power, comms, radiation, temperature, crew, alerts, timeline, scan surface, back, or launch.',
        raw,
        source
      )
      return
    }

    const month = launchWindows.find(
      (w) =>
        hasWord(text, w.month.toLowerCase()) ||
        hasWord(text, w.short.toLowerCase())
    )

    if (month) {
      selectWindow(month, source, raw)
      return
    }

    if (/\b(recommend|best|optimal|suggest)\b/.test(text)) {
      if (/\b(lock|select|use|take)\b/.test(text)) {
        selectWindow(bestWindow, source, raw)
        return
      }
      const best = scores.find((s) => s.id === bestWindow.id)
      respond(
        `For ${site.name} with this payload, the optimal window is ${bestWindow.month}, score ${best?.score ?? 0}. Say "lock ${bestWindow.month.toLowerCase()}" to confirm.`,
        raw,
        source
      )
      return
    }

    if (/\b(poll|no.?go)\b/.test(text)) {
      startPoll(source, raw)
      return
    }

    if (/\b(scan|survey)\b/.test(text)) {
      startScan(source, raw)
      return
    }

    if (/\b(oxygen|o2|life support)\b/.test(text)) {
      respond(
        `Oxygen reserve at ${telemetry.oxygen} percent. ${selectedEquipment.includes('water') ? 'Ice extraction will top up reserves on the surface.' : 'No ice extraction aboard, so reserves are fixed.'}`,
        raw,
        source
      )
      return
    }

    if (/\b(fuel|propellant)\b/.test(text)) {
      respond(`Propellant at ${telemetry.fuel} percent, within descent margins.`, raw, source)
      return
    }

    if (/\b(power|energy|battery|solar)\b/.test(text)) {
      respond(
        `Power margin ${telemetry.energy} percent at ${win ? win.month : 'the default window'}. Site sunlight ${site.sunlight} percent.`,
        raw,
        source
      )
      return
    }

    if (/\b(comms|communication|signal|link)\b/.test(text)) {
      respond(
        `Earth link at ${telemetry.comms} percent${hasRelay ? ', relay antenna aboard' : ', no relay installed'}. Deep Space Network pass through Canberra.`,
        raw,
        source
      )
      return
    }

    if (/\b(radiation|solar storm|space weather)\b/.test(text)) {
      respond(
        `Radiation forecast ${telemetry.radiation.toFixed(2)} millisieverts per day. ${selectedEquipment.includes('shelter') ? 'Storm shelter available.' : 'No storm shelter aboard.'}`,
        raw,
        source
      )
      return
    }

    if (/\b(temperature|thermal|cold)\b/.test(text)) {
      respond(
        `Surface ${telemetry.surfaceTemp} degrees Celsius. Habitat holding ${telemetry.habitatTemp} degrees.`,
        raw,
        source
      )
      return
    }

    if (/\b(crew|health|astronaut)\b/.test(text)) {
      respond(`Crew of four, health index ${telemetry.crew} percent. All vitals within limits.`, raw, source)
      return
    }

    if (/\b(alert|alerts|warning|warnings)\b/.test(text)) {
      const serious = alerts.filter((a) => a.level !== 'info')
      respond(
        serious.length
          ? `${serious.length} active alerts. ${serious.map((a) => a.title.toLowerCase()).join('. ')}.`
          : 'No active alerts. All systems nominal.',
        raw,
        source
      )
      return
    }

    if (/\b(timeline|schedule|countdown)\b/.test(text)) {
      const active = phases.find((p) => p.state === 'active')
      respond(
        `Countdown ${formatCountdown(COUNTDOWN_START - elapsed).replace('T-', 'T minus ')}. Current phase: ${active?.title ?? 'standing by'}.`,
        raw,
        source
      )
      return
    }

    if (/\b(task|tasks|checklist)\b/.test(text)) {
      respond(`${tasksDone} of ${tasks.length} checklist items complete.`, raw, source)
      return
    }

    if (/\b(status|report|sitrep|summary)\b/.test(text)) {
      respond(
        `Status: ${missionStatus.toLowerCase()}. Readiness ${readiness} percent. Oxygen ${telemetry.oxygen}, power ${telemetry.energy}, comms ${telemetry.comms}. ${criticalCount ? `${criticalCount} critical alerts.` : 'No critical alerts.'}`,
        raw,
        source
      )
      return
    }

    if (text === 'back' || /\b(go back|equipment)\b/.test(text)) {
      respond('Returning to payload configuration.', raw, source)
      window.setTimeout(() => onBack(), 700)
      return
    }

    if (/\b(launch|continue|proceed|confirm|next|begin mission)\b/.test(text)) {
      handleLaunch(source, raw)
      return
    }

    respond('Command not recognized. Say help for the command list.', raw, source)
  }

  /* keep the latest handler for long-lived listeners */
  useEffect(() => {
    commandRef.current = processCommand
  })

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = draft.trim()
    if (!value) return
    processCommand(value, 'TEXT')
    setDraft('')
  }

  /* ---------------- PARALLAX ---------------- */

  const handleParallax = (event: ReactMouseEvent<HTMLElement>) => {
    const x = event.clientX / window.innerWidth - 0.5
    const y = event.clientY / window.innerHeight - 0.5

    window.cancelAnimationFrame(frameRef.current)
    frameRef.current = window.requestAnimationFrame(() => {
      const el = pageRef.current
      if (!el) return
      el.style.setProperty('--px', x.toFixed(3))
      el.style.setProperty('--py', y.toFixed(3))
    })
  }

  /* ---------------- EFFECTS ---------------- */

  useEffect(() => {
    const timer = window.setTimeout(() => setBooting(false), 1900)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    startRef.current = Date.now()

    const clock = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
    }, 1000)

    const jitter = window.setInterval(() => {
      setTick((t) => t + 1)
    }, 1600)

    return () => {
      window.clearInterval(clock)
      window.clearInterval(jitter)
      window.cancelAnimationFrame(frameRef.current)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      speak(
        `Mission control online. Target ${site.name}. Select a launch window, or say recommend window.`
      )
    }, 2100)

    return () => window.clearTimeout(timer)
  }, [speak, site.name])

  /* GO / NO-GO poll sequencer */
  useEffect(() => {
    if (pollStep < 0 || pollStep >= pollResults.length) return

    const timer = window.setTimeout(
      () => {
        const station = pollResults[pollStep]
        speak(`${station.name}, ${station.go ? 'go' : 'no go'}.`)

        const next = pollStep + 1
        setPollStep(next)

        if (next >= pollResults.length) {
          const nogo = pollResults.filter((r) => !r.go)
          window.setTimeout(() => {
            respond(
              nogo.length
                ? `Poll complete. ${nogo.length} station${nogo.length > 1 ? 's' : ''} no-go: ${nogo.map((r) => r.name).join(', ')}. Resolve before launch.`
                : 'Poll complete. All stations go. Flight, we are GO for launch.',
              'GO / NO-GO poll result',
              'SYSTEM'
            )
            setVoiceStatus(nogo.length ? 'POLL: HOLD' : 'POLL: GO FOR LAUNCH')
          }, 1100)
        }
      },
      pollStep === 0 ? 1600 : 1300
    )

    return () => window.clearTimeout(timer)
  }, [pollStep, pollResults, speak, respond])

  /* speech recognition */
  useEffect(() => {
    mountedRef.current = true

    const SpeechRecognitionAPI = getSpeechRecognitionAPI()

    /* status was already set to NOT SUPPORTED at init */
    if (!SpeechRecognitionAPI) {
      return () => {
        mountedRef.current = false
      }
    }

    const recognition = new SpeechRecognitionAPI()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onresult = (event) => {
      const latest = event.results[event.results.length - 1]
      const spoken = latest?.[0]?.transcript || ''
      commandRef.current(spoken, 'VOICE')
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

      try {
        recognition.start()
        setIsListening(true)
      } catch {
        /* browser rejected restart */
      }
    }

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') {
        setVoiceStatus('MICROPHONE PERMISSION DENIED')
        setIsListening(false)
        shouldRestartRef.current = false
        return
      }

      if (event.error === 'no-speech') {
        setVoiceStatus('LISTENING FOR COMMAND')
        return
      }

      setVoiceStatus('VOICE LINK RECOVERING')
    }

    recognitionRef.current = recognition
    shouldRestartRef.current = true

    const startTimer = window.setTimeout(() => {
      if (!mountedRef.current) return

      try {
        recognition.start()
        setIsListening(true)
        setVoiceStatus('LISTENING FOR COMMAND')
      } catch {
        setVoiceStatus('VOICE LINK READY')
      }
    }, 1400)

    return () => {
      mountedRef.current = false
      shouldRestartRef.current = false
      window.clearTimeout(startTimer)

      try {
        recognition.stop()
      } catch {
        /* ignore */
      }

      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  /* =========================================================
     RENDER
     ========================================================= */

  return (
    <main
      ref={pageRef}
      className={`mc-page ${launching ? 'is-launching' : ''}`}
      onMouseMove={handleParallax}
    >
      {/* ===================== BACKGROUND ===================== */}

      <div className="mc-space" aria-hidden="true">
        <div className="mc-layer mc-layer-far">
          <div className="mc-stars mc-stars-a" />
          <div className="mc-galaxy" />
        </div>

        <div className="mc-layer mc-layer-mid">
          <div className="mc-stars mc-stars-b" />
          <div className="mc-nebula mc-nebula-a" />
          <div className="mc-nebula mc-nebula-b" />
          <div className="mc-nebula mc-nebula-c" />
        </div>

        <div className="mc-layer mc-layer-near">
          <div className="mc-stars mc-stars-c" />
          <div className="mc-particles">
            {PARTICLES.map((p) => (
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

        <span className="mc-comet" />
        <div className="mc-horizon" />
        <div className="mc-grid-floor" />
        <div className="mc-scanline" />
        <div className="mc-vignette" />
      </div>

      {/* ===================== BOOT ===================== */}

      {booting && (
        <div className="mc-boot" aria-hidden="true">
          <div className="mc-boot-core">
            <div className="mc-boot-emblem">
              <i />
              <i />
              <i />
              <span>◐</span>
            </div>

            <strong className="mc-boot-title">
              MISSION CONTROL
            </strong>

            <div className="mc-boot-lines">
              <p>&gt; ESTABLISHING DSN UPLINK.............. OK</p>
              <p>&gt; SYNCING ORBITAL EPHEMERIS............ OK</p>
              <p>&gt; LOADING {site.code} SURFACE MODEL.......... OK</p>
              <p>&gt; CREW BIOMETRICS / SUIT TELEMETRY..... OK</p>
              <p>&gt; FLIGHT DIRECTOR CONSOLE.............. ONLINE</p>
            </div>

            <div className="mc-boot-bar">
              <i />
            </div>
          </div>
        </div>
      )}

      {/* ===================== LAUNCH FLASH ===================== */}

      {launching && (
        <div className="mc-launch-overlay" aria-hidden="true">
          <div className="mc-launch-rings">
            <i />
            <i />
            <i />
          </div>
          <strong>LAUNCH SEQUENCE INITIATED</strong>
          <span>{win?.month} WINDOW · {site.code}</span>
        </div>
      )}

      {/* ===================== NAV ===================== */}

      <header className="mc-nav">
        <button
          className="mc-brand"
          type="button"
          onClick={onBack}
          aria-label="Return to equipment"
        >
          <span className="mc-brand-mark">M</span>
          <span className="mc-brand-copy">
            <strong>MOONIX</strong>
            <small>LUNAR MISSION CONTROL</small>
          </span>
        </button>

        <div className="mc-path">
          <span>MISSION</span>
          <i>/</i>
          <span>{site.code}</span>
          <i>/</i>
          <strong>CONTROL</strong>
        </div>

        <div className="mc-nav-right">
          <div className="mc-countdown">
            <small>COUNTDOWN</small>
            <strong>
              {formatCountdown(COUNTDOWN_START - elapsed)}
            </strong>
          </div>

          <div className={`mc-status ${isListening ? 'is-listening' : ''}`}>
            <span className="mc-status-dot" />
            <span>{voiceStatus}</span>
          </div>
        </div>
      </header>

      {/* ===================== STEPPER ===================== */}

      <div className="mc-stepper">
        {MISSION_STEPS.map((step, index) => (
          <div
            key={step}
            className={`mc-step ${index < 2 ? 'is-done' : ''} ${
              index === 2 ? 'is-active' : ''
            }`}
          >
            <span className="mc-step-num">
              {index < 2 ? '✓' : pad(index + 1)}
            </span>
            <strong>{step}</strong>
            {index < MISSION_STEPS.length - 1 && (
              <span className="mc-step-line">
                <i />
              </span>
            )}
          </div>
        ))}
      </div>

      <section className="mc-shell">
        {/* ===================== HEADING ===================== */}

        <div className="mc-heading">
          <div className="mc-heading-copy">
            <div className="mc-eyebrow">
              <span className="mc-eyebrow-line" />
              <span>PHASE 04 / FLIGHT OPERATIONS</span>
            </div>

            <h1 className="mc-title">
              MISSION
              <span data-text="CONTROL">CONTROL</span>
            </h1>

            <p>
              Lock your launch window, poll every flight
              controller, and bring the crew home safe. All
              systems report live to <b>Flight</b>.
            </p>
          </div>

          <div className={`mc-status-card ${statusTone}`}>
            <div className="mc-status-radar">
              <i />
              <span />
            </div>

            <div>
              <small>MISSION STATUS</small>
              <strong>{missionStatus}</strong>
              <span>
                READINESS {readiness}% · {tasksDone}/{tasks.length} TASKS
              </span>
            </div>
          </div>
        </div>

        {/* ===================== MAIN GRID ===================== */}

        <div className="mc-grid">
          {/* =================== LEFT: TELEMETRY =================== */}

          <aside className="mc-col mc-col-left">
            {/* site */}
            <div className="mc-panel mc-site">
              <div className="mc-panel-head">
                <span>01</span>
                <div>
                  <small>LANDING SITE</small>
                  <h2>{site.name}</h2>
                </div>
                <em className={`mc-risk mc-risk-${site.risk.toLowerCase()}`}>
                  {site.risk}
                </em>
              </div>

              <div className="mc-coords">
                <div>
                  <small>LAT</small>
                  <strong>{site.latitude}</strong>
                </div>
                <div>
                  <small>LON</small>
                  <strong>{site.longitude}</strong>
                </div>
                <div>
                  <small>REGION</small>
                  <strong>{site.region}</strong>
                </div>
                <div>
                  <small>SITE INDEX</small>
                  <strong>{site.score}</strong>
                </div>
              </div>

              <div className="mc-payload">
                <small>PAYLOAD MANIFEST</small>
                <div>
                  {installed.length ? (
                    installed.map((item) => (
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
              </div>
            </div>

            {/* gauges */}
            <div className="mc-panel">
              <div className="mc-panel-head">
                <span>02</span>
                <div>
                  <small>LIFE SUPPORT & SYSTEMS</small>
                  <h2>Vehicle Telemetry</h2>
                </div>
                <span className="mc-live">
                  <i />
                  LIVE
                </span>
              </div>

              <div className="mc-rings">
                <RingGauge
                  label="OXYGEN"
                  value={live.oxygen}
                  display={live.oxygen.toFixed(1)}
                  unit="%"
                  color="#72e8ff"
                  caption="O₂ RESERVE"
                />
                <RingGauge
                  label="FUEL"
                  value={live.fuel}
                  display={live.fuel.toFixed(1)}
                  unit="%"
                  color="#e5bd72"
                  caption="LOX / LH₂"
                />
                <RingGauge
                  label="ENERGY"
                  value={live.energy}
                  display={Math.round(live.energy).toString()}
                  unit="%"
                  color="#73e2a5"
                  caption="POWER MARGIN"
                />
                <RingGauge
                  label="SIGNAL"
                  value={live.comms}
                  display={Math.round(live.comms).toString()}
                  unit="%"
                  color="#b99cff"
                  caption="EARTH LINK"
                />
              </div>

              <div className="mc-signal-bars" aria-hidden="true">
                {Array.from({ length: 12 }).map((_, i) => (
                  <i
                    key={i}
                    className={i < Math.round(live.comms / 8.4) ? 'is-on' : ''}
                    style={{ height: `${30 + i * 6}%` }}
                  />
                ))}
                <span>DSN · CANBERRA 70M</span>
              </div>
            </div>

            {/* environment */}
            <div className="mc-panel">
              <div className="mc-panel-head">
                <span>03</span>
                <div>
                  <small>ENVIRONMENT</small>
                  <h2>Thermal & Radiation</h2>
                </div>
              </div>

              <div className="mc-env">
                <div className="mc-env-row">
                  <div className="mc-env-top">
                    <span>SURFACE TEMP</span>
                    <strong>{live.surfaceTemp.toFixed(1)}°C</strong>
                  </div>
                  <div className="mc-thermo is-cold">
                    <i
                      style={{
                        width: `${Math.max(4, Math.min(100, ((live.surfaceTemp + 240) / 260) * 100))}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="mc-env-row">
                  <div className="mc-env-top">
                    <span>HABITAT TEMP</span>
                    <strong>{live.habitatTemp.toFixed(1)}°C</strong>
                  </div>
                  <div className="mc-thermo is-warm">
                    <i
                      style={{
                        width: `${Math.max(4, Math.min(100, (live.habitatTemp / 30) * 100))}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="mc-env-row">
                  <div className="mc-env-top">
                    <span>RADIATION</span>
                    <strong
                      className={
                        live.radiation >= 1
                          ? 'is-bad'
                          : live.radiation >= 0.8
                            ? 'is-mid'
                            : 'is-good'
                      }
                    >
                      {live.radiation.toFixed(2)} mSv/d
                    </strong>
                  </div>
                  <div className="mc-rad-scale">
                    <span className="mc-rad-fill" />
                    <b
                      style={{
                        left: `${Math.min(100, (live.radiation / 1.6) * 100)}%`,
                      }}
                    />
                  </div>
                  <div className="mc-rad-legend">
                    <span>NOMINAL</span>
                    <span>ELEVATED</span>
                    <span>STORM</span>
                  </div>
                </div>
              </div>
            </div>

            {/* crew */}
            <div className="mc-panel">
              <div className="mc-panel-head">
                <span>04</span>
                <div>
                  <small>CREW STATUS</small>
                  <h2>Biometrics</h2>
                </div>
                <strong className="mc-crew-index">{telemetry.crew}%</strong>
              </div>

              <ul className="mc-crew">
                {CREW.map((member, i) => {
                  const bpm = Math.round(
                    member.bpm + noise(tick, 10 + i, 2.5) + (telemetry.radiation > 1 ? 6 : 0)
                  )

                  return (
                    <li key={member.id} style={{ '--i': i } as CSSVars}>
                      <span className="mc-crew-avatar">
                        {member.name.split(' ').pop()?.charAt(0)}
                        <i />
                      </span>

                      <div className="mc-crew-info">
                        <strong>{member.name}</strong>
                        <small>{member.role}</small>
                      </div>

                      <svg className="mc-ecg" viewBox="0 0 120 30" aria-hidden="true">
                        <path d="M0 15 H18 L22 10 L26 20 L30 3 L35 26 L39 15 H60 L64 10 L68 20 L72 3 L77 26 L81 15 H120" />
                      </svg>

                      <b>{bpm}</b>
                    </li>
                  )
                })}
              </ul>
            </div>
          </aside>

          {/* =================== CENTER: ORBITAL THEATER =================== */}

          <div className="mc-col mc-col-center">
            <div className={`mc-theater ${scanning ? 'is-scanning' : ''}`}>
              <div className="mc-theater-hud">
                <span>ORBITAL TRACKING // SOUTH POLE VIEW</span>
                <span>
                  <i />
                  {ORBITS.length} ASSETS · LIVE
                </span>
              </div>

              <span className="mc-hud-corner mc-hud-tl" />
              <span className="mc-hud-corner mc-hud-tr" />
              <span className="mc-hud-corner mc-hud-bl" />
              <span className="mc-hud-corner mc-hud-br" />

              <div className="mc-stage">
                {/* back orbits (behind moon) */}
                <svg className="mc-orbits mc-orbits-back" viewBox="0 0 600 600" aria-hidden="true">
                  {ORBITS.map((o) => (
                    <g key={o.id} transform={`rotate(${o.tilt} 300 300)`}>
                      <path
                        d={ellipsePath(o.rx, o.ry)}
                        className="mc-orbit-path"
                        style={{ stroke: o.color }}
                      />
                      <g className="mc-craft" style={{ color: o.color }}>
                        <circle r="9" className="mc-craft-glow" />
                        <rect x="-3" y="-3" width="6" height="6" />
                        <animateMotion dur={`${o.dur}s`} repeatCount="indefinite" path={ellipsePath(o.rx, o.ry)} />
                        <animate attributeName="opacity" dur={`${o.dur}s`} repeatCount="indefinite" calcMode="discrete" values="0;0.55" keyTimes="0;0.5" />
                      </g>
                    </g>
                  ))}
                </svg>

                {/* moon */}
                <div className="mc-moon-wrap">
                  <div className="mc-moon-glow" />
                  <div className="mc-moon">
                    <div className="mc-moon-surface" />
                    <div className="mc-moon-craters" />
                    <div className="mc-moon-shade" />
                    <div className="mc-moon-grid" />
                    <div className="mc-moon-scan" />

                    {lunarSites.map((s) => {
                      const p = markerPosition(s)
                      const active = s.id === site.id

                      return (
                        <span
                          key={s.id}
                          className={`mc-marker ${active ? 'is-active' : ''}`}
                          style={{ left: `${p.x}%`, top: `${p.y}%` }}
                          title={s.name}
                        >
                          <i />
                          {active && <em>{s.code}</em>}
                        </span>
                      )
                    })}
                  </div>
                  <div className="mc-moon-rim" />
                </div>

                {/* front orbits (in front of moon) */}
                <svg className="mc-orbits mc-orbits-front" viewBox="0 0 600 600" aria-hidden="true">
                  <line
                    className="mc-beam"
                    x1="531"
                    y1="69"
                    x2={beamX}
                    y2={beamY}
                    style={{ opacity: 0.25 + telemetry.comms / 160 }}
                  />

                  {ORBITS.map((o) => (
                    <g key={o.id} transform={`rotate(${o.tilt} 300 300)`}>
                      <path
                        d={ellipsePath(o.rx, o.ry, true)}
                        className="mc-orbit-path mc-orbit-front"
                        style={{ stroke: o.color }}
                      />
                      <g className="mc-craft" style={{ color: o.color }}>
                        <circle r="11" className="mc-craft-glow" />
                        <rect x="-12" y="-2" width="7" height="4" className="mc-craft-panel" />
                        <rect x="5" y="-2" width="7" height="4" className="mc-craft-panel" />
                        <rect x="-3.5" y="-3.5" width="7" height="7" />
                        <g transform={`rotate(${-o.tilt})`}>
                          <text x="12" y="-10" className="mc-craft-label">
                            {o.label}
                          </text>
                        </g>
                        <animateMotion dur={`${o.dur}s`} repeatCount="indefinite" path={ellipsePath(o.rx, o.ry)} />
                        <animate attributeName="opacity" dur={`${o.dur}s`} repeatCount="indefinite" calcMode="discrete" values="1;0" keyTimes="0;0.5" />
                      </g>
                    </g>
                  ))}
                </svg>

                {/* earth */}
                <div className="mc-earth">
                  <div className="mc-earth-land" />
                  <div className="mc-earth-cloud" />
                  <div className="mc-earth-night" />
                  <span className="mc-earth-label">EARTH · 384,400 KM</span>
                </div>

                {/* astronaut */}
                <div className={`mc-astro ${scanning ? 'is-scanning' : ''}`}>
                  <span className="mc-astro-tether" />
                  <div className="mc-astro-figure">
                    <span className="mc-astro-jet" />
                    <span className="mc-astro-pack">
                      <i />
                    </span>
                    <span className="mc-astro-leg mc-astro-leg-l" />
                    <span className="mc-astro-leg mc-astro-leg-r" />
                    <span className="mc-astro-arm mc-astro-arm-l" />
                    <span className="mc-astro-torso">
                      <i />
                      <b>M</b>
                    </span>
                    <span className="mc-astro-arm mc-astro-arm-r">
                      <span className="mc-astro-beam" />
                    </span>
                    <span className="mc-astro-helmet">
                      <span className="mc-astro-visor">
                        <i />
                      </span>
                      <span className="mc-astro-lamp" />
                    </span>
                  </div>
                  <span className="mc-astro-tag">
                    <i />
                    EVA-1 · {scanning ? 'SCANNING' : 'NOMINAL'}
                  </span>
                </div>
              </div>

              <div className="mc-theater-foot">
                <div>
                  <small>TARGET</small>
                  <strong>{site.code} · {site.name}</strong>
                </div>
                <div>
                  <small>SUNLIGHT</small>
                  <strong>{site.sunlight}%</strong>
                </div>
                <div>
                  <small>ICE</small>
                  <strong>{site.ice}</strong>
                </div>
                <button
                  type="button"
                  className="mc-scan-btn"
                  onClick={() => startScan('TEXT')}
                  disabled={scanning}
                >
                  <span />
                  {scanning ? 'SCANNING…' : 'SCAN SURFACE'}
                </button>
              </div>
            </div>

            {/* launch windows */}
            <div className="mc-panel mc-windows">
              <div className="mc-panel-head">
                <span>05</span>
                <div>
                  <small>TRAJECTORY PLANNING</small>
                  <h2>Launch Window</h2>
                </div>

                <button
                  type="button"
                  className="mc-best-btn"
                  onClick={() => selectWindow(bestWindow, 'TEXT', `Lock ${bestWindow.month}`)}
                >
                  ★ OPTIMAL: {bestWindow.short}
                </button>
              </div>

              <div className="mc-window-grid">
                {launchWindows.map((w, i) => {
                  const score = scores[i].score
                  const selected = w.id === selectedWindow
                  const best = w.id === bestWindow.id

                  return (
                    <button
                      key={w.id}
                      type="button"
                      className={`mc-window ${selected ? 'is-selected' : ''} ${best ? 'is-best' : ''}`}
                      style={{ '--i': i } as CSSVars}
                      onClick={() => selectWindow(w, 'TEXT')}
                      aria-pressed={selected}
                    >
                      {best && <em>★</em>}
                      <strong>{w.short}</strong>
                      <span className="mc-window-sun">
                        <i style={{ height: `${w.sun}%` }} />
                      </span>
                      <small>☀ {w.sun}%</small>
                      <small>⌁ {w.earth}%</small>
                      <b>{score}</b>
                    </button>
                  )
                })}
              </div>

              <div className="mc-chart">
                <div className="mc-chart-head">
                  <small>PROJECTED POWER MARGIN BY LAUNCH MONTH</small>
                  <span>
                    {win ? `${win.month}: ${scores[selectedIndex].energy}%` : 'NO WINDOW LOCKED'}
                  </span>
                </div>

                <svg viewBox={`0 0 ${chart.w} ${chart.h}`} preserveAspectRatio="none" aria-hidden="true">
                  <defs>
                    <linearGradient id="mcArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#72e8ff" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#72e8ff" stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  {[0.25, 0.5, 0.75].map((f) => (
                    <line
                      key={f}
                      className="mc-chart-grid"
                      x1="0"
                      x2={chart.w}
                      y1={18 + f * (chart.base - 18)}
                      y2={18 + f * (chart.base - 18)}
                    />
                  ))}

                  <path d={chart.area} fill="url(#mcArea)" className="mc-chart-area" />
                  <path d={chart.line} className="mc-chart-line" pathLength={1} />

                  {chart.pts.map((p, i) => (
                    <g key={launchWindows[i].id}>
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={i === selectedIndex ? 5 : 2.5}
                        className={i === selectedIndex ? 'mc-chart-dot is-selected' : 'mc-chart-dot'}
                      />
                      <text x={p.x} y={chart.h - 10} className="mc-chart-label">
                        {launchWindows[i].short}
                      </text>
                    </g>
                  ))}

                  {selectedIndex >= 0 && (
                    <line
                      className="mc-chart-cursor"
                      x1={chart.pts[selectedIndex].x}
                      x2={chart.pts[selectedIndex].x}
                      y1="10"
                      y2={chart.base}
                    />
                  )}
                </svg>
              </div>

              {win && (
                <p className="mc-window-note" key={win.id}>
                  <span>◆</span>
                  {win.note}
                </p>
              )}
            </div>
          </div>

          {/* =================== RIGHT: AI + COMMAND =================== */}

          <aside className="mc-col mc-col-right">
            <div className={`mc-panel mc-ai ${speaking ? 'is-speaking' : ''}`}>
              <div className="mc-panel-head">
                <span className="mc-ai-orb">
                  <i />
                  <i />
                </span>
                <div>
                  <small>AI FLIGHT ASSISTANT</small>
                  <h2>LUNA // CAPCOM</h2>
                </div>
                <span className={`mc-ai-state ${waveMode}`}>
                  {waveMode === 'speaking'
                    ? 'TRANSMITTING'
                    : waveMode === 'listening'
                      ? 'LISTENING'
                      : 'STANDBY'}
                </span>
              </div>

              <div className="mc-voice">
                <button
                  type="button"
                  className={`mc-mic ${isListening ? 'is-listening' : ''} ${voiceOn ? '' : 'is-off'}`}
                  onClick={voiceOn ? stopVoice : startVoice}
                  aria-label={voiceOn ? 'Turn voice commands off' : 'Turn voice commands on'}
                >
                  <i />
                  <i />
                  <i />
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="9" y="3" width="6" height="11" rx="3" />
                    <path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" />
                    {!voiceOn && <path d="M4 4l16 16" className="mc-mic-slash" />}
                  </svg>
                </button>

                <div className="mc-wave">
                  <WaveformCanvas mode={waveMode} />
                  <span className="mc-wave-label">
                    {transcript ? `“${transcript}”` : 'Say “status” or “recommend window”'}
                  </span>
                </div>
              </div>

              <div className="mc-ai-message" key={aiMessage.id}>
                <span className="mc-ai-tag">LUNA</span>
                <p>
                  <TypeLine text={aiMessage.text} />
                </p>
              </div>

              <form className="mc-input" onSubmit={handleSubmit}>
                <span>&gt;</span>
                <input
                  value={draft}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setDraft(e.target.value)
                  }
                  placeholder="Type a command…"
                  aria-label="Type a mission command"
                />
                <button type="submit">SEND</button>
              </form>

              <div className="mc-chips">
                {QUICK_COMMANDS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => processCommand(c, 'TEXT')}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* go / no-go */}
            <div className={`mc-panel mc-poll ${pollGo ? 'is-go' : ''}`}>
              <div className="mc-panel-head">
                <span>06</span>
                <div>
                  <small>FLIGHT DIRECTOR</small>
                  <h2>GO / NO-GO Poll</h2>
                </div>
                <button
                  type="button"
                  className="mc-poll-btn"
                  onClick={() => startPoll('TEXT')}
                  disabled={pollRunning}
                >
                  {pollRunning ? 'POLLING…' : pollDone ? 'RE-POLL' : 'RUN POLL'}
                </button>
              </div>

              <ul className="mc-stations">
                {pollResults.map((r, i) => {
                  const revealed = i < pollStep
                  const current = i === pollStep && pollRunning

                  return (
                    <li
                      key={r.id}
                      className={[
                        revealed ? (r.go ? 'is-go' : 'is-nogo') : '',
                        current ? 'is-current' : '',
                      ].join(' ')}
                    >
                      <span className="mc-station-light" />
                      <div>
                        <strong>{r.name}</strong>
                        <small>{r.role}</small>
                      </div>
                      <em>{revealed ? r.note : current ? 'polling…' : '—'}</em>
                      <b>{revealed ? (r.go ? 'GO' : 'NO-GO') : current ? '···' : 'STBY'}</b>
                    </li>
                  )
                })}
              </ul>
            </div>

            {/* alerts */}
            <div className="mc-panel">
              <div className="mc-panel-head">
                <span>07</span>
                <div>
                  <small>CAUTION & WARNING</small>
                  <h2>Alerts</h2>
                </div>
                {criticalCount > 0 && (
                  <span className="mc-alert-count">{criticalCount}</span>
                )}
              </div>

              <ul className="mc-alerts">
                {alerts.map((a, i) => (
                  <li
                    key={a.id}
                    className={`is-${a.level}`}
                    style={{ '--i': i } as CSSVars}
                  >
                    <span className="mc-alert-icon">
                      {a.level === 'critical' ? '!' : a.level === 'warning' ? '▲' : 'i'}
                    </span>
                    <div>
                      <strong>{a.title}</strong>
                      <small>{a.detail}</small>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* command history */}
            <div className="mc-panel mc-history">
              <div className="mc-panel-head">
                <span>08</span>
                <div>
                  <small>COMMAND LOG</small>
                  <h2>History</h2>
                </div>
                <span className="mc-history-count">{history.length}</span>
              </div>

              {history.length === 0 ? (
                <p className="mc-empty">
                  No commands yet. Speak or type to talk to Flight.
                </p>
              ) : (
                <ul>
                  {history.map((h) => (
                    <li key={h.id}>
                      <div className="mc-history-top">
                        <time>T+{h.time}</time>
                        <span className={`mc-source is-${h.source.toLowerCase()}`}>
                          {h.source}
                        </span>
                      </div>
                      <strong>{h.command}</strong>
                      <p>{h.response}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>

        {/* ===================== TIMELINE + TASKS ===================== */}

        <div className="mc-bottom">
          <div className="mc-panel mc-timeline">
            <div className="mc-panel-head">
              <span>09</span>
              <div>
                <small>MISSION TIMELINE</small>
                <h2>Flight Plan</h2>
              </div>
              <strong className="mc-timeline-clock">
                {formatCountdown(COUNTDOWN_START - elapsed)}
              </strong>
            </div>

            <ol className="mc-phases">
              {phases.map((p, i) => (
                <li
                  key={p.id}
                  className={`is-${p.state}`}
                  style={{ '--i': i } as CSSVars}
                >
                  <span className="mc-phase-node">
                    {p.state === 'done' ? '✓' : pad(i + 1)}
                  </span>
                  <small>{p.t}</small>
                  <strong>{p.title}</strong>
                  <em>{p.detail}</em>
                </li>
              ))}
            </ol>
          </div>

          <div className="mc-panel mc-tasks">
            <div className="mc-panel-head">
              <span>10</span>
              <div>
                <small>ACTIVE TASKS</small>
                <h2>Checklist</h2>
              </div>
              <strong className="mc-task-count">
                {tasksDone}/{tasks.length}
              </strong>
            </div>

            <div className="mc-task-progress">
              <i style={{ width: `${(tasksDone / tasks.length) * 100}%` }} />
            </div>

            <ul>
              {tasks.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className={[
                      'mc-task',
                      t.done ? 'is-done' : '',
                      t.kind === 'auto' ? 'is-auto' : '',
                      t.disabled ? 'is-disabled' : '',
                    ].join(' ')}
                    onClick={() => toggleTask(t)}
                    disabled={t.kind === 'auto' || t.disabled}
                  >
                    <span className="mc-task-box">{t.done ? '✓' : ''}</span>
                    <span className="mc-task-label">{t.label}</span>
                    <em>{t.kind === 'auto' ? 'AUTO' : 'CREW'}</em>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ===================== FOOTER ===================== */}

        <div className="mc-footer">
          <button type="button" className="mc-back" onClick={onBack}>
            <span>←</span>
            EQUIPMENT
          </button>

          <div className="mc-footer-msg">
            <span className="mc-footer-line" />
            <div>
              <small>HOUSTON // FLIGHT DIRECTOR</small>
              <p>
                {pollGo
                  ? '“All stations are GO. You have the ship, Commander.”'
                  : win
                    ? '“Window is locked. Poll the room when you are ready.”'
                    : '“Standing by for a launch window, Commander.”'}
              </p>
            </div>
          </div>

          <button
            type="button"
            className={`mc-launch ${win ? '' : 'is-disabled'} ${pollGo ? 'is-go' : ''}`}
            onClick={() => handleLaunch('TEXT')}
          >
            <span className="mc-launch-shine" />
            <span className="mc-launch-copy">
              <small>{pollGo ? 'ALL STATIONS GO' : 'PROCEED TO'}</small>
              <strong>LAUNCH MISSION</strong>
            </span>
            <b>🚀</b>
          </button>
        </div>

        <div className="mc-coordinates">
          <div>
            <span className="mc-cross">+</span>
            <span>{site.latitude} · {site.longitude}</span>
            <i />
            <span>FLIGHT OPERATIONS</span>
          </div>
          <div>
            <span>{criticalCount ? `${criticalCount} CRITICAL` : 'NO CRITICAL ALERTS'}</span>
            <span className={pollGo ? 'mc-go' : ''}>{missionStatus}</span>
          </div>
        </div>
      </section>
    </main>
  )
}
