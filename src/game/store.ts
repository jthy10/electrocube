import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { MAX_SHIELDS, RUN_DURATION } from './constants'
import type {
  CubeColor,
  GameMode,
  GamePhase,
  GameResultPayload,
  HudUpdate,
  RivalSnapshot,
  RunSummary,
} from './types'

interface GameStore {
  phase: GamePhase
  mode: GameMode
  playerName: string
  playerColor: CubeColor
  soundEnabled: boolean
  reducedEffects: boolean
  score: number
  combo: number
  multiplier: number
  comboTime: number
  charge: number
  shields: number
  timeLeft: number
  wave: number
  objective: string
  objectiveProgress: number
  objectiveTarget: number
  rival: RivalSnapshot | null
  roomCode: string
  networkStatus: string
  result: RunSummary | null
  countdown: number
  notice: string
  setPlayerName: (name: string) => void
  setPlayerColor: (color: CubeColor) => void
  toggleSound: () => void
  toggleReducedEffects: () => void
  setPhase: (phase: GamePhase) => void
  setMode: (mode: GameMode) => void
  setRoom: (roomCode: string, status?: string) => void
  setNetworkStatus: (status: string) => void
  setCountdown: (countdown: number) => void
  setNotice: (notice: string) => void
  updateHud: (update: HudUpdate) => void
  setRival: (rival: RivalSnapshot | null) => void
  prepareRun: (mode: GameMode) => void
  beginRun: () => void
  finishRun: (payload: GameResultPayload) => void
  returnToMenu: () => void
}

const cleanName = (name: string) =>
  name
    .toUpperCase()
    .replace(/[^A-Z0-9_\- ]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 14)

export const useGameStore = create<GameStore>()(
  persist(
    (set) => ({
      phase: 'menu',
      mode: 'solo',
      playerName: 'ROOKIE',
      playerColor: 'cyan',
      soundEnabled: true,
      reducedEffects: false,
      score: 0,
      combo: 0,
      multiplier: 1,
      comboTime: 0,
      charge: 0,
      shields: MAX_SHIELDS,
      timeLeft: RUN_DURATION,
      wave: 1,
      objective: 'Collect charge shards',
      objectiveProgress: 0,
      objectiveTarget: 8,
      rival: null,
      roomCode: '',
      networkStatus: 'OFFLINE',
      result: null,
      countdown: 3,
      notice: '',
      setPlayerName: (playerName) => set({ playerName: cleanName(playerName) || 'ROOKIE' }),
      setPlayerColor: (playerColor) => set({ playerColor }),
      toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),
      toggleReducedEffects: () => set((state) => ({ reducedEffects: !state.reducedEffects })),
      setPhase: (phase) => set({ phase }),
      setMode: (mode) => set({ mode }),
      setRoom: (roomCode, networkStatus = 'READY') => set({ roomCode, networkStatus }),
      setNetworkStatus: (networkStatus) => set({ networkStatus }),
      setCountdown: (countdown) => set({ countdown }),
      setNotice: (notice) => set({ notice }),
      updateHud: (update) => set(update),
      setRival: (rival) => set({ rival }),
      prepareRun: (mode) =>
        set({
          phase: 'countdown',
          mode,
          score: 0,
          combo: 0,
          multiplier: 1,
          comboTime: 0,
          charge: 0,
          shields: MAX_SHIELDS,
          timeLeft: RUN_DURATION,
          wave: 1,
          objective: 'Collect charge shards',
          objectiveProgress: 0,
          objectiveTarget: 8,
          result: null,
          countdown: 3,
          notice: '',
        }),
      beginRun: () => set({ phase: 'playing', countdown: 0 }),
      finishRun: (payload) => set({ phase: 'results', result: payload, timeLeft: 0 }),
      returnToMenu: () =>
        set({
          phase: 'menu',
          mode: 'solo',
          rival: null,
          roomCode: '',
          networkStatus: 'OFFLINE',
          notice: '',
        }),
    }),
    {
      name: 'electrocube-profile-v1',
      partialize: (state) => ({
        playerName: state.playerName,
        playerColor: state.playerColor,
        soundEnabled: state.soundEnabled,
        reducedEffects: state.reducedEffects,
      }),
    },
  ),
)
