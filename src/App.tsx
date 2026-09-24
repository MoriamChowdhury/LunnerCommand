import { useState } from 'react'
import WelcomeScreen from './components/WelcomeScreen'
import MissionBrief from './components/MissionBrief'

type Screen = 'welcome' | 'brief' | 'landing'

export default function App() {
  const [screen, setScreen] =
    useState<Screen>('welcome')

  if (screen === 'welcome') {
    return (
      <WelcomeScreen
        onMissionBrief={() =>
          setScreen('brief')
        }
      />
    )
  }

  if (screen === 'brief') {
    return (
      <MissionBrief
        onBack={() =>
          setScreen('welcome')
        }
        onBeginAnalysis={() =>
          setScreen('landing')
        }
      />
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#02060c',
        color: 'white',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <h1>Landing Site Coming Next...</h1>
    </div>
  )
}