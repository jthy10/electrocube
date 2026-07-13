import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { GameScene } from './components/GameScene'
import { HelpPanel } from './components/HelpPanel'
import { HUD } from './components/HUD'
import { Lobby } from './components/Lobby'
import { MainMenu } from './components/MainMenu'
import { MobileControls } from './components/MobileControls'
import { ResultsScreen } from './components/ResultsScreen'
import { gameAudio } from './game/audio'
import { getLeaderboard, recordScore, subscribeLeaderboard } from './game/leaderboard'
import {
  createDuelSession,
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
  type DuelMessage,
  type DuelSession,
} from './game/multiplayer'
import { resetVirtualControls } from './game/input'
import { useGameStore } from './game/store'
import type { CubeColor, LeaderboardEntry, RivalSnapshot } from './game/types'

const emptyRival = (name: string, color: CubeColor): RivalSnapshot => ({
  name,
  color,
  score: 0,
  combo: 0,
  charge: 0,
  shields: 3,
  position: { x: 0, y: 1.05, z: -8 },
  rotationY: 0,
  updatedAt: Date.now(),
})

function SceneEffects({ reduced }: { reduced: boolean }) {
  if (reduced) return null
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom intensity={1.25} luminanceThreshold={0.32} luminanceSmoothing={0.72} mipmapBlur />
      <Vignette eskil={false} offset={0.18} darkness={0.72} />
    </EffectComposer>
  )
}

function CountdownOverlay({ count }: { count: number }) {
  return (
    <div className="countdown-overlay" role="status" aria-live="assertive">
      <span className="countdown-overlay__eyebrow">Arena synchronized</span>
      <strong key={count}>{count > 0 ? count : 'SURGE'}</strong>
      <p>Chain shards · bank circuits · pulse at 100%</p>
    </div>
  )
}

function App() {
  const phase = useGameStore((state) => state.phase)
  const mode = useGameStore((state) => state.mode)
  const playerName = useGameStore((state) => state.playerName)
  const playerColor = useGameStore((state) => state.playerColor)
  const soundEnabled = useGameStore((state) => state.soundEnabled)
  const reducedEffects = useGameStore((state) => state.reducedEffects)
  const score = useGameStore((state) => state.score)
  const combo = useGameStore((state) => state.combo)
  const multiplier = useGameStore((state) => state.multiplier)
  const comboTime = useGameStore((state) => state.comboTime)
  const charge = useGameStore((state) => state.charge)
  const shields = useGameStore((state) => state.shields)
  const timeLeft = useGameStore((state) => state.timeLeft)
  const wave = useGameStore((state) => state.wave)
  const objective = useGameStore((state) => state.objective)
  const objectiveProgress = useGameStore((state) => state.objectiveProgress)
  const objectiveTarget = useGameStore((state) => state.objectiveTarget)
  const rival = useGameStore((state) => state.rival)
  const roomCode = useGameStore((state) => state.roomCode)
  const networkStatus = useGameStore((state) => state.networkStatus)
  const result = useGameStore((state) => state.result)
  const countdown = useGameStore((state) => state.countdown)
  const notice = useGameStore((state) => state.notice)
  const [helpOpen, setHelpOpen] = useState(false)
  const [booting, setBooting] = useState(true)
  const [isHost, setIsHost] = useState(false)
  const [jamSignal, setJamSignal] = useState(0)
  const [matchConfig, setMatchConfig] = useState<{ seed: number; startsAt: number; duration: number } | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(() => getLeaderboard(10))
  const sessionRef = useRef<DuelSession | null>(null)
  const duelStartsAt = useRef(0)
  const remoteFinishScore = useRef<number | null>(null)
  const recordedResult = useRef('')
  const autoJoinAttempted = useRef(false)

  useEffect(() => {
    const timeout = window.setTimeout(() => setBooting(false), 850)
    return () => window.clearTimeout(timeout)
  }, [])

  useEffect(() => subscribeLeaderboard((entries) => setLeaderboard(entries)), [])

  useEffect(() => {
    gameAudio.setEnabled(soundEnabled)
  }, [soundEnabled])

  useEffect(() => {
    const unlock = () => {
      void gameAudio.unlock()
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  useEffect(
    () => () => {
      sessionRef.current?.dispose()
      resetVirtualControls()
      gameAudio.stopMusic(0.05)
    },
    [],
  )

  const launchDuel = useCallback(() => {
    const startsAt = Date.now() + 3_000
    const seed = Math.floor(Math.random() * 2_000_000_000)
    const duration = 90
    duelStartsAt.current = startsAt
    remoteFinishScore.current = null
    recordedResult.current = ''
    sessionRef.current?.send({
      type: 'start',
      seed,
      startsAt,
      duration,
    })
    setMatchConfig({ seed, startsAt, duration })
    useGameStore.getState().prepareRun('duel')
  }, [])

  const handleDuelMessage = useCallback(
    (message: DuelMessage) => {
      const store = useGameStore.getState()
      switch (message.type) {
        case 'hello':
          store.setRival(emptyRival(message.player.name, message.player.color))
          store.setNetworkStatus('RIVAL SYNCED')
          break
        case 'snapshot':
          store.setRival(message.snapshot)
          break
        case 'start': {
          duelStartsAt.current = message.startsAt
          setMatchConfig({ seed: message.seed, startsAt: message.startsAt, duration: message.duration })
          remoteFinishScore.current = null
          recordedResult.current = ''
          useGameStore.getState().prepareRun('duel')
          break
        }
        case 'jam':
          setJamSignal((value) => value + 1)
          break
        case 'finish': {
          remoteFinishScore.current = message.summary.score
          const current = store.rival
          if (current) store.setRival({ ...current, score: message.summary.score, updatedAt: Date.now() })
          const localResult = store.result
          if (localResult && store.phase === 'results' && store.mode === 'duel') {
            const won = localResult.score >= message.summary.score
            store.finishRun({ ...localResult, mode: 'duel', won })
            gameAudio.play(won ? 'victory' : 'defeat')
          }
          break
        }
        case 'rematch':
          if (
            message.accepted &&
            store.phase === 'results' &&
            remoteFinishScore.current !== null &&
            sessionRef.current?.snapshot.role === 'host' &&
            sessionRef.current.snapshot.state === 'connected'
          ) launchDuel()
          break
        case 'leave':
          store.setNetworkStatus('RIVAL LEFT')
          store.setNotice(message.reason ?? 'The rival left the arena.')
          break
        case 'reject':
          store.setNotice(message.reason === 'room-full' ? 'That arena is already full.' : 'Game versions do not match.')
          break
        default:
          break
      }
    },
    [launchDuel],
  )

  const createSession = useCallback(() => {
    sessionRef.current?.dispose()
    const session = createDuelSession(
      { name: playerName, color: playerColor },
      {
        onStateChange: (_state, detail) => useGameStore.getState().setNetworkStatus(detail),
        onConnected: () => useGameStore.getState().setNetworkStatus('DIRECT LINK STABLE'),
        onMessage: (message) => handleDuelMessage(message),
        onDisconnected: (reason) => {
          useGameStore.getState().setNetworkStatus('LINK LOST')
          useGameStore.getState().setNotice(reason)
        },
        onError: (error) => {
          useGameStore.getState().setNetworkStatus('UPLINK ERROR')
          useGameStore.getState().setNotice(error.message)
        },
      },
    )
    sessionRef.current = session
    return session
  }, [handleDuelMessage, playerColor, playerName])

  const unlockGameAudio = useCallback(() => {
    gameAudio.setEnabled(useGameStore.getState().soundEnabled)
    void gameAudio.unlock()
    gameAudio.startMusic()
  }, [])

  const playSolo = useCallback(() => {
    sessionRef.current?.close('Switched to solo')
    sessionRef.current = null
    useGameStore.getState().setRival(null)
    unlockGameAudio()
    useGameStore.getState().prepareRun('solo')
  }, [unlockGameAudio])

  const createRoom = useCallback(async () => {
    unlockGameAudio()
    const code = generateRoomCode()
    const store = useGameStore.getState()
    store.setMode('duel')
    store.setRival(null)
    store.setRoom(code, 'RESERVING ROOM')
    store.setNotice('')
    store.setPhase('lobby')
    setIsHost(true)
    try {
      await createSession().host(code)
      useGameStore.getState().setRoom(code, 'ROOM ONLINE')
    } catch (error) {
      useGameStore.getState().setNotice(error instanceof Error ? error.message : 'The room could not be opened.')
    }
  }, [createSession, unlockGameAudio])

  const joinRoom = useCallback(
    async (requestedCode: string) => {
      unlockGameAudio()
      let code: string
      try {
        code = normalizeRoomCode(requestedCode)
      } catch (error) {
        useGameStore.getState().setNotice(error instanceof Error ? error.message : 'That arena code is invalid.')
        return
      }
      const store = useGameStore.getState()
      store.setMode('duel')
      store.setRival(null)
      store.setRoom(code, 'FINDING ROOM')
      store.setNotice('')
      store.setPhase('lobby')
      setIsHost(false)
      try {
        await createSession().join(code)
        useGameStore.getState().setRoom(code, 'DIRECT LINK STABLE')
      } catch (error) {
        useGameStore.getState().setNotice(error instanceof Error ? error.message : 'The rival room could not be reached.')
      }
    },
    [createSession, unlockGameAudio],
  )

  useEffect(() => {
    if (autoJoinAttempted.current) return
    autoJoinAttempted.current = true
    const inviteCode = new URLSearchParams(window.location.search).get('room')
    if (!inviteCode || !isValidRoomCode(inviteCode)) return
    window.history.replaceState({}, '', window.location.pathname)
    void joinRoom(inviteCode)
  }, [joinRoom])

  useEffect(() => {
    if (phase !== 'countdown') return
    const target = mode === 'duel' && duelStartsAt.current > 0 ? duelStartsAt.current : Date.now() + 3_000
    let previous = -1
    const tick = () => {
      const remaining = Math.max(0, target - Date.now())
      const value = Math.ceil(remaining / 1_000)
      if (value !== previous) {
        previous = value
        useGameStore.getState().setCountdown(value)
        if (value > 0) gameAudio.play('countdown', { pitch: 1 + (3 - Math.min(3, value)) * 0.08 })
      }
      if (remaining > 0) return
      window.clearInterval(timer)
      gameAudio.play('start')
      useGameStore.getState().beginRun()
    }
    const timer = window.setInterval(tick, 50)
    tick()
    return () => window.clearInterval(timer)
  }, [mode, phase])

  useEffect(() => {
    if (phase !== 'results' || !result) return
    const resultKey = `${mode}:${result.score}:${result.bestCombo}:${result.shards}:${result.duration}`
    if (recordedResult.current === resultKey) return
    recordedResult.current = resultKey
    const submission = recordScore({
      name: playerName,
      score: result.score,
      color: playerColor,
      combo: result.bestCombo,
    })
    setLeaderboard(submission.leaderboard)
    sessionRef.current?.send({ type: 'finish', summary: result })
    gameAudio.stopMusic(0.8)
    if (mode === 'solo') gameAudio.play('victory')
    else if (remoteFinishScore.current !== null) {
      gameAudio.play(result.score >= remoteFinishScore.current ? 'victory' : 'defeat')
    }
  }, [mode, phase, playerColor, playerName, result])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.key === 'Escape' || event.key.toLowerCase() === 'p') && !helpOpen) {
        const current = useGameStore.getState().phase
        if (current === 'playing' && useGameStore.getState().mode === 'duel') {
          useGameStore.getState().setNotice('LIVE DUELS CANNOT BE PAUSED')
        } else if (current === 'playing') useGameStore.getState().setPhase('paused')
        else if (current === 'paused') useGameStore.getState().setPhase('playing')
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [helpOpen])

  const togglePause = () => {
    const current = useGameStore.getState().phase
    if (current === 'playing' && useGameStore.getState().mode === 'duel') {
      useGameStore.getState().setNotice('LIVE DUELS CANNOT BE PAUSED')
    } else if (current === 'playing') useGameStore.getState().setPhase('paused')
    else if (current === 'paused') useGameStore.getState().setPhase('playing')
  }

  const openHelp = () => {
    if (useGameStore.getState().phase === 'playing' && useGameStore.getState().mode === 'duel') {
      useGameStore.getState().setNotice('MANUAL LOCKED DURING LIVE DUEL')
      return
    }
    if (useGameStore.getState().phase === 'playing') useGameStore.getState().setPhase('paused')
    setHelpOpen(true)
  }

  const leaveLobby = () => {
    sessionRef.current?.close('Left the arena')
    sessionRef.current = null
    useGameStore.getState().returnToMenu()
  }

  const copyInvite = async (code: string) => {
    const url = new URL(window.location.href)
    url.search = ''
    url.searchParams.set('room', code)
    await navigator.clipboard.writeText(url.toString())
    useGameStore.getState().setNotice('INVITE LINK COPIED')
  }

  const replay = () => {
    recordedResult.current = ''
    unlockGameAudio()
    if (mode === 'solo') {
      useGameStore.getState().prepareRun('solo')
    } else if (sessionRef.current?.snapshot.state !== 'connected' || remoteFinishScore.current === null) {
      useGameStore.getState().setNotice('WAITING FOR THE RIVAL FINAL SIGNAL')
    } else if (isHost) {
      launchDuel()
    } else {
      sessionRef.current?.send({ type: 'rematch', accepted: true })
      useGameStore.getState().setNotice('REMATCH SIGNAL SENT TO HOST')
    }
  }

  const returnToMenu = () => {
    recordedResult.current = ''
    sessionRef.current?.close('Returned to menu')
    sessionRef.current = null
    gameAudio.stopMusic()
    useGameStore.getState().returnToMenu()
  }

  const sendSnapshot = useCallback((snapshot: RivalSnapshot) => {
    sessionRef.current?.send({ type: 'snapshot', snapshot })
  }, [])

  const sendJam = useCallback(() => {
    sessionRef.current?.send({ type: 'jam', firedAt: Date.now() })
  }, [])

  const paused = phase === 'paused'
  const hudVisible = phase === 'playing' || phase === 'paused'

  return (
    <main className={`app app--${phase}`}>
      <div className="scene-shell" aria-hidden="true">
        <Canvas
          shadows={!reducedEffects}
          dpr={reducedEffects ? [0.8, 1.1] : [1, 1.55]}
          camera={{ position: [8, 10, 22], fov: 52, near: 0.1, far: 180 }}
          gl={{ antialias: !reducedEffects, alpha: false, powerPreference: 'high-performance' }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping
            gl.toneMappingExposure = 1.12
            gl.outputColorSpace = THREE.SRGBColorSpace
          }}
        >
          <Suspense fallback={null}>
            <GameScene
              onSnapshot={mode === 'duel' ? sendSnapshot : undefined}
              onPulse={mode === 'duel' ? sendJam : undefined}
              jamSignal={jamSignal}
              matchSeed={matchConfig?.seed}
              matchEndsAt={matchConfig ? matchConfig.startsAt + matchConfig.duration * 1_000 : undefined}
            />
            <SceneEffects reduced={reducedEffects} />
          </Suspense>
        </Canvas>
      </div>

      <div className="scanlines" aria-hidden="true" />
      <div className="corner-frame corner-frame--top" aria-hidden="true" />
      <div className="corner-frame corner-frame--bottom" aria-hidden="true" />

      {phase === 'menu' ? (
        <MainMenu
          playerName={playerName}
          playerColor={playerColor}
          soundEnabled={soundEnabled}
          reducedEffects={reducedEffects}
          notice={notice}
          onNameChange={(name) => useGameStore.getState().setPlayerName(name)}
          onColorChange={(color) => useGameStore.getState().setPlayerColor(color)}
          onPlaySolo={playSolo}
          onCreateRoom={() => void createRoom()}
          onJoinRoom={(code) => void joinRoom(code)}
          onToggleSound={() => useGameStore.getState().toggleSound()}
          onToggleReducedEffects={() => useGameStore.getState().toggleReducedEffects()}
          onOpenHelp={openHelp}
        />
      ) : null}

      {phase === 'lobby' ? (
        <Lobby
          playerName={playerName}
          playerColor={playerColor}
          roomCode={roomCode}
          networkStatus={networkStatus}
          rival={rival}
          isHost={isHost}
          canStart={Boolean(rival && sessionRef.current?.snapshot.state === 'connected')}
          notice={notice}
          onCopyRoomCode={copyInvite}
          onStartMatch={launchDuel}
          onLeaveLobby={leaveLobby}
        />
      ) : null}

      {phase === 'countdown' ? <CountdownOverlay count={countdown} /> : null}

      {hudVisible ? (
        <HUD
          mode={mode}
          score={score}
          combo={combo}
          multiplier={multiplier}
          comboTime={comboTime}
          charge={charge}
          shields={shields}
          timeLeft={timeLeft}
          wave={wave}
          objective={objective}
          objectiveProgress={objectiveProgress}
          objectiveTarget={objectiveTarget}
          rival={rival}
          soundEnabled={soundEnabled}
          paused={paused}
          notice={notice}
          onPauseToggle={togglePause}
          onToggleSound={() => useGameStore.getState().toggleSound()}
          onOpenHelp={openHelp}
        />
      ) : null}

      {phase === 'results' && result ? (
        <ResultsScreen
          result={result}
          mode={mode}
          playerName={playerName}
          playerColor={playerColor}
          leaderboard={leaderboard}
          onPlayAgain={replay}
          onMainMenu={returnToMenu}
        />
      ) : null}

      <MobileControls visible={phase === 'playing'} />
      <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} />

      {booting ? (
        <div className="boot-screen" role="status">
          <div className="boot-screen__cube" aria-hidden="true"><span /></div>
          <strong>ELECTROCUBE</strong>
          <span>CALIBRATING NEON CORE</span>
          <div className="boot-screen__bar"><i /></div>
        </div>
      ) : null}
    </main>
  )
}

export default App
