import { useCallback, useEffect, useRef, useState } from 'react'

/* =========================================================
   MOONIX — SHARED VOICE LINK
   Speech output + voice commands for the mission screens.
   Same voice settings as Mission Window so every screen
   sounds like the same flight controller.
   ========================================================= */

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

type VoiceOptions = {
  /* called with the heard text (lower case) and the raw text */
  onCommand: (text: string, raw: string) => void
  /* spoken once, shortly after the screen opens */
  intro?: string
}

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

const hasSpeechOutput = () =>
  typeof window !== 'undefined' && 'speechSynthesis' in window

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/* true if the text contains any of the words/phrases */
export const saidAny = (text: string, phrases: string[]) =>
  phrases.some((p) =>
    new RegExp(`\\b${escapeRegExp(p)}\\b`).test(text)
  )

/* mute choice is remembered while moving between screens */
let voicePreference = true

export function useMissionVoice({ onCommand, intro }: VoiceOptions) {
  const [voiceOn, setVoiceOn] = useState(voicePreference)
  const [isListening, setIsListening] = useState(false)
  const [status, setStatus] = useState(() =>
    !voicePreference
      ? 'VOICE LINK MUTED'
      : getSpeechRecognitionAPI()
        ? 'VOICE LINK READY'
        : 'VOICE INPUT NOT SUPPORTED'
  )
  const [heard, setHeard] = useState('')

  const recognitionRef =
    useRef<SpeechRecognitionInstance | null>(null)
  const voiceOnRef = useRef(voicePreference)
  const shouldRestartRef = useRef(true)
  const mountedRef = useRef(true)
  const speakingRef = useRef(false)
  const commandRef = useRef(onCommand)
  const introRef = useRef(intro)

  /* always call the newest handler (it reads fresh state) */
  useEffect(() => {
    commandRef.current = onCommand
  })

  /* ---------------- SPEECH OUTPUT ---------------- */

  const speak = useCallback((text: string) => {
    if (!voiceOnRef.current || !hasSpeechOutput()) return

    window.speechSynthesis.cancel()

    const voices = window.speechSynthesis.getVoices()
    const preferred =
      voices.find((v) => /Google US English/i.test(v.name)) ||
      voices.find((v) => /Microsoft (Aria|Jenny|Guy|David)/i.test(v.name)) ||
      voices.find((v) => v.lang.toLowerCase().startsWith('en-us')) ||
      voices.find((v) => v.lang.toLowerCase().startsWith('en'))

    /* short chunks: some browsers cut off long utterances */
    const chunks =
      text.match(/[^.!?]+[.!?]*/g)?.map((c) => c.trim()).filter(Boolean) ??
      [text]

    chunks.forEach((chunk, i) => {
      const utterance = new SpeechSynthesisUtterance(chunk)
      utterance.rate = 0.96
      utterance.pitch = 0.9
      utterance.volume = 0.85
      utterance.lang = 'en-US'
      if (preferred) utterance.voice = preferred

      if (i === 0) {
        utterance.onstart = () => {
          speakingRef.current = true
        }
      }

      if (i === chunks.length - 1) {
        const done = () => {
          speakingRef.current = false
        }
        utterance.onend = done
        utterance.onerror = done
      }

      window.speechSynthesis.speak(utterance)
    })
  }, [])

  /* ---------------- ON / OFF ---------------- */

  const stopVoice = useCallback(() => {
    voicePreference = false
    voiceOnRef.current = false
    shouldRestartRef.current = false
    setVoiceOn(false)
    setIsListening(false)
    setStatus('VOICE LINK MUTED')

    try {
      recognitionRef.current?.stop()
    } catch {
      /* ignore */
    }

    if (hasSpeechOutput()) window.speechSynthesis.cancel()
  }, [])

  const startVoice = useCallback(() => {
    voicePreference = true
    voiceOnRef.current = true
    shouldRestartRef.current = true
    setVoiceOn(true)
    setStatus('VOICE LINK ACTIVE')

    try {
      recognitionRef.current?.start()
      if (recognitionRef.current) {
        setIsListening(true)
        setStatus('LISTENING FOR COMMAND')
      }
    } catch {
      /* already running */
    }
  }, [])

  const toggleVoice = voiceOn ? stopVoice : startVoice

  /* ---------------- INTRO LINE ---------------- */

  useEffect(() => {
    if (!introRef.current) return

    const timer = window.setTimeout(() => {
      if (introRef.current) speak(introRef.current)
    }, 900)

    return () => window.clearTimeout(timer)
  }, [speak])

  /* ---------------- SPEECH RECOGNITION ---------------- */

  useEffect(() => {
    mountedRef.current = true

    const SpeechRecognitionAPI = getSpeechRecognitionAPI()

    if (!SpeechRecognitionAPI) {
      return () => {
        mountedRef.current = false
        if (hasSpeechOutput()) window.speechSynthesis.cancel()
      }
    }

    const recognition = new SpeechRecognitionAPI()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onresult = (event) => {
      const latest = event.results[event.results.length - 1]
      const raw = (latest?.[0]?.transcript || '').trim()
      if (!raw) return

      /* while talking, only "stop" / "quiet" / "skip" get through,
         so our own voice through the speakers is not a command */
      if (speakingRef.current) {
        if (saidAny(raw.toLowerCase(), ['stop', 'quiet', 'skip'])) {
          window.speechSynthesis.cancel()
          speakingRef.current = false
          setHeard(raw)
        }
        return
      }

      setHeard(raw)
      commandRef.current(raw.toLowerCase(), raw)
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
        setStatus('MICROPHONE PERMISSION DENIED')
        setIsListening(false)
        shouldRestartRef.current = false
        return
      }

      if (event.error === 'no-speech') {
        setStatus('LISTENING FOR COMMAND')
        return
      }

      setStatus('VOICE LINK RECOVERING')
    }

    recognitionRef.current = recognition
    shouldRestartRef.current = voiceOnRef.current

    const startTimer = window.setTimeout(() => {
      if (!mountedRef.current || !voiceOnRef.current) return

      try {
        recognition.start()
        setIsListening(true)
        setStatus('LISTENING FOR COMMAND')
      } catch {
        setStatus('VOICE LINK READY')
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

      if (hasSpeechOutput()) window.speechSynthesis.cancel()
    }
  }, [])

  return {
    voiceOn,
    isListening,
    status,
    heard,
    speak,
    toggleVoice,
  }
}
