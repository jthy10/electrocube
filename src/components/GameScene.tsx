import { useEffect, useMemo, useRef, useState } from 'react'
import { Float, RoundedBox } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { ARENA_RADIUS, CUBE_COLORS, MAX_CHARGE, MAX_SHIELDS, PICKUP_COLORS, RUN_DURATION } from '../game/constants'
import { gameAudio } from '../game/audio'
import { isVirtualControlDown } from '../game/input'
import { useGameStore } from '../game/store'
import type { RivalSnapshot } from '../game/types'
import { Arena } from './Arena'

interface Pickup {
  id: number
  position: [number, number, number]
  color: (typeof PICKUP_COLORS)[number]
  scale: number
}

interface Hunter {
  id: number
  position: THREE.Vector3
  velocity: THREE.Vector3
  alive: boolean
  respawnAt: number
  phase: number
}

interface BurstData {
  id: number
  position: [number, number, number]
  color: string
  large?: boolean
}

interface RunStats {
  score: number
  combo: number
  bestCombo: number
  comboClock: number
  multiplier: number
  charge: number
  shields: number
  timeLeft: number
  wave: number
  objectiveProgress: number
  objectiveTarget: number
  shards: number
  drones: number
  banks: number
}

export interface GameSceneProps {
  onSnapshot?: (snapshot: RivalSnapshot) => void
  onPulse?: () => void
  jamSignal?: number
  matchSeed?: number
  matchEndsAt?: number
}

const zeroRunStats = (): RunStats => ({
  score: 0,
  combo: 0,
  bestCombo: 0,
  comboClock: 0,
  multiplier: 1,
  charge: 0,
  shields: MAX_SHIELDS,
  timeLeft: RUN_DURATION,
  wave: 1,
  objectiveProgress: 0,
  objectiveTarget: 8,
  shards: 0,
  drones: 0,
  banks: 0,
})

const seededRandom = (seed: number) => {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let result = value
    result = Math.imul(result ^ (result >>> 15), result | 1)
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61)
    return ((result ^ (result >>> 14)) >>> 0) / 4_294_967_296
  }
}

const arenaPoint = (random: () => number, padding = 5): [number, number, number] => {
  const angle = random() * Math.PI * 2
  const radius = 5 + Math.sqrt(random()) * (ARENA_RADIUS - padding - 5)
  return [Math.cos(angle) * radius, 0.95 + random() * 0.45, Math.sin(angle) * radius]
}

const makePickups = (seed: number): Pickup[] => {
  const random = seededRandom(seed)
  return Array.from({ length: 15 }, (_, id) => ({
    id,
    position: arenaPoint(random),
    color: PICKUP_COLORS[id % PICKUP_COLORS.length],
    scale: 0.72 + random() * 0.32,
  }))
}

const makeHunters = (seed: number): Hunter[] => {
  const random = seededRandom(seed * 17 + 41)
  return Array.from({ length: 5 }, (_, id) => {
    const [x, , z] = arenaPoint(random, 2)
    return {
      id,
      position: new THREE.Vector3(x, 1.25, z),
      velocity: new THREE.Vector3(),
      alive: id < 2,
      respawnAt: id < 2 ? 0 : 8 + id * 7,
      phase: random() * Math.PI * 2,
    }
  })
}

function PickupCrystal({ pickup }: { pickup: Pickup }) {
  const group = useRef<THREE.Group>(null)

  useFrame(({ clock }, delta) => {
    if (!group.current) return
    group.current.rotation.y += delta * 1.8
    group.current.rotation.x = Math.sin(clock.elapsedTime * 1.8 + pickup.id) * 0.22
    group.current.position.y = pickup.position[1] + Math.sin(clock.elapsedTime * 2.4 + pickup.id) * 0.22
  })

  return (
    <group ref={group} position={pickup.position} scale={pickup.scale}>
      <mesh castShadow>
        <octahedronGeometry args={[0.58, 0]} />
        <meshStandardMaterial
          color={pickup.color}
          emissive={pickup.color}
          emissiveIntensity={4.5}
          roughness={0.12}
          metalness={0.45}
          toneMapped={false}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.92, 0.025, 6, 42]} />
        <meshBasicMaterial color={pickup.color} transparent opacity={0.62} toneMapped={false} />
      </mesh>
      <pointLight color={pickup.color} intensity={2.4} distance={4.5} decay={2} />
    </group>
  )
}

function ParticleBurst({ burst, onComplete }: { burst: BurstData; onComplete: (id: number) => void }) {
  const points = useRef<THREE.Points>(null)
  const material = useRef<THREE.PointsMaterial>(null)
  const age = useRef(0)
  const directions = useMemo(() => {
    const random = seededRandom(burst.id * 97 + 13)
    const count = burst.large ? 42 : 20
    const values = new Float32Array(count * 3)
    for (let index = 0; index < count; index += 1) {
      const vector = new THREE.Vector3(random() * 2 - 1, random() * 1.3 - 0.15, random() * 2 - 1)
        .normalize()
        .multiplyScalar(0.6 + random() * 1.6)
      values[index * 3] = vector.x
      values[index * 3 + 1] = vector.y
      values[index * 3 + 2] = vector.z
    }
    return values
  }, [burst.id, burst.large])

  useFrame((_, delta) => {
    age.current += delta
    if (points.current) {
      const scale = 0.15 + age.current * (burst.large ? 6.8 : 4.2)
      points.current.scale.setScalar(scale)
      points.current.rotation.y += delta * 1.4
    }
    if (material.current) material.current.opacity = Math.max(0, 1 - age.current / 0.72)
    if (age.current > 0.75) onComplete(burst.id)
  })

  return (
    <points ref={points} position={burst.position}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[directions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={material}
        color={burst.color}
        size={burst.large ? 0.2 : 0.13}
        sizeAttenuation
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  )
}

function PulseWave({ id, color, position, onComplete }: { id: number; color: string; position: THREE.Vector3; onComplete: () => void }) {
  const ring = useRef<THREE.Mesh>(null)
  const material = useRef<THREE.MeshBasicMaterial>(null)
  const age = useRef(0)

  useFrame((_, delta) => {
    age.current += delta
    const progress = age.current / 0.75
    if (ring.current) ring.current.scale.setScalar(0.5 + progress * 16)
    if (material.current) material.current.opacity = Math.max(0, 0.85 * (1 - progress))
    if (progress >= 1) onComplete()
  })

  return (
    <mesh key={id} ref={ring} position={[position.x, 0.22, position.z]} rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.82, 1, 64]} />
      <meshBasicMaterial ref={material} color={color} transparent side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

function RivalCube({ rival }: { rival: RivalSnapshot }) {
  const group = useRef<THREE.Group>(null)
  const target = useRef(new THREE.Vector3(rival.position.x, rival.position.y, rival.position.z))
  const palette = CUBE_COLORS[rival.color]

  useFrame(({ clock }, delta) => {
    if (!group.current) return
    target.current.set(rival.position.x, rival.position.y, rival.position.z)
    group.current.position.lerp(target.current, 1 - Math.exp(-delta * 9))
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, rival.rotationY, 1 - Math.exp(-delta * 7))
    group.current.position.y += Math.sin(clock.elapsedTime * 5) * 0.002
  })

  return (
    <group ref={group} position={[rival.position.x, rival.position.y, rival.position.z]}>
      <RoundedBox args={[1.35, 1.35, 1.35]} radius={0.2} smoothness={3}>
        <meshStandardMaterial
          color="#10102a"
          emissive={palette.primary}
          emissiveIntensity={1.4}
          transparent
          opacity={0.72}
          roughness={0.18}
          metalness={0.8}
        />
      </RoundedBox>
      <mesh scale={0.52}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color={palette.primary} transparent opacity={0.86} toneMapped={false} />
      </mesh>
      <pointLight color={palette.primary} intensity={3} distance={7} />
    </group>
  )
}

function LaserSweep({ active }: { active: boolean }) {
  const group = useRef<THREE.Group>(null)
  const material = useRef<THREE.MeshBasicMaterial>(null)

  useFrame(({ clock }) => {
    if (!group.current) return
    const speed = 0.36 + useGameStore.getState().wave * 0.035
    group.current.rotation.y = -clock.elapsedTime * speed
    if (material.current) {
      material.current.opacity = active ? 0.58 + Math.sin(clock.elapsedTime * 8) * 0.14 : 0.18
    }
  })

  return (
    <group ref={group}>
      <mesh position={[0, 0.32, 0]}>
        <boxGeometry args={[ARENA_RADIUS * 2 - 7, 0.1, 0.16]} />
        <meshBasicMaterial
          ref={material}
          color="#ff245f"
          transparent
          opacity={active ? 0.72 : 0.18}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[ARENA_RADIUS - 3.5, 0.68, 0]}>
        <sphereGeometry args={[0.34, 12, 12]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
    </group>
  )
}

function GameWorld({ onSnapshot, onPulse, jamSignal = 0, matchSeed, matchEndsAt }: GameSceneProps) {
  const phase = useGameStore((state) => state.phase)
  const mode = useGameStore((state) => state.mode)
  const playerName = useGameStore((state) => state.playerName)
  const playerColor = useGameStore((state) => state.playerColor)
  const reducedEffects = useGameStore((state) => state.reducedEffects)
  const rival = useGameStore((state) => state.rival)
  const palette = CUBE_COLORS[playerColor]
  const { camera } = useThree()
  const player = useRef<THREE.Group>(null)
  const playerShell = useRef<THREE.Group>(null)
  const trailRefs = useRef<Array<THREE.Mesh | null>>([])
  const hunterRefs = useRef(new Map<number, THREE.Group>())
  const keys = useRef(new Set<string>())
  const pulseWasDown = useRef(false)
  const dashWasDown = useRef(false)
  const playerPosition = useRef(new THREE.Vector3(0, 1.05, 8))
  const velocity = useRef(new THREE.Vector3())
  const lookDirection = useRef(new THREE.Vector3(0, 0, -1))
  const cameraTarget = useRef(new THREE.Vector3())
  const stats = useRef<RunStats>(zeroRunStats())
  const seed = useRef(Math.floor(Date.now() / 86_400_000) + 8088)
  const hunters = useRef<Hunter[]>(makeHunters(seed.current))
  const lastHudUpdate = useRef(0)
  const lastSnapshotAt = useRef(0)
  const damageCooldown = useRef(0)
  const dashCooldown = useRef(0)
  const dashClock = useRef(0)
  const dashDirection = useRef(new THREE.Vector3(0, 0, -1))
  const runFinished = useRef(false)
  const lastJam = useRef(jamSignal)
  const noticeTimer = useRef<number | null>(null)
  const burstId = useRef(1)
  const pulseId = useRef(0)
  const gateCooldowns = useRef([0, 0, 0, 0])
  const [pickups, setPickups] = useState(() => makePickups(seed.current))
  const [bursts, setBursts] = useState<BurstData[]>([])
  const [activePulse, setActivePulse] = useState<{ id: number; position: THREE.Vector3 } | null>(null)

  const setTimedNotice = (message: string, duration = 1_400) => {
    useGameStore.getState().setNotice(message)
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => {
      useGameStore.getState().setNotice('')
      noticeTimer.current = null
    }, duration)
  }

  const addBurst = (position: THREE.Vector3 | [number, number, number], color: string, large = false) => {
    const tuple: [number, number, number] = Array.isArray(position)
      ? position
      : [position.x, position.y, position.z]
    const burst: BurstData = { id: burstId.current++, position: tuple, color, large }
    setBursts((current) => [...current.slice(-12), burst])
  }

  const applyDamage = (source: THREE.Vector3, label: string) => {
    if (damageCooldown.current > 0 || phase !== 'playing') return
    damageCooldown.current = 1.35
    const current = stats.current
    current.shields = Math.max(0, current.shields - 1)
    current.combo = 0
    current.comboClock = 0
    current.multiplier = 1
    current.score = Math.max(0, current.score - 250)
    const push = playerPosition.current.clone().sub(source).setY(0).normalize().multiplyScalar(15)
    velocity.current.add(push)
    addBurst(playerPosition.current, '#ff356e', true)
    gameAudio.play('hit')
    setTimedNotice(`${label} // -250 SIGNAL`)

    if (current.shields === 0) {
      current.shields = MAX_SHIELDS
      current.score = Math.max(0, current.score - 750)
      playerPosition.current.set(0, 1.05, 8)
      velocity.current.set(0, 0, 0)
      gameAudio.play('shield')
      setTimedNotice('CORE REBOOT // -750 SIGNAL', 1_800)
    }
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      keys.current.add(key)
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key) && phase === 'playing') {
        event.preventDefault()
      }
    }
    const onKeyUp = (event: KeyboardEvent) => keys.current.delete(event.key.toLowerCase())
    const onBlur = () => keys.current.clear()
    window.addEventListener('keydown', onKeyDown, { passive: false })
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [phase])

  useEffect(() => {
    if (phase !== 'countdown') return
    seed.current = mode === 'duel' && matchSeed ? matchSeed : Math.floor(Date.now() / 86_400_000) + 8_088
    stats.current = zeroRunStats()
    hunters.current = makeHunters(seed.current)
    setPickups(makePickups(seed.current))
    setBursts([])
    setActivePulse(null)
    playerPosition.current.set(0, 1.05, 8)
    velocity.current.set(0, 0, 0)
    dashCooldown.current = 0
    dashClock.current = 0
    damageCooldown.current = 0
    runFinished.current = false
    gateCooldowns.current.fill(0)
    useGameStore.getState().updateHud({
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
    })
  }, [matchSeed, mode, phase])

  useEffect(() => {
    if (lastJam.current === jamSignal) return
    lastJam.current = jamSignal
    if (phase === 'playing') applyDamage(new THREE.Vector3(0, 1, 0), 'RIVAL JAM')
    // applyDamage intentionally uses the current run refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jamSignal])

  useEffect(
    () => () => {
      if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current)
    },
    [],
  )

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05)
    const elapsed = clock.elapsedTime
    const current = stats.current
    const isPlaying = phase === 'playing'

    if (!isPlaying) {
      if (phase === 'menu' || phase === 'lobby' || phase === 'results') {
        playerPosition.current.x = Math.sin(elapsed * 0.36) * 2.1
        playerPosition.current.z = 7 + Math.cos(elapsed * 0.36) * 1.2
        playerPosition.current.y = 1.3 + Math.sin(elapsed * 1.5) * 0.16
        if (playerShell.current) {
          playerShell.current.rotation.y += dt * 0.55
          playerShell.current.rotation.x = Math.sin(elapsed * 0.8) * 0.12
        }
      }
    } else {
      current.timeLeft = mode === 'duel' && matchEndsAt
        ? Math.max(0, (matchEndsAt - Date.now()) / 1_000)
        : Math.max(0, current.timeLeft - dt)
      current.comboClock = Math.max(0, current.comboClock - dt)
      damageCooldown.current = Math.max(0, damageCooldown.current - dt)
      dashCooldown.current = Math.max(0, dashCooldown.current - dt)
      dashClock.current = Math.max(0, dashClock.current - dt)
      gateCooldowns.current = gateCooldowns.current.map((value) => Math.max(0, value - dt))

      if (current.comboClock === 0 && current.combo > 0) {
        current.combo = 0
        current.multiplier = 1
      }

      const horizontal = Number(keys.current.has('d') || keys.current.has('arrowright') || isVirtualControlDown('right')) - Number(keys.current.has('a') || keys.current.has('arrowleft') || isVirtualControlDown('left'))
      const vertical = Number(keys.current.has('s') || keys.current.has('arrowdown') || isVirtualControlDown('down')) - Number(keys.current.has('w') || keys.current.has('arrowup') || isVirtualControlDown('up'))
      const input = new THREE.Vector3(horizontal, 0, vertical)
      if (input.lengthSq() > 0) {
        input.normalize()
        lookDirection.current.lerp(input, 1 - Math.exp(-dt * 12)).normalize()
      }

      const dashDown = keys.current.has('shift') || isVirtualControlDown('dash')
      if (dashDown && !dashWasDown.current && dashCooldown.current <= 0) {
        dashClock.current = 0.22
        dashCooldown.current = 1.05
        dashDirection.current.copy(input.lengthSq() > 0 ? input : lookDirection.current).normalize()
        addBurst(playerPosition.current, palette.primary, false)
        gameAudio.play('dash')
      }
      dashWasDown.current = dashDown

      if (dashClock.current > 0) {
        velocity.current.lerp(dashDirection.current.clone().multiplyScalar(31), 1 - Math.exp(-dt * 24))
      } else {
        const targetVelocity = input.multiplyScalar(12.5)
        velocity.current.lerp(targetVelocity, 1 - Math.exp(-dt * (targetVelocity.lengthSq() > 0 ? 9 : 5.5)))
      }

      playerPosition.current.addScaledVector(velocity.current, dt)
      const radial = Math.hypot(playerPosition.current.x, playerPosition.current.z)
      if (radial > ARENA_RADIUS - 1.3) {
        const normal = new THREE.Vector3(playerPosition.current.x, 0, playerPosition.current.z).normalize()
        playerPosition.current.x = normal.x * (ARENA_RADIUS - 1.3)
        playerPosition.current.z = normal.z * (ARENA_RADIUS - 1.3)
        velocity.current.reflect(normal).multiplyScalar(0.46)
        applyDamage(normal.multiplyScalar(ARENA_RADIUS), 'VOID WALL')
      }
      playerPosition.current.y = 1.05 + Math.sin(elapsed * 8) * 0.055

      const pulseDown = keys.current.has(' ') || isVirtualControlDown('pulse')
      if (pulseDown && !pulseWasDown.current) {
        if (current.charge >= MAX_CHARGE) {
          current.charge = 0
          pulseId.current += 1
          setActivePulse({ id: pulseId.current, position: playerPosition.current.clone() })
          addBurst(playerPosition.current, palette.primary, true)
          let disabled = 0
          hunters.current.forEach((hunter) => {
            if (!hunter.alive || hunter.position.distanceTo(playerPosition.current) > 16) return
            hunter.alive = false
            hunter.respawnAt = elapsed + 4.5
            disabled += 1
          })
          current.drones += disabled
          current.score += disabled * 420 + 300
          gameAudio.play('pulse')
          setTimedNotice(`OVERDRIVE PULSE // ${disabled} HUNTERS ERASED`, 1_700)
          onPulse?.()
        } else {
          setTimedNotice(`PULSE CHARGING // ${Math.floor(current.charge)}%`, 850)
        }
      }
      pulseWasDown.current = pulseDown

      const pickupRadiusSq = dashClock.current > 0 ? 4.2 : 2.65
      pickups.forEach((pickup) => {
        const dx = pickup.position[0] - playerPosition.current.x
        const dz = pickup.position[2] - playerPosition.current.z
        if (dx * dx + dz * dz > pickupRadiusSq) return

        const base = 100 + Math.min(300, current.combo * 12)
        current.combo += 1
        current.bestCombo = Math.max(current.bestCombo, current.combo)
        current.comboClock = 3.25
        current.multiplier = Math.min(5, 1 + Math.floor(current.combo / 4) * 0.5)
        current.score += Math.round(base * current.multiplier)
        current.charge = Math.min(MAX_CHARGE, current.charge + 9 + current.combo * 0.28)
        current.shards += 1
        current.objectiveProgress = Math.min(current.objectiveTarget, current.objectiveProgress + 1)
        addBurst(pickup.position, pickup.color, current.combo % 4 === 0)
        gameAudio.play(current.combo % 4 === 0 ? 'combo' : 'collect', { pitch: 0.88 + Math.min(0.5, current.combo * 0.025) })

        if (current.objectiveProgress >= current.objectiveTarget) {
          setTimedNotice('CIRCUIT READY // RETURN TO REACTOR', 1_350)
        }

        const random = seededRandom(seed.current + pickup.id * 211 + current.shards * 997)
        setPickups((all) =>
          all.map((item) =>
            item.id === pickup.id
              ? { ...item, position: arenaPoint(random), color: PICKUP_COLORS[(current.shards + item.id) % PICKUP_COLORS.length] }
              : item,
          ),
        )
      })

      if (current.objectiveProgress >= current.objectiveTarget && playerPosition.current.lengthSq() < 24) {
        const bankBonus = Math.round((1_000 + current.wave * 350) * current.multiplier)
        current.score += bankBonus
        current.banks += 1
        current.wave += 1
        current.objectiveProgress = 0
        current.objectiveTarget = Math.min(15, 7 + current.wave)
        current.shields = Math.min(MAX_SHIELDS, current.shields + 1)
        current.charge = Math.min(MAX_CHARGE, current.charge + 18)
        addBurst(playerPosition.current, '#ffffff', true)
        gameAudio.play('bank')
        setTimedNotice(`CIRCUIT BANKED // +${bankBonus.toLocaleString()}`, 1_700)
      }

      const intensity = Math.min(1, 0.2 + current.wave * 0.12 + (RUN_DURATION - current.timeLeft) / RUN_DURATION * 0.35)
      gameAudio.setMusicIntensity(intensity)

      hunters.current.forEach((hunter, index) => {
        const visual = hunterRefs.current.get(hunter.id)
        if (!hunter.alive && elapsed >= hunter.respawnAt) {
          const angle = hunter.phase + elapsed * 0.17
          hunter.position.set(Math.cos(angle) * (ARENA_RADIUS - 3), 1.2, Math.sin(angle) * (ARENA_RADIUS - 3))
          hunter.velocity.set(0, 0, 0)
          hunter.alive = index < Math.min(5, 1 + current.wave)
        }
        if (!hunter.alive) {
          if (visual) visual.visible = false
          return
        }

        const desired = playerPosition.current.clone().sub(hunter.position).setY(0).normalize()
        const orbit = new THREE.Vector3(-desired.z, 0, desired.x).multiplyScalar(Math.sin(elapsed * 1.7 + hunter.phase) * 1.1)
        desired.add(orbit).normalize().multiplyScalar(4.1 + current.wave * 0.48 + index * 0.22)
        hunter.velocity.lerp(desired, 1 - Math.exp(-dt * 2.2))
        hunter.position.addScaledVector(hunter.velocity, dt)
        hunter.position.y = 1.15 + Math.sin(elapsed * 4 + hunter.phase) * 0.18

        if (visual) {
          visual.visible = true
          visual.position.copy(hunter.position)
          visual.rotation.y += dt * (1.2 + index * 0.18)
          visual.rotation.z = Math.sin(elapsed * 2 + hunter.phase) * 0.24
        }

        if (hunter.position.distanceToSquared(playerPosition.current) < 2.4) applyDamage(hunter.position, 'HUNTER IMPACT')
      })

      const laserAngle = elapsed * (0.36 + current.wave * 0.035)
      const lineDistance = Math.abs(playerPosition.current.x * Math.sin(laserAngle) - playerPosition.current.z * Math.cos(laserAngle))
      const playerRadius = Math.hypot(playerPosition.current.x, playerPosition.current.z)
      if (lineDistance < 0.66 && playerRadius > 5 && playerRadius < ARENA_RADIUS - 3) {
        applyDamage(new THREE.Vector3(-Math.sin(laserAngle), 0, Math.cos(laserAngle)), 'SWEEP LASER')
      }

      const gates: Array<[number, number]> = [[0, -27], [27, 0], [0, 27], [-27, 0]]
      gates.forEach(([x, z], index) => {
        if (gateCooldowns.current[index] > 0) return
        const distanceSq = (playerPosition.current.x - x) ** 2 + (playerPosition.current.z - z) ** 2
        if (distanceSq > 7) return
        gateCooldowns.current[index] = 4
        velocity.current.multiplyScalar(1.55)
        current.score += Math.round(225 * current.multiplier)
        current.charge = Math.min(MAX_CHARGE, current.charge + 8)
        addBurst(new THREE.Vector3(x, 1, z), PICKUP_COLORS[index], true)
        gameAudio.play('dash', { pitch: 1.25 })
        setTimedNotice('VOLT GATE // SPEED + SIGNAL', 1_100)
      })

      if (current.timeLeft <= 0 && !runFinished.current) {
        runFinished.current = true
        const opponentScore = useGameStore.getState().rival?.score ?? 0
        useGameStore.getState().finishRun({
          mode,
          score: current.score,
          bestCombo: current.bestCombo,
          shards: current.shards,
          drones: current.drones,
          banks: current.banks,
          duration: RUN_DURATION,
          won: mode === 'duel' ? current.score >= opponentScore : undefined,
        })
      }
    }

    if (player.current) player.current.position.copy(playerPosition.current)
    if (playerShell.current) {
      const speed = velocity.current.length()
      playerShell.current.rotation.z = THREE.MathUtils.lerp(playerShell.current.rotation.z, -velocity.current.x * 0.026, 1 - Math.exp(-dt * 9))
      playerShell.current.rotation.x = THREE.MathUtils.lerp(playerShell.current.rotation.x, velocity.current.z * 0.026, 1 - Math.exp(-dt * 9))
      playerShell.current.rotation.y += dt * (0.28 + speed * 0.045)
      const stretch = dashClock.current > 0 ? 1.28 : 1
      playerShell.current.scale.lerp(new THREE.Vector3(1, 1, stretch), 1 - Math.exp(-dt * 16))
    }

    let trailTarget = playerPosition.current
    trailRefs.current.forEach((mesh, index) => {
      if (!mesh) return
      const follow = index === 0 ? 0.2 : 0.14
      mesh.position.lerp(trailTarget, 1 - Math.exp(-dt * (follow * 60)))
      mesh.position.y -= 0.02 * (index + 1)
      const trailScale = (1 - index * 0.16) * (dashClock.current > 0 ? 0.84 : 0.5)
      mesh.scale.setScalar(Math.max(0.14, trailScale))
      trailTarget = mesh.position
    })

    const playCamera = phase === 'playing' || phase === 'countdown' || phase === 'paused'
    cameraTarget.current.set(
      playerPosition.current.x + (playCamera ? 0 : 6.5),
      playerPosition.current.y + (playCamera ? 15 : 8.5),
      playerPosition.current.z + (playCamera ? 19 : 15),
    )
    camera.position.lerp(cameraTarget.current, 1 - Math.exp(-dt * (playCamera ? 4.2 : 1.8)))
    camera.lookAt(
      playerPosition.current.x,
      playCamera ? 0.5 : 1.4,
      playerPosition.current.z - (playCamera ? 4.4 : 1),
    )

    if (isPlaying && elapsed - lastHudUpdate.current > 0.05) {
      lastHudUpdate.current = elapsed
      useGameStore.getState().updateHud({
        score: current.score,
        combo: current.combo,
        multiplier: current.multiplier,
        comboTime: (current.comboClock / 3.25) * 100,
        charge: current.charge,
        shields: current.shields,
        timeLeft: current.timeLeft,
        wave: current.wave,
        objective:
          current.objectiveProgress >= current.objectiveTarget
            ? 'Return to the central reactor to bank'
            : current.charge >= MAX_CHARGE
              ? 'Press SPACE to unleash Overdrive'
              : 'Collect charge shards',
        objectiveProgress: current.objectiveProgress,
        objectiveTarget: current.objectiveTarget,
      })
    }

    if (isPlaying && onSnapshot && elapsed - lastSnapshotAt.current > 0.09) {
      lastSnapshotAt.current = elapsed
      onSnapshot({
        name: playerName,
        color: playerColor,
        score: current.score,
        combo: current.combo,
        charge: current.charge,
        shields: current.shields,
        position: { x: playerPosition.current.x, y: playerPosition.current.y, z: playerPosition.current.z },
        rotationY: playerShell.current?.rotation.y ?? 0,
        updatedAt: Date.now(),
      })
    }
  })

  return (
    <>
      <Arena reducedEffects={reducedEffects} />

      {pickups.map((pickup) => (
        <PickupCrystal key={pickup.id} pickup={pickup} />
      ))}

      <group rotation={[0, 0, 0]}>
        {[0, 1, 2, 3].map((index) => {
          const positions: Array<[number, number, number]> = [[0, 1.25, -27], [27, 1.25, 0], [0, 1.25, 27], [-27, 1.25, 0]]
          const rotations = [0, Math.PI / 2, 0, Math.PI / 2]
          return (
            <group key={index} position={positions[index]} rotation={[0, rotations[index], 0]}>
              <mesh>
                <torusGeometry args={[2.1, 0.16, 8, 56]} />
                <meshStandardMaterial color={PICKUP_COLORS[index]} emissive={PICKUP_COLORS[index]} emissiveIntensity={3.5} toneMapped={false} />
              </mesh>
              <mesh scale={0.72}>
                <torusGeometry args={[2.1, 0.025, 6, 48]} />
                <meshBasicMaterial color="#ffffff" transparent opacity={0.75} toneMapped={false} />
              </mesh>
              <pointLight color={PICKUP_COLORS[index]} intensity={2.2} distance={8} />
            </group>
          )
        })}
      </group>

      <LaserSweep active={phase === 'playing'} />

      {hunters.current.map((hunter) => (
        <group
          key={hunter.id}
          ref={(node) => {
            if (node) hunterRefs.current.set(hunter.id, node)
            else hunterRefs.current.delete(hunter.id)
          }}
          visible={hunter.alive}
          position={hunter.position}
        >
          <Float speed={4} rotationIntensity={0.3} floatIntensity={0.2}>
            <mesh castShadow>
              <icosahedronGeometry args={[0.82, 0]} />
              <meshStandardMaterial
                color="#26081c"
                emissive="#ff245f"
                emissiveIntensity={3.2}
                metalness={0.75}
                roughness={0.18}
                flatShading
              />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[1.05, 0.055, 6, 28]} />
              <meshBasicMaterial color="#ff507f" toneMapped={false} />
            </mesh>
            <pointLight color="#ff245f" intensity={2.4} distance={6} />
          </Float>
        </group>
      ))}

      {bursts.map((burst) => (
        <ParticleBurst key={burst.id} burst={burst} onComplete={(id) => setBursts((all) => all.filter((item) => item.id !== id))} />
      ))}

      {activePulse ? (
        <PulseWave
          id={activePulse.id}
          color={palette.primary}
          position={activePulse.position}
          onComplete={() => setActivePulse(null)}
        />
      ) : null}

      {rival && mode === 'duel' ? <RivalCube rival={rival} /> : null}

      {Array.from({ length: reducedEffects ? 2 : 5 }, (_, index) => (
        <mesh
          key={index}
          ref={(node) => {
            trailRefs.current[index] = node
          }}
          position={[0, 0.75, 8 + index * 0.2]}
        >
          <boxGeometry args={[0.95, 0.2, 0.95]} />
          <meshBasicMaterial
            color={index % 2 ? palette.secondary : palette.primary}
            transparent
            opacity={0.22 - index * 0.028}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      ))}

      <group ref={player} position={[0, 1.05, 8]}>
        <group ref={playerShell}>
          <RoundedBox args={[1.55, 1.55, 1.55]} radius={0.23} smoothness={4} castShadow>
            <meshPhysicalMaterial
              color="#0c1029"
              emissive={palette.primary}
              emissiveIntensity={0.72}
              roughness={0.14}
              metalness={0.72}
              transmission={0.2}
              thickness={0.7}
              transparent
              opacity={0.92}
            />
          </RoundedBox>
          <mesh>
            <boxGeometry args={[1.63, 1.63, 1.63]} />
            <meshBasicMaterial color={palette.primary} wireframe transparent opacity={0.52} toneMapped={false} />
          </mesh>
          <mesh rotation={[0, Math.PI / 4, 0]} scale={0.58}>
            <octahedronGeometry args={[1, 0]} />
            <meshStandardMaterial
              color="#ffffff"
              emissive={palette.primary}
              emissiveIntensity={6}
              roughness={0.08}
              toneMapped={false}
            />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.15, 0.035, 6, 42]} />
            <meshBasicMaterial color={palette.secondary} transparent opacity={0.8} toneMapped={false} />
          </mesh>
        </group>
        <pointLight color={palette.primary} intensity={5.5} distance={10} decay={2} />
      </group>
    </>
  )
}

export function GameScene(props: GameSceneProps) {
  return <GameWorld {...props} />
}
