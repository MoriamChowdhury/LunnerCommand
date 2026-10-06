import './VoiceControl.css'

/* =========================================================
   MOONIX — VOICE CONTROL (mic button + status)
   Shared by the mission screens. Looks like the mic on the
   Mission Window screen.
   ========================================================= */

type VoiceControlProps = {
  voiceOn: boolean
  isListening: boolean
  status: string
  heard: string
  hint: string
  onToggle: () => void
}

export default function VoiceControl({
  voiceOn,
  isListening,
  status,
  heard,
  hint,
  onToggle,
}: VoiceControlProps) {
  return (
    <div className="vc-voice">
      <button
        type="button"
        className={`vc-mic ${isListening ? 'is-listening' : ''} ${
          voiceOn ? '' : 'is-off'
        }`}
        onClick={onToggle}
        aria-label={
          voiceOn ? 'Turn voice commands off' : 'Turn voice commands on'
        }
        title={voiceOn ? 'Voice on — click to mute' : 'Voice off — click to turn on'}
      >
        <i />
        <i />
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" />
          {!voiceOn && <path d="M4 4l16 16" className="vc-mic-slash" />}
        </svg>
      </button>

      <div className="vc-copy" aria-live="polite">
        <small className={isListening ? 'is-listening' : ''}>
          {status}
        </small>
        <span>{heard ? `“${heard}”` : hint}</span>
      </div>
    </div>
  )
}
