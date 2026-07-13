export type GamePhase = 'menu' | 'lobby' | 'countdown' | 'playing' | 'paused' | 'results'
export type GameMode = 'solo' | 'bot' | 'duel'

export type CubeColor = 'cyan' | 'magenta' | 'violet' | 'lime' | 'amber'

export interface VectorSnapshot {
  x: number
  y: number
  z: number
}

export interface RivalSnapshot {
  name: string
  color: CubeColor
  score: number
  combo: number
  charge: number
  shields: number
  position: VectorSnapshot
  rotationY: number
  updatedAt: number
}

export interface RunSummary {
  score: number
  bestCombo: number
  shards: number
  drones: number
  banks: number
  duration: number
  won?: boolean
}

export interface LeaderboardEntry {
  id: string
  name: string
  score: number
  color: CubeColor
  combo: number
  createdAt: number
  isPlayer?: boolean
}

export interface HudUpdate {
  score?: number
  combo?: number
  multiplier?: number
  comboTime?: number
  charge?: number
  dashCooldown?: number
  shields?: number
  timeLeft?: number
  wave?: number
  objective?: string
  objectiveProgress?: number
  objectiveTarget?: number
  rival?: RivalSnapshot | null
}

export interface GameResultPayload extends RunSummary {
  mode: GameMode
}
