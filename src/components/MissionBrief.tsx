import { useEffect, useState } from 'react'
import './MissionBrief.css'

type MissionBriefProps = {
  onBeginAnalysis?: () => void
  onBack?: () => void
}

const missionFactors = [
  {
    icon: '☀',
    title: 'POWER',
    subtitle: 'Solar Energy',
    description: 'Evaluate illumination conditions for reliable power.',
  },
  {
    icon: '◈',
    title: 'RESOURCES',
    subtitle: 'Water-Ice',
    description: 'Search for locations with valuable lunar resources.',
  },
  {
    icon: '△',
    title: 'TERRAIN',
    subtitle: 'Surface Safety',
    description: 'Analyze terrain conditions for landing and construction.',
  },
  {
    icon: '◇',
    title: 'THERMAL',
    subtitle: 'Temperature',
    description: 'Prepare for extreme lunar thermal conditions.',
  },
  {
    icon: '⌁',
    title: 'COMMUNICATION',
    subtitle: 'Earth Link',
    description: 'Maintain a reliable communication path with Earth.',
  },
  {
    icon: '✦',
    title: 'SCIENCE',
    subtitle: 'Research Value',
    description: 'Maximize the scientific return of the mission.',
  },
]

export default function MissionBrief({
  onBeginAnalysis,
  onBack,
}: MissionBriefProps) {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoaded(true)
    }, 200)

    return () => window.clearTimeout(timer)
  }, [])

  return (
    <main
      className={`mission-brief ${
        loaded ? 'mission-loaded' : ''
      }`}
    >
      {/* BACKGROUND */}
      <div className="brief-space">
        <div className="brief-stars brief-stars-one" />
        <div className="brief-stars brief-stars-two" />

        <div className="brief-nebula brief-nebula-left" />
        <div className="brief-nebula brief-nebula-right" />

        <div className="brief-grid" />
      </div>

      {/* EARTH */}
      <div className="brief-earth">
        <div className="brief-earth-land land-a" />
        <div className="brief-earth-land land-b" />

        <div className="brief-earth-cloud cloud-a" />
        <div className="brief-earth-cloud cloud-b" />

        <div className="brief-earth-shadow" />
      </div>

      {/* MOON */}
      <div className="brief-moon">
        <div className="brief-moon-crater crater-one" />
        <div className="brief-moon-crater crater-two" />
        <div className="brief-moon-crater crater-three" />

        <div className="brief-moon-shadow" />
      </div>

      {/* TOP HUD */}
      <header className="brief-topbar">
        <div className="brief-brand">
          <span className="brand-moon">◐</span>

          <div>
            <strong>MOONIX</strong>
            <small>LUNAR MISSION SYSTEM</small>
          </div>
        </div>

        <div className="brief-top-center">
          <span>MISSION // MX-01</span>
          <span className="brief-separator">•</span>
          <span>LUNAR SOUTH POLE</span>
        </div>

        <div className="brief-system-online">
          <span className="online-dot" />
          SYSTEM ONLINE
        </div>
      </header>

      {/* MAIN CONTENT */}
      <section className="brief-content">

        {/* TITLE */}
        <div className="brief-heading">
          <div className="brief-eyebrow">
            <span className="eyebrow-line" />

            COMMANDER BRIEFING

            <span className="eyebrow-line" />
          </div>

          <h1>
            MISSION
            <span> BRIEF</span>
          </h1>

          <p>
            Establish a sustainable scientific outpost near the
            lunar south pole.
          </p>
        </div>

        {/* MAIN GLASS PANEL */}
        <div className="brief-main-panel">

          <div className="panel-corner corner-top-left" />
          <div className="panel-corner corner-top-right" />
          <div className="panel-corner corner-bottom-left" />
          <div className="panel-corner corner-bottom-right" />

          {/* LEFT SIDE */}
          <div className="brief-objective">

            <div className="section-label">
              <span>01</span>
              PRIMARY OBJECTIVE
            </div>

            <h2>
              BUILD A SUSTAINABLE
              <br />
              <span>LUNAR OUTPOST</span>
            </h2>

            <p className="objective-description">
              Commander, your task is to evaluate the lunar
              environment and make strategic decisions that balance
              crew survival, mission resources, and scientific return.
            </p>

            <div className="brief-location">
              <div className="location-target">
                <span className="target-ring" />
                <span className="target-center" />
              </div>

              <div>
                <small>TARGET REGION</small>
                <strong>LUNAR SOUTH POLE</strong>
                <span>Near permanently shadowed regions</span>
              </div>
            </div>

            {/* DATA CONNECTION */}
            <div className="nasa-data-box">

              <div className="data-box-top">

                <div>
                  <span className="data-pulse" />

                  <div>
                    <strong>LUNAR DATA SYSTEM</strong>
                    <small>MISSION DATA AVAILABLE</small>
                  </div>
                </div>

                <span className="data-status">
                  CONNECTED
                </span>

              </div>

              <p>
                Environmental observations will support your
                site analysis and mission decisions.
              </p>

              <div className="data-stream">
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>

            </div>
          </div>

          {/* RIGHT SIDE */}
          <div className="brief-priorities">

            <div className="section-label">
              <span>02</span>
              MISSION PRIORITIES
            </div>

            <div className="priority-grid">

              {missionFactors.map((factor, index) => (
                <article
                  className="priority-card"
                  key={factor.title}
                  style={
                    {
                      '--delay': `${index * 0.08}s`,
                    } as React.CSSProperties
                  }
                >

                  <div className="priority-icon">
                    {factor.icon}
                  </div>

                  <div className="priority-info">

                    <div className="priority-title-row">
                      <h3>{factor.title}</h3>
                      <span>{factor.subtitle}</span>
                    </div>

                    <p>{factor.description}</p>

                    <div className="priority-line">
                      <span />
                    </div>

                  </div>

                </article>
              ))}

            </div>
          </div>
        </div>

        {/* MISSION FLOW */}
        <div className="mission-sequence">

          <div className="sequence-title">
            MISSION SEQUENCE
          </div>

          <div className="sequence-flow">

            <div className="sequence-step active-step">
              <span>01</span>
              <strong>SITE ANALYSIS</strong>
            </div>

            <div className="sequence-connector">
              <span />
              <b>›</b>
            </div>

            <div className="sequence-step">
              <span>02</span>
              <strong>EQUIPMENT</strong>
            </div>

            <div className="sequence-connector">
              <span />
              <b>›</b>
            </div>

            <div className="sequence-step">
              <span>03</span>
              <strong>MISSION</strong>
            </div>

            <div className="sequence-connector">
              <span />
              <b>›</b>
            </div>

            <div className="sequence-step">
              <span>04</span>
              <strong>DECISIONS</strong>
            </div>

            <div className="sequence-connector">
              <span />
              <b>›</b>
            </div>

            <div className="sequence-step">
              <span>05</span>
              <strong>RESULTS</strong>
            </div>

          </div>
        </div>

        {/* BOTTOM */}
        <div className="brief-bottom">

          {/* BACK */}
          <button
            className="brief-back-button"
            type="button"
            onClick={onBack}
          >
            <span>←</span>
            BACK
          </button>

          {/* COMMANDER MESSAGE */}
          <div className="commander-message">

            <span className="commander-line" />

            <div>
              <small>HOUSTON // FLIGHT CONTROL</small>

              <p>
                “Commander, mission parameters are uploaded.
                Begin your analysis when ready.”
              </p>
            </div>

          </div>

          {/* BEGIN ANALYSIS */}
          <button
            className="begin-analysis-button"
            type="button"
            onClick={onBeginAnalysis}
          >
            <div>
              <small>PROCEED TO</small>
              <strong>BEGIN ANALYSIS</strong>
            </div>

            <span className="analysis-arrow">
              →
            </span>
          </button>

        </div>
      </section>

      {/* DECORATION */}
      <div className="brief-left-coordinate">
        89.9° S
      </div>

      <div className="brief-right-coordinate">
        MX-01 // 2026
      </div>

      <div className="brief-scanline" />
      <div className="brief-vignette" />

    </main>
  )
}