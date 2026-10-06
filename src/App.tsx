import { useState } from 'react'

import WelcomeScreen from './components/WelcomeScreen'
import MissionBrief from './components/MissionBrief'
import LandingSite from './components/LandingSite'
import Equipment from './components/Equipment'
import MissionWindow from './components/MissionWindow'
import MissionSimulation from './components/MissionSimulation'
import MissionSuccess from './components/MissionSuccess'
import MissionFailure from './components/MissionFailure'
import ResultsSummary from './components/ResultsSummary'
import WhatYouLearned from './components/WhatYouLearned'
import MissionJournal from './components/MissionJournal'
import ThanksPage from './components/ThanksPage'

import { lunarSites } from './data/lunarSites'
import { EQUIPMENT_BUDGET } from './data/equipment'
import {
  FIRST_TRY_BONUS,
  evaluateMission,
  type MissionResult,
  type Shortage,
} from './data/missionEngine'
import { loadBonus, saveBonus } from './data/missionStorage'

type Screen =
  | 'welcome'
  | 'mission-brief'
  | 'landing-site'
  | 'equipment'
  | 'mission-window'
  | 'mission-simulation'
  | 'mission-success'
  | 'mission-failure'
  | 'results-summary'
  | 'what-you-learned'
  | 'mission-journal'
  | 'thanks'

function App() {
  const [screen, setScreen] =
    useState<Screen>('welcome')

  const [selectedSite, setSelectedSite] =
    useState('')

  const [selectedEquipment, setSelectedEquipment] =
    useState<string[]>([])

  const [selectedWindow, setSelectedWindow] =
    useState('')

  /* permanent bonus ($M) — survives restarts and refreshes */
  const [bonus, setBonus] = useState(loadBonus)

  const [missionId, setMissionId] = useState('')
  const [missionResult, setMissionResult] =
    useState<MissionResult | null>(null)
  const [initialShortages, setInitialShortages] =
    useState<Shortage[]>([])
  const [attempts, setAttempts] = useState(0)
  const [bonusEarned, setBonusEarned] = useState(0)

  const budget = EQUIPMENT_BUDGET + bonus
  const firstAttempt = attempts === 1

  /* =====================================================
     WELCOME → MISSION BRIEF
  ===================================================== */

  const handleMissionBrief = () => {
    setScreen('mission-brief')
  }

  /* =====================================================
     MISSION BRIEF → LANDING SITE
  ===================================================== */

  const handleBeginAnalysis = () => {
    setScreen('landing-site')
  }

  /* =====================================================
     MISSION BRIEF → WELCOME
  ===================================================== */

  const handleBackToWelcome = () => {
    setScreen('welcome')
  }

  /* =====================================================
     LANDING SITE → MISSION BRIEF
  ===================================================== */

  const handleBackToBrief = () => {
    setScreen('mission-brief')
  }

  /* =====================================================
     SELECT LANDING SITE
  ===================================================== */

  const handleSelectSite = (site: string) => {
    setSelectedSite(site)
  }

  /* =====================================================
     LANDING SITE → EQUIPMENT
  ===================================================== */

  const handleContinue = () => {
    if (!selectedSite) {
      setSelectedSite(lunarSites[0].id)
    }

    setScreen('equipment')
  }

  /* =====================================================
     EQUIPMENT → LANDING SITE
  ===================================================== */

  const handleBackToSite = () => {
    setScreen('landing-site')
  }

  /* =====================================================
     EQUIPMENT → MISSION WINDOW
  ===================================================== */

  const handleEquipmentContinue = () => {
    setScreen('mission-window')
  }

  /* =====================================================
     MISSION WINDOW → EQUIPMENT
  ===================================================== */

  const handleBackToEquipment = () => {
    setScreen('equipment')
  }

  /* =====================================================
     MISSION WINDOW → MISSION SIMULATION
  ===================================================== */

  const handleLaunch = () => {
    setMissionId(String(Date.now()))
    setAttempts(1)
    setBonusEarned(0)
    setMissionResult(null)
    setInitialShortages([])
    setScreen('mission-simulation')
  }

  /* =====================================================
     MISSION SIMULATION → MISSION WINDOW
  ===================================================== */

  const handleBackToWindow = () => {
    setScreen('mission-window')
  }

  /* =====================================================
     MISSION SIMULATION → SUCCESS / FAILURE
     First-try success earns the permanent bonus.
  ===================================================== */

  const handleSimulationComplete = (result: MissionResult) => {
    setMissionResult(result)

    if (result.success) {
      const earned = firstAttempt ? FIRST_TRY_BONUS : 0
      if (earned) {
        setBonus(bonus + earned)
        saveBonus(bonus + earned)
      }
      setBonusEarned(earned)
      setScreen('mission-success')
    } else {
      setInitialShortages(result.shortages)
      setScreen('mission-failure')
    }
  }

  /* =====================================================
     FAILURE → FIX AND CONTINUE → SUCCESS (no bonus)
  ===================================================== */

  const handleFixAndContinue = (addedIds: string[]) => {
    const ids = [...selectedEquipment, ...addedIds]

    setSelectedEquipment(ids)
    setAttempts(attempts + 1)
    setBonusEarned(0)
    setMissionResult(
      evaluateMission(selectedSite, ids, selectedWindow, budget)
    )
    setScreen('mission-success')
  }

  /* =====================================================
     RESTART / PLAY NEXT MISSION → LANDING SITE
     Selections reset, the permanent bonus stays.
  ===================================================== */

  const resetMission = () => {
    setSelectedSite('')
    setSelectedEquipment([])
    setSelectedWindow('')
    setMissionId('')
    setMissionResult(null)
    setInitialShortages([])
    setAttempts(0)
    setBonusEarned(0)
    setScreen('landing-site')
  }

  /* =====================================================
     SCREEN RENDERING
  ===================================================== */

  if (screen === 'welcome') {
    return (
      <WelcomeScreen
        onMissionBrief={handleMissionBrief}
      />
    )
  }

  if (screen === 'mission-brief') {
    return (
      <MissionBrief
        onBeginAnalysis={handleBeginAnalysis}
        onBack={handleBackToWelcome}
      />
    )
  }

  if (screen === 'equipment') {
    return (
      <Equipment
        selectedSite={selectedSite}
        selectedEquipment={selectedEquipment}
        onChangeEquipment={setSelectedEquipment}
        onBack={handleBackToSite}
        onContinue={handleEquipmentContinue}
        budget={budget}
      />
    )
  }

  if (screen === 'mission-window') {
    return (
      <MissionWindow
        selectedSite={selectedSite}
        selectedEquipment={selectedEquipment}
        selectedWindow={selectedWindow}
        onSelectWindow={setSelectedWindow}
        onBack={handleBackToEquipment}
        onContinue={handleLaunch}
      />
    )
  }

  if (screen === 'mission-simulation') {
    return (
      <MissionSimulation
        selectedSite={selectedSite}
        selectedEquipment={selectedEquipment}
        selectedWindow={selectedWindow}
        budget={budget}
        onBack={handleBackToWindow}
        onComplete={handleSimulationComplete}
      />
    )
  }

  if (screen === 'mission-failure' && missionResult) {
    return (
      <MissionFailure
        result={missionResult}
        budget={missionResult.budget}
        onFixAndContinue={handleFixAndContinue}
        onRestart={resetMission}
      />
    )
  }

  if (screen === 'mission-success' && missionResult) {
    return (
      <MissionSuccess
        result={missionResult}
        firstAttempt={firstAttempt}
        bonusEarned={bonusEarned}
        totalBonus={bonus}
        onContinue={() => setScreen('results-summary')}
      />
    )
  }

  if (screen === 'results-summary' && missionResult) {
    return (
      <ResultsSummary
        result={missionResult}
        firstAttempt={firstAttempt}
        attempts={attempts}
        onBack={() => setScreen('mission-success')}
        onContinue={() => setScreen('what-you-learned')}
      />
    )
  }

  if (screen === 'what-you-learned' && missionResult) {
    return (
      <WhatYouLearned
        result={missionResult}
        firstAttempt={firstAttempt}
        initialShortages={initialShortages}
        onBack={() => setScreen('results-summary')}
        onContinue={() => setScreen('mission-journal')}
      />
    )
  }

  if (screen === 'mission-journal' && missionResult) {
    return (
      <MissionJournal
        missionId={missionId}
        result={missionResult}
        firstAttempt={firstAttempt}
        attempts={attempts}
        bonusEarned={bonusEarned}
        onBack={() => setScreen('what-you-learned')}
        onNextMission={() => setScreen('thanks')}
      />
    )
  }

  if (screen === 'thanks' && missionResult) {
    return (
      <ThanksPage
        result={missionResult}
        firstAttempt={firstAttempt}
        bonusEarned={bonusEarned}
        totalBonus={bonus}
        onBack={() => setScreen('mission-journal')}
        onPlayAgain={resetMission}
      />
    )
  }

  return (
    <LandingSite
      selectedSite={selectedSite}
      onSelectSite={handleSelectSite}
      onBack={handleBackToBrief}
      onContinue={handleContinue}
    />
  )
}

export default App
