import type { CubeColor } from './types'

export const RUN_DURATION = 90
export const ARENA_RADIUS = 34
export const MAX_CHARGE = 100
export const MAX_SHIELDS = 3

export const CUBE_COLORS: Record<CubeColor, { primary: string; secondary: string; label: string }> = {
  cyan: { primary: '#00f6ff', secondary: '#4b6cff', label: 'Ion cyan' },
  magenta: { primary: '#ff2bd6', secondary: '#7c3cff', label: 'Nova pink' },
  violet: { primary: '#985dff', secondary: '#2ed8ff', label: 'Void violet' },
  lime: { primary: '#a8ff36', secondary: '#00e6a7', label: 'Flux lime' },
  amber: { primary: '#ffba38', secondary: '#ff4d6d', label: 'Solar amber' },
}

export const PICKUP_COLORS = ['#00f6ff', '#ff2bd6', '#a8ff36', '#ffba38'] as const

export const BOT_NAMES = [
  'NOVA//KID',
  'VOIDRUNNER',
  'PIXEL WRAITH',
  'KIRA_404',
  'NEON NOMAD',
  'ARC ANGEL',
  'GHOST VOLT',
  'CUBE ZERO',
]

export const KEY_BINDINGS = {
  movement: ['WASD', 'ARROWS'],
  dash: ['SHIFT'],
  pulse: ['SPACE'],
  pause: ['ESC'],
} as const

