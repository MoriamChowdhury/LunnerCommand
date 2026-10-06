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

import {
  EQUIPMENT_BUDGET,
  MASS_LIMIT,
  equipmentCategories,
  equipmentList,
  type EquipmentCategory,
  type EquipmentItem,
} from '../data/equipment'

import './Equipment.css'

/* =========================================================
   TYPES
   ========================================================= */

type EquipmentProps = {
  selectedSite: string
  selectedEquipment: string[]
  onChangeEquipment: (ids: string[]) => void
  onBack: () => void
  onContinue: () => void
  /* total budget in $M — base budget plus any earned bonus */
  budget?: number
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

/* Detect browser speech-recognition support once. Used as the
   initial state value so no effect has to call setState for it. */
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

type StatKey = 'power' | 'comms' | 'safety' | 'science'

type Readiness = Record<StatKey, number> & {
  overall: number
}

type LogTone = 'info' | 'good' | 'warn'

type LogEntry = {
  id: number
  time: string
  text: string
  tone: LogTone
}

type Filter = 'all' | EquipmentCategory

type CSSVars = CSSProperties &
  Record<`--${string}`, string | number>

/* =========================================================
   CONSTANTS + HELPERS
   ========================================================= */

const STAT_META: {
  key: StatKey
  label: string
  short: string
}[] = [
  { key: 'power', label: 'POWER RELIABILITY', short: 'PWR' },
  { key: 'comms', label: 'EARTH LINK', short: 'COM' },
  { key: 'safety', label: 'CREW SAFETY', short: 'SAF' },
  { key: 'science', label: 'SCIENCE RETURN', short: 'SCI' },
]

const RISK_BASE: Record<string, number> = {
  LOW: 62,
  MEDIUM: 48,
  HIGH: 34,
}

const ICE_BASE: Record<string, number> = {
  'VERY HIGH': 48,
  HIGH: 40,
  MEDIUM: 30,
  LOW: 20,
}

const MISSION_STEPS = [
  'SITE',
  'EQUIPMENT',
  'LAUNCH WINDOW',
  'MISSION',
  'RESULTS',
]

const clamp = (value: number) =>
  Math.max(0, Math.min(100, Math.round(value)))

const findItem = (id: string) =>
  equipmentList.find((item) => item.id === id)

const formatClock = (seconds: number) => {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0')
  const s = String(seconds % 60).padStart(2, '0')
  return `T+${m}:${s}`
}

const parseTemperature = (value: string) => {
  const n = parseInt(value.replace('−', '-'), 10)
  return Number.isNaN(n) ? -100 : n
}

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const matchesAlias = (text: string, alias: string) =>
  new RegExp(`\\b${escapeRegExp(alias)}\\b`).test(text)

function computeReadiness(
  site: LunarSite,
  items: EquipmentItem[]
): Readiness {
  let power = site.sunlight * 0.55
  let comms = site.communication * 0.6
  let safety = RISK_BASE[site.risk] ?? 45
  let science = ICE_BASE[site.ice] ?? 30

  for (const item of items) {
    const sunFactor = item.sunDependent
      ? site.sunlight / 100
      : 1

    power += item.stats.power * sunFactor
    comms += item.stats.comms
    safety += item.stats.safety
    science += item.stats.science
  }

  const result = {
    power: clamp(power),
    comms: clamp(comms),
    safety: clamp(safety),
    science: clamp(science),
  }

  return {
    ...result,
    overall: clamp(
      (result.power +
        result.comms +
        result.safety +
        result.science) /
        4
    ),
  }
}

function getRecommendations(site: LunarSite): string[] {
  const recs: string[] = []

  if (site.sunlight >= 70) recs.push('solar')
  if (site.sunlight < 80) recs.push('battery')
  if (site.communication < 90) recs.push('comms')
  if (parseTemperature(site.temperature) <= -100) recs.push('thermal')
  if (site.ice === 'VERY HIGH' || site.ice === 'HIGH') recs.push('water')
  if (site.risk !== 'LOW') recs.push('shelter')

  return recs
}

function getSiteNote(
  item: EquipmentItem,
  site: LunarSite
): { text: string; tone: 'good' | 'warn' } | null {
  if (item.sunDependent) {
    return {
      text: `OUTPUT ×${site.sunlight}% AT ${site.code}`,
      tone: site.sunlight >= 75 ? 'good' : 'warn',
    }
  }

  if (item.id === 'battery' && site.sunlight < 80) {
    return { text: 'HIGH VALUE — LIMITED SUNLIGHT', tone: 'good' }
  }

  if (item.id === 'comms' && site.communication < 90) {
    return { text: 'BOOSTS A WEAK EARTH LINK', tone: 'good' }
  }

  if (
    item.id === 'thermal' &&
    parseTemperature(site.temperature) <= -100
  ) {
    return {
      text: `CRITICAL AT ${site.temperature}`,
      tone: 'good',
    }
  }

  if (
    item.id === 'water' &&
    (site.ice === 'VERY HIGH' || site.ice === 'HIGH')
  ) {
    return { text: `ICE POTENTIAL: ${site.ice}`, tone: 'good' }
  }

  if (item.id === 'shelter' && site.risk !== 'LOW') {
    return { text: `${site.risk} RISK SITE`, tone: 'good' }
  }

  if (item.stats.power < 0) {
    return { text: 'DRAWS BASE POWER', tone: 'warn' }
  }

  return null
}

function getWarnings(
  site: LunarSite,
  ids: string[],
  readiness: Readiness
): string[] {
  const warnings: string[] = []
  const hasSolar = ids.includes('solar')
  const hasBattery = ids.includes('battery')

  if (!hasSolar && !hasBattery) {
    warnings.push('NO PRIMARY POWER SOURCE INSTALLED')
  }

  if (site.sunlight < 70 && !hasBattery) {
    warnings.push('LOW-LIGHT SITE WITHOUT ENERGY STORAGE')
  }

  if (
    (ids.includes('lab') || ids.includes('rover')) &&
    readiness.power < 50
  ) {
    warnings.push('SCIENCE LOAD EXCEEDS SAFE POWER MARGIN')
  }

  if (readiness.comms < 60) {
    warnings.push('EARTH LINK BELOW MISSION THRESHOLD')
  }

  if (readiness.safety < 55) {
    warnings.push('CREW SAFETY MARGIN IS THIN')
  }

  return warnings
}

function autoConfigure(site: LunarSite, budget: number): string[] {
  const priority = [
    ...getRecommendations(site),
    'solar',
    'battery',
    'comms',
    'water',
    'thermal',
    'shelter',
    'rover',
    'lab',
  ]

  const chosen: string[] = []
  let cost = 0
  let mass = 0

  for (const id of priority) {
    if (chosen.includes(id)) continue

    const item = findItem(id)

    if (!item) continue

    if (
      cost + item.cost <= budget &&
      mass + item.mass <= MASS_LIMIT
    ) {
      chosen.push(id)
      cost += item.cost
      mass += item.mass
    }
  }

  return chosen
}

function readinessLabel(value: number) {
  if (value >= 80) return 'MISSION READY'
  if (value >= 65) return 'NOMINAL'
  if (value >= 50) return 'MARGINAL'
  return 'CRITICAL'
}

/* =========================================================
   COMPONENT
   ========================================================= */

export default function Equipment({
  selectedSite,
  selectedEquipment,
  onChangeEquipment,
  onBack,
  onContinue,
  budget = EQUIPMENT_BUDGET,
}: EquipmentProps) {
  const site =
    lunarSites.find((s) => s.id === selectedSite) ??
    lunarSites[0]

  const [filter, setFilter] = useState<Filter>('all')
  const [inspectedId, setInspectedId] = useState(
    equipmentList[0].id
  )
  const [booting, setBooting] = useState(true)
  const [justInstalled, setJustInstalled] =
    useState<string | null>(null)
  const [deniedId, setDeniedId] =
    useState<string | null>(null)

  const [voiceOn, setVoiceOn] = useState(true)
  const [isListening, setIsListening] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState(() =>
    getSpeechRecognitionAPI()
      ? 'VOICE LINK READY'
      : 'VOICE INPUT NOT SUPPORTED'
  )
  const [transcript, setTranscript] = useState('')

  const [clock, setClock] = useState(0)

  const [logs, setLogs] = useState<LogEntry[]>(() => [
    {
      id: 0,
      time: 'T+00:00',
      text: `PAYLOAD BAY OPEN — TARGET ${site.code}`,
      tone: 'info',
    },
  ])

  const recognitionRef =
    useRef<SpeechRecognitionInstance | null>(null)
  const voiceOnRef = useRef(true)
  const shouldRestartRef = useRef(true)
  const mountedRef = useRef(true)
  const startRef = useRef(0)
  const logIdRef = useRef(1)
  const commandRef = useRef<(text: string) => void>(
    () => {}
  )

  /* ---------------- DERIVED ---------------- */

  const selectedItems = useMemo(
    () =>
      equipmentList.filter((item) =>
        selectedEquipment.includes(item.id)
      ),
    [selectedEquipment]
  )

  const spent = selectedItems.reduce(
    (sum, item) => sum + item.cost,
    0
  )
  const remaining = budget - spent

  const massUsed = selectedItems.reduce(
    (sum, item) => sum + item.mass,
    0
  )
  const massLeft = MASS_LIMIT - massUsed

  const readiness = useMemo(
    () => computeReadiness(site, selectedItems),
    [site, selectedItems]
  )

  const baseline = useMemo(
    () => computeReadiness(site, []),
    [site]
  )

  const recommendations = useMemo(
    () => getRecommendations(site),
    [site]
  )

  const warnings = getWarnings(
    site,
    selectedEquipment,
    readiness
  )

  const visibleItems =
    filter === 'all'
      ? equipmentList
      : equipmentList.filter(
          (item) => item.category === filter
        )

  const inspected =
    findItem(inspectedId) ?? equipmentList[0]

  const ringRadius = 54
  const ringCircumference = 2 * Math.PI * ringRadius
  const ringOffset =
    ringCircumference *
    (1 - Math.min(1, spent / budget))

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
    utterance.rate = 0.94
    utterance.pitch = 0.88
    utterance.volume = 0.8
    utterance.lang = 'en-US'

    const voices = window.speechSynthesis.getVoices()
    const preferred =
      voices.find((v) => /Google US English/i.test(v.name)) ||
      voices.find((v) => /Microsoft (Guy|David)/i.test(v.name)) ||
      voices.find((v) =>
        v.lang.toLowerCase().startsWith('en-us')
      ) ||
      voices.find((v) =>
        v.lang.toLowerCase().startsWith('en')
      )

    if (preferred) utterance.voice = preferred

    window.speechSynthesis.speak(utterance)
  }, [])

  /* ---------------- EVENT LOG ---------------- */

  const addLog = (text: string, tone: LogTone = 'info') => {
    const seconds = Math.floor(
      (Date.now() - startRef.current) / 1000
    )

    const entry: LogEntry = {
      id: logIdRef.current++,
      time: formatClock(seconds),
      text,
      tone,
    }

    setLogs((prev) => [entry, ...prev].slice(0, 7))
  }

  /* ---------------- INSTALL RULES ---------------- */

  const checkInstall = (item: EquipmentItem) => {
    if (selectedEquipment.includes(item.id)) {
      return { ok: true, reason: '', spoken: '' }
    }

    if (item.cost > remaining) {
      const need = item.cost - remaining
      return {
        ok: false,
        reason: `NEED $${need}M MORE`,
        spoken: `Insufficient budget. The ${item.shortName} needs ${need} million more.`,
      }
    }

    if (item.mass > massLeft) {
      const over = item.mass - massLeft
      return {
        ok: false,
        reason: `OVER MASS BY ${over} KG`,
        spoken: `Lander capacity exceeded by ${over} kilograms.`,
      }
    }

    return { ok: true, reason: '', spoken: '' }
  }

  const toggleItem = (id: string) => {
    const item = findItem(id)
    if (!item) return

    setInspectedId(id)

    if (selectedEquipment.includes(id)) {
      onChangeEquipment(
        selectedEquipment.filter((x) => x !== id)
      )

      addLog(`${item.code} REMOVED — ${item.name}`, 'warn')
      setVoiceStatus(`${item.code} REMOVED`)
      speak(
        `${item.shortName} removed. ${remaining + item.cost} million available.`
      )
      return
    }

    const check = checkInstall(item)

    if (!check.ok) {
      setDeniedId(id)
      addLog(`${item.code} REJECTED — ${check.reason}`, 'warn')
      setVoiceStatus(check.reason)
      speak(check.spoken)
      return
    }

    onChangeEquipment([...selectedEquipment, id])
    setJustInstalled(id)

    addLog(`${item.code} INSTALLED — ${item.name}`, 'good')
    setVoiceStatus(`${item.code} INSTALLED`)
    speak(
      `${item.shortName} installed. ${remaining - item.cost} million remaining.`
    )
  }

  const applyConfiguration = (
    ids: string[],
    label: string,
    spoken: string
  ) => {
    onChangeEquipment(ids)
    addLog(label, ids.length ? 'good' : 'warn')
    setVoiceStatus(label)
    speak(spoken)
  }

  const handleAutoConfigure = () => {
    const ids = autoConfigure(site, budget)
    const names = ids
      .map((id) => findItem(id)?.shortName)
      .filter(Boolean)
      .join(', ')

    applyConfiguration(
      ids,
      `AUTO-CONFIG — ${ids.length} MODULES`,
      `Optimized payload for ${site.name}: ${names}.`
    )
  }

  const handleClear = () => {
    applyConfiguration(
      [],
      'PAYLOAD BAY CLEARED',
      'Payload bay cleared. Full budget restored.'
    )
  }

  const handleContinue = () => {
    if (selectedEquipment.length === 0) {
      setVoiceStatus('INSTALL AT LEAST ONE MODULE')
      addLog('LAUNCH BLOCKED — EMPTY PAYLOAD', 'warn')
      speak('Install at least one module before proceeding.')
      return
    }

    setVoiceStatus('PAYLOAD LOCKED')
    addLog('PAYLOAD LOCKED — PROCEEDING', 'good')
    speak(
      `Payload locked. ${selectedEquipment.length} modules loaded. Mission readiness ${readiness.overall} percent.`
    )

    window.setTimeout(() => onContinue(), 700)
  }

  /* ---------------- VOICE CONTROL ---------------- */

  const stopVoice = () => {
    voiceOnRef.current = false
    shouldRestartRef.current = false
    setVoiceOn(false)
    setIsListening(false)
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
      setIsListening(Boolean(recognitionRef.current))
      if (recognitionRef.current) {
        setVoiceStatus('LISTENING FOR COMMAND')
      }
    } catch {
      /* already listening */
    }

    speak('Voice command system online.')
  }

  const processVoiceCommand = (raw: string) => {
    const text = raw.toLowerCase().trim()
    if (!text) return

    setTranscript(raw)

    if (
      text.includes('voice off') ||
      text.includes('mute') ||
      text.includes('disable voice')
    ) {
      stopVoice()
      return
    }

    if (
      text.includes('help') ||
      text.includes('commands') ||
      text.includes('what can i say')
    ) {
      setVoiceStatus('SAY: INSTALL / REMOVE / STATUS')
      speak(
        'Say install or remove followed by a module name. You can also say status, recommend, auto configure, clear, back, or continue.'
      )
      return
    }

    if (
      /\b(status|budget|report|how much)\b/.test(text)
    ) {
      setVoiceStatus('STATUS REPORT')
      speak(
        `${remaining} million dollars and ${massLeft} kilograms remaining. Mission readiness ${readiness.overall} percent.`
      )
      return
    }

    if (/\b(recommend|suggest|advice|advise)\b/.test(text)) {
      const names = recommendations
        .map((id) => findItem(id)?.shortName)
        .filter(Boolean)
        .join(', ')

      setVoiceStatus('RECOMMENDATIONS BRIEFED')
      speak(`For ${site.name}, flight control recommends: ${names}.`)
      return
    }

    if (/\b(auto|automatic|optimi[sz]e)\b/.test(text)) {
      handleAutoConfigure()
      return
    }

    if (/\b(clear|reset|remove all|unload all|empty)\b/.test(text)) {
      handleClear()
      return
    }

    if (
      text === 'back' ||
      text.includes('go back') ||
      text.includes('landing site')
    ) {
      setVoiceStatus('RETURNING TO SITE ANALYSIS')
      speak('Returning to landing site analysis.')
      window.setTimeout(() => onBack(), 500)
      return
    }

    if (/\b(continue|proceed|launch|next|confirm)\b/.test(text)) {
      handleContinue()
      return
    }

    const item = equipmentList.find((candidate) =>
      candidate.voiceAliases.some((alias) =>
        matchesAlias(text, alias)
      )
    )

    if (item) {
      const installed = selectedEquipment.includes(item.id)
      const wantsRemove =
        /\b(remove|uninstall|drop|delete|unload)\b/.test(text)
      const wantsAdd =
        /\b(install|add|load|equip|select|take|mount)\b/.test(text)

      if (wantsRemove && !installed) {
        speak(`${item.shortName} is not installed.`)
        return
      }

      if (wantsAdd && installed) {
        speak(`${item.shortName} is already installed.`)
        return
      }

      toggleItem(item.id)
      return
    }

    setVoiceStatus('COMMAND NOT RECOGNIZED')
    speak('Command not recognized. Say help for options.')
  }

  /* keep the latest command handler for the recognition callback */
  useEffect(() => {
    commandRef.current = processVoiceCommand
  })

  /* ---------------- EFFECTS ---------------- */

  useEffect(() => {
    const timer = window.setTimeout(
      () => setBooting(false),
      1700
    )
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    startRef.current = Date.now()

    const timer = window.setInterval(() => {
      setClock(
        Math.floor((Date.now() - startRef.current) / 1000)
      )
    }, 1000)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!justInstalled) return
    const timer = window.setTimeout(
      () => setJustInstalled(null),
      950
    )
    return () => window.clearTimeout(timer)
  }, [justInstalled])

  useEffect(() => {
    if (!deniedId) return
    const timer = window.setTimeout(
      () => setDeniedId(null),
      650
    )
    return () => window.clearTimeout(timer)
  }, [deniedId])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      speak(
        `Payload configuration online. Target: ${site.name}. You have ${budget} million dollars and ${MASS_LIMIT} kilograms of lander capacity. Say a module name to install it, or say recommend.`
      )
    }, 1900)

    return () => window.clearTimeout(timer)
  }, [speak, site.name, budget])

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
      commandRef.current(spoken)
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
    }, 1200)

    return () => {
      mountedRef.current = false
      shouldRestartRef.current = false
      window.clearTimeout(startTimer)

      try {
        recognition.stop()
      } catch {
        /* ignore */
      }
    }
  }, [])

  /* ---------------- 3D TILT ---------------- */

  const handleTilt = (
    event: ReactMouseEvent<HTMLElement>
  ) => {
    const el = event.currentTarget
    const rect = el.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width - 0.5
    const y = (event.clientY - rect.top) / rect.height - 0.5

    el.style.setProperty('--rx', `${(-y * 9).toFixed(2)}deg`)
    el.style.setProperty('--ry', `${(x * 11).toFixed(2)}deg`)
    el.style.setProperty('--mx', `${((x + 0.5) * 100).toFixed(1)}%`)
    el.style.setProperty('--my', `${((y + 0.5) * 100).toFixed(1)}%`)
  }

  const resetTilt = (
    event: ReactMouseEvent<HTMLElement>
  ) => {
    const el = event.currentTarget
    el.style.setProperty('--rx', '0deg')
    el.style.setProperty('--ry', '0deg')
  }

  /* =========================================================
     RENDER
     ========================================================= */

  return (
    <main className="eq-page">
      {/* ===================== BACKGROUND ===================== */}

      <div className="eq-space" aria-hidden="true">
        <div className="eq-stars eq-stars-a" />
        <div className="eq-stars eq-stars-b" />
        <div className="eq-stars eq-stars-c" />

        <div className="eq-nebula eq-nebula-a" />
        <div className="eq-nebula eq-nebula-b" />
        <div className="eq-aurora" />

        <div className="eq-horizon" />
        <div className="eq-floor-grid" />

        <div className="eq-satellite">
          <span className="eq-sat-panel eq-sat-panel-l" />
          <span className="eq-sat-body">
            <i />
          </span>
          <span className="eq-sat-panel eq-sat-panel-r" />
        </div>

        <div className="eq-debris">
          {Array.from({ length: 10 }).map((_, i) => (
            <span
              key={i}
              style={{ '--i': i } as CSSVars}
            />
          ))}
        </div>

        <div className="eq-scan" />
        <div className="eq-vignette" />
      </div>

      {/* ===================== BOOT OVERLAY ===================== */}

      {booting && (
        <div className="eq-boot" aria-hidden="true">
          <div className="eq-boot-core">
            <div className="eq-boot-ring">
              <i />
              <i />
              <span>◐</span>
            </div>

            <div className="eq-boot-lines">
              <p>&gt; OPENING PAYLOAD BAY............ OK</p>
              <p>&gt; LOADING MODULE CATALOG......... OK</p>
              <p>&gt; SYNCING SITE {site.code} TELEMETRY.... OK</p>
              <p>&gt; VOICE COMMAND LINK............. OK</p>
            </div>

            <div className="eq-boot-bar">
              <i />
            </div>
          </div>
        </div>
      )}

      {/* ===================== NAV ===================== */}

      <header className="eq-nav">
        <button
          className="eq-brand"
          type="button"
          onClick={onBack}
          aria-label="Return to landing site"
        >
          <span className="eq-brand-mark">M</span>
          <span className="eq-brand-copy">
            <strong>MOONIX</strong>
            <small>PAYLOAD INTEGRATION SYSTEM</small>
          </span>
        </button>

        <div className="eq-path">
          <span>MISSION</span>
          <i>/</i>
          <span>{site.code}</span>
          <i>/</i>
          <strong>EQUIPMENT</strong>
        </div>

        <div className="eq-nav-right">
          <span className="eq-clock">{formatClock(clock)}</span>

          <div
            className={`eq-status ${
              isListening ? 'is-listening' : ''
            }`}
          >
            <span className="eq-status-dot" />
            <span>{voiceStatus}</span>
          </div>
        </div>
      </header>

      {/* ===================== STEPPER ===================== */}

      <div className="eq-stepper">
        {MISSION_STEPS.map((step, index) => (
          <div
            key={step}
            className={`eq-step ${
              index < 1 ? 'is-done' : ''
            } ${index === 1 ? 'is-active' : ''}`}
          >
            <span className="eq-step-num">
              {index < 1 ? '✓' : String(index + 1).padStart(2, '0')}
            </span>
            <strong>{step}</strong>
            {index < MISSION_STEPS.length - 1 && (
              <span className="eq-step-line">
                <i />
              </span>
            )}
          </div>
        ))}
      </div>

      {/* ===================== MAIN ===================== */}

      <section className="eq-shell">
        {/* ----------- HEADING ----------- */}

        <div className="eq-heading">
          <div className="eq-heading-copy">
            <div className="eq-eyebrow">
              <span className="eq-eyebrow-line" />
              <span>PHASE 03 / PAYLOAD CONFIGURATION</span>
            </div>

            <h1 className="eq-title">
              OUTFIT
              <span data-text="YOUR LANDER">YOUR LANDER</span>
            </h1>

            <p>
              Every kilogram and every dollar counts. Choose the
              modules that will keep your crew alive, powered and
              productive at{' '}
              <b>{site.name}</b>.
            </p>
          </div>

          <div className="eq-voice">
            <button
              className={`eq-voice-orb ${
                isListening ? 'is-listening' : ''
              } ${voiceOn ? '' : 'is-off'}`}
              type="button"
              onClick={voiceOn ? stopVoice : startVoice}
              aria-label={
                voiceOn
                  ? 'Turn voice commands off'
                  : 'Turn voice commands on'
              }
            >
              <i />
              <i />
              <i />
              <span className="eq-voice-bars">
                <b />
                <b />
                <b />
                <b />
                <b />
              </span>
            </button>

            <div className="eq-voice-info">
              <small>COMMAND INTERFACE</small>
              <strong>
                {isListening
                  ? 'LISTENING'
                  : voiceOn
                    ? 'VOICE ONLINE'
                    : 'VOICE MUTED'}
              </strong>
              <span>
                {voiceOn
                  ? '"Install solar" · "Status" · "Recommend"'
                  : 'Tap the orb to reactivate'}
              </span>
            </div>
          </div>
        </div>

        {/* ----------- TRANSCRIPT ----------- */}

        <div className="eq-transcript">
          <div className="eq-transcript-left">
            <span className="eq-transcript-dot" />
            <small>VOICE TELEMETRY</small>
            <strong>
              {transcript || 'Awaiting Commander input...'}
            </strong>
          </div>

          <div className="eq-hints">
            <span>TRY</span>
            <b>INSTALL SOLAR</b>
            <b>REMOVE LAB</b>
            <b>AUTO CONFIGURE</b>
            <b>STATUS</b>
          </div>
        </div>

        {/* ----------- SITE STRIP ----------- */}

        <div className="eq-site-strip">
          <div className="eq-site-id">
            <div className="eq-site-radar">
              <i />
              <span />
            </div>

            <div>
              <small>TARGET SITE / {site.code}</small>
              <strong>{site.name}</strong>
              <span>
                {site.latitude} · {site.longitude}
              </span>
            </div>
          </div>

          <div className="eq-site-metrics">
            <div>
              <small>SUNLIGHT</small>
              <strong>{site.sunlight}%</strong>
            </div>
            <div>
              <small>EARTH LINK</small>
              <strong>{site.communication}%</strong>
            </div>
            <div>
              <small>ICE</small>
              <strong>{site.ice}</strong>
            </div>
            <div>
              <small>TEMP</small>
              <strong>{site.temperature}</strong>
            </div>
            <div>
              <small>RISK</small>
              <strong
                className={`eq-risk-${site.risk.toLowerCase()}`}
              >
                {site.risk}
              </strong>
            </div>
          </div>

          <div className="eq-rec">
            <small>FLIGHT CONTROL RECOMMENDS</small>
            <div className="eq-rec-list">
              {recommendations.map((id) => {
                const item = findItem(id)
                if (!item) return null
                const installed = selectedEquipment.includes(id)

                return (
                  <button
                    key={id}
                    type="button"
                    className={`eq-rec-chip ${
                      installed ? 'is-installed' : ''
                    }`}
                    style={{ '--accent': item.color } as CSSVars}
                    onClick={() => toggleItem(id)}
                  >
                    <b>{item.icon}</b>
                    {item.shortName}
                    {installed && <em>✓</em>}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* ----------- LAYOUT ----------- */}

        <div className="eq-layout">
          {/* ================= CATALOG ================= */}

          <div className="eq-catalog">
            <div className="eq-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={filter === 'all'}
                className={filter === 'all' ? 'is-active' : ''}
                onClick={() => setFilter('all')}
              >
                ALL MODULES
                <em>{equipmentList.length}</em>
              </button>

              {equipmentCategories.map((cat) => {
                const count = equipmentList.filter(
                  (item) => item.category === cat.id
                ).length

                return (
                  <button
                    key={cat.id}
                    type="button"
                    role="tab"
                    aria-selected={filter === cat.id}
                    className={
                      filter === cat.id ? 'is-active' : ''
                    }
                    style={{ '--accent': cat.color } as CSSVars}
                    onClick={() => setFilter(cat.id)}
                  >
                    <span className="eq-tab-dot" />
                    {cat.label}
                    <em>{count}</em>
                  </button>
                )
              })}
            </div>

            <div className="eq-cards" key={filter}>
              {!booting && visibleItems.map((item, index) => {
                const installed =
                  selectedEquipment.includes(item.id)
                const check = checkInstall(item)
                const blocked = !installed && !check.ok
                const recommended =
                  recommendations.includes(item.id)
                const note = getSiteNote(item, site)
                const sunFactor = item.sunDependent
                  ? site.sunlight / 100
                  : 1

                return (
                  <article
                    key={item.id}
                    className={[
                      'eq-card',
                      installed ? 'is-installed' : '',
                      blocked ? 'is-blocked' : '',
                      recommended ? 'is-recommended' : '',
                      justInstalled === item.id ? 'is-just' : '',
                      deniedId === item.id ? 'is-denied' : '',
                      inspectedId === item.id ? 'is-inspected' : '',
                    ].join(' ')}
                    style={
                      {
                        '--i': index,
                        '--accent': item.color,
                      } as CSSVars
                    }
                    onMouseMove={handleTilt}
                    onMouseLeave={resetTilt}
                    onMouseEnter={() => setInspectedId(item.id)}
                    onFocus={() => setInspectedId(item.id)}
                  >
                    <div className="eq-card-inner">
                      <span className="eq-card-glow" />
                      <span className="eq-card-glare" />

                      <span className="eq-corner eq-corner-tl" />
                      <span className="eq-corner eq-corner-tr" />
                      <span className="eq-corner eq-corner-bl" />
                      <span className="eq-corner eq-corner-br" />

                      <header className="eq-card-head">
                        <span className="eq-card-code">
                          {item.code}
                        </span>

                        {recommended && (
                          <span className="eq-rec-tag">
                            ★ RECOMMENDED
                          </span>
                        )}

                        <span className="eq-card-cat">
                          {item.category.toUpperCase()}
                        </span>
                      </header>

                      <div className="eq-card-icon">
                        <span className="eq-hex" />
                        <span className="eq-hex eq-hex-inner" />
                        <span className="eq-icon-orbit">
                          <i />
                        </span>
                        <b>{item.icon}</b>
                      </div>

                      <h3>{item.name}</h3>
                      <p className="eq-card-tagline">
                        {item.tagline}
                      </p>

                      <div className="eq-card-specs">
                        <div>
                          <small>COST</small>
                          <strong>${item.cost}M</strong>
                        </div>
                        <div>
                          <small>MASS</small>
                          <strong>{item.mass} KG</strong>
                        </div>
                      </div>

                      <div className="eq-card-stats">
                        {STAT_META.filter(
                          (m) => item.stats[m.key] !== 0
                        ).map((m) => {
                          const raw =
                            m.key === 'power'
                              ? item.stats.power * sunFactor
                              : item.stats[m.key]
                          const value = Math.round(raw)
                          const negative = value < 0

                          return (
                            <div
                              key={m.key}
                              className={`eq-stat ${
                                negative ? 'is-negative' : ''
                              }`}
                            >
                              <span>{m.short}</span>
                              <div className="eq-stat-bar">
                                <i
                                  style={{
                                    width: `${Math.min(
                                      100,
                                      (Math.abs(value) / 35) * 100
                                    )}%`,
                                  }}
                                />
                              </div>
                              <b>
                                {negative ? '' : '+'}
                                {value}
                              </b>
                            </div>
                          )
                        })}
                      </div>

                      {note && (
                        <div
                          className={`eq-card-note is-${note.tone}`}
                        >
                          <span />
                          {note.text}
                        </div>
                      )}

                      <button
                        type="button"
                        className="eq-install"
                        onClick={() => toggleItem(item.id)}
                        aria-pressed={installed}
                      >
                        <span className="eq-install-fill" />
                        <span className="eq-install-label">
                          {installed
                            ? 'INSTALLED · REMOVE'
                            : blocked
                              ? check.reason
                              : 'INSTALL MODULE'}
                        </span>
                        <b>{installed ? '−' : '+'}</b>
                      </button>

                      {installed && (
                        <span className="eq-stamp">
                          INSTALLED
                        </span>
                      )}

                      <span className="eq-burst" />
                      <span className="eq-burst eq-burst-2" />
                    </div>
                  </article>
                )
              })}
            </div>

            {/* ----------- INSPECTOR ----------- */}

            <div
              className="eq-inspector"
              key={inspected.id}
              style={{ '--accent': inspected.color } as CSSVars}
            >
              <div className="eq-inspector-visual">
                <span className="eq-inspector-ring" />
                <span className="eq-inspector-ring eq-inspector-ring-2" />
                <b>{inspected.icon}</b>
              </div>

              <div className="eq-inspector-copy">
                <small>
                  MODULE INSPECTOR / {inspected.code}
                </small>
                <h3>{inspected.name}</h3>
                <p>{inspected.description}</p>
              </div>

              <div className="eq-inspector-real">
                <small>◆ REAL-WORLD REFERENCE</small>
                <p>{inspected.realWorld}</p>
              </div>
            </div>
          </div>

          {/* ================= MANIFEST ================= */}

          <aside className="eq-manifest">
            {/* ----------- BUDGET ----------- */}

            <div className="eq-panel eq-budget">
              <div className="eq-panel-head">
                <span>01</span>
                <div>
                  <small>RESOURCE ALLOCATION</small>
                  <h2>Budget &amp; Mass</h2>
                </div>
              </div>

              <div className="eq-budget-body">
                <div
                  className={`eq-ring ${
                    remaining < 80 ? 'is-low' : ''
                  }`}
                >
                  <svg viewBox="0 0 140 140">
                    <defs>
                      <linearGradient
                        id="eqRingGradient"
                        x1="0"
                        y1="0"
                        x2="1"
                        y2="1"
                      >
                        <stop offset="0%" stopColor="#72e8ff" />
                        <stop offset="100%" stopColor="#e5bd72" />
                      </linearGradient>
                    </defs>

                    <circle
                      className="eq-ring-ticks"
                      cx="70"
                      cy="70"
                      r="66"
                    />
                    <circle
                      className="eq-ring-track"
                      cx="70"
                      cy="70"
                      r={ringRadius}
                    />
                    <circle
                      className="eq-ring-fill"
                      cx="70"
                      cy="70"
                      r={ringRadius}
                      strokeDasharray={ringCircumference}
                      strokeDashoffset={ringOffset}
                    />
                  </svg>

                  <div className="eq-ring-center">
                    <small>REMAINING</small>
                    <strong key={remaining}>${remaining}M</strong>
                    <span>OF ${budget}M</span>
                  </div>
                </div>

                <div className="eq-budget-side">
                  <div className="eq-budget-line">
                    <small>ALLOCATED</small>
                    <strong>${spent}M</strong>
                  </div>

                  <div className="eq-budget-line">
                    <small>MODULES</small>
                    <strong>
                      {selectedEquipment.length}
                      <em>/{equipmentList.length}</em>
                    </strong>
                  </div>

                  <div className="eq-mass">
                    <div className="eq-mass-top">
                      <small>LANDER MASS</small>
                      <strong>
                        {massUsed}
                        <em>/{MASS_LIMIT} KG</em>
                      </strong>
                    </div>

                    <div
                      className={`eq-mass-bar ${
                        massLeft < 250 ? 'is-low' : ''
                      }`}
                    >
                      <i
                        style={{
                          width: `${(massUsed / MASS_LIMIT) * 100}%`,
                        }}
                      />
                      <span className="eq-mass-marks" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ----------- CARGO BAY HOLOGRAM ----------- */}

            <div className="eq-panel eq-bay">
              <div className="eq-bay-labels">
                <span>CARGO BAY // HOLO-VIEW</span>
                <span>
                  {selectedEquipment.length} MODULES LOADED
                </span>
              </div>

              <div className="eq-bay-stage">
                <span className="eq-holo-ring eq-holo-ring-1" />
                <span className="eq-holo-ring eq-holo-ring-2" />
                <span className="eq-holo-ring eq-holo-ring-3" />
                <span className="eq-holo-beam" />

                <div className="eq-lander">
                  <span className="eq-lander-antenna">
                    <i />
                  </span>
                  <span className="eq-lander-cap" />

                  <div className="eq-lander-body">
                    <div className="eq-slots">
                      {equipmentList.map((item) => {
                        const filled =
                          selectedEquipment.includes(item.id)

                        return (
                          <span
                            key={item.id}
                            className={`eq-slot ${
                              filled ? 'is-filled' : ''
                            }`}
                            style={
                              { '--accent': item.color } as CSSVars
                            }
                            title={item.name}
                          >
                            <b>{item.icon}</b>
                          </span>
                        )
                      })}
                    </div>
                  </div>

                  <span className="eq-leg eq-leg-l" />
                  <span className="eq-leg eq-leg-r" />
                  <span className="eq-leg eq-leg-c" />
                  <span className="eq-thrust" />
                </div>

                <span className="eq-bay-scan" />
              </div>
            </div>

            {/* ----------- READINESS ----------- */}

            <div className="eq-panel eq-readiness">
              <div className="eq-panel-head">
                <span>02</span>
                <div>
                  <small>LIVE SIMULATION</small>
                  <h2>Mission Readiness</h2>
                </div>

                <div
                  className={`eq-overall ${
                    readiness.overall >= 65
                      ? 'is-good'
                      : readiness.overall >= 50
                        ? 'is-mid'
                        : 'is-bad'
                  }`}
                >
                  <strong key={readiness.overall}>
                    {readiness.overall}
                  </strong>
                  <small>{readinessLabel(readiness.overall)}</small>
                </div>
              </div>

              <div className="eq-gauges">
                {STAT_META.map((m) => {
                  const value = readiness[m.key]
                  const base = baseline[m.key]
                  const delta = value - base

                  return (
                    <div className="eq-gauge" key={m.key}>
                      <div className="eq-gauge-top">
                        <span>{m.label}</span>
                        <strong>
                          {value}%
                          {delta !== 0 && (
                            <em
                              className={
                                delta > 0 ? 'is-up' : 'is-down'
                              }
                            >
                              {delta > 0 ? '▲' : '▼'}
                              {Math.abs(delta)}
                            </em>
                          )}
                        </strong>
                      </div>

                      <div
                        className={`eq-gauge-bar ${
                          value < 50 ? 'is-low' : ''
                        }`}
                      >
                        <i style={{ width: `${value}%` }} />
                        <span
                          className="eq-gauge-base"
                          style={{ left: `${base}%` }}
                          title="Site baseline"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="eq-gauge-legend">
                <span>
                  <i className="eq-legend-base" /> SITE BASELINE
                </span>
                <span>
                  <i className="eq-legend-fill" /> WITH PAYLOAD
                </span>
              </div>

              {warnings.length > 0 ? (
                <ul className="eq-warnings">
                  {warnings.map((w) => (
                    <li key={w}>
                      <span>!</span>
                      {w}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="eq-all-clear">
                  <span>✓</span>
                  ALL SYSTEMS WITHIN MISSION MARGINS
                </div>
              )}

              <div className="eq-actions">
                <button
                  type="button"
                  className="eq-action eq-action-auto"
                  onClick={handleAutoConfigure}
                >
                  <span>⚙</span>
                  AUTO-CONFIGURE
                </button>

                <button
                  type="button"
                  className="eq-action eq-action-clear"
                  onClick={handleClear}
                  disabled={selectedEquipment.length === 0}
                >
                  <span>⟲</span>
                  CLEAR BAY
                </button>
              </div>
            </div>

            {/* ----------- EVENT LOG ----------- */}

            <div className="eq-panel eq-log">
              <div className="eq-log-head">
                <span className="eq-log-dot" />
                <small>INTEGRATION LOG</small>
                <span className="eq-log-clock">
                  {formatClock(clock)}
                </span>
              </div>

              <ul>
                {logs.map((entry) => (
                  <li
                    key={entry.id}
                    className={`is-${entry.tone}`}
                  >
                    <time>{entry.time}</time>
                    <span>{entry.text}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* ----------- FOOTER ----------- */}

            <div className="eq-footer">
              <button
                type="button"
                className="eq-back"
                onClick={onBack}
              >
                <span>←</span>
                LANDING SITE
              </button>

              <button
                type="button"
                className={`eq-continue ${
                  selectedEquipment.length === 0
                    ? 'is-disabled'
                    : ''
                }`}
                onClick={handleContinue}
              >
                <span className="eq-continue-shine" />
                <span className="eq-continue-copy">
                  <small>PROCEED TO</small>
                  <strong>LAUNCH WINDOW</strong>
                </span>
                <b>→</b>
              </button>
            </div>
          </aside>
        </div>

        {/* ----------- BOTTOM HUD ----------- */}

        <div className="eq-coordinates">
          <div>
            <span className="eq-cross">+</span>
            <span>{site.region.toUpperCase()}</span>
            <i />
            <span>PAYLOAD INTEGRATION</span>
          </div>

          <div>
            <span>
              {selectedEquipment.length}/{equipmentList.length} MODULES
            </span>
            <span className="eq-nominal">
              {warnings.length === 0
                ? 'SYSTEM NOMINAL'
                : `${warnings.length} ADVISORIES`}
            </span>
          </div>
        </div>
      </section>
    </main>
  )
}
