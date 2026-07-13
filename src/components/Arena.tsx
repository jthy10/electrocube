import { Sparkles, Stars } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { ARENA_RADIUS } from '../game/constants'

export interface ArenaProps {
  reducedEffects?: boolean
  bankReady?: boolean
}

const COLORS = {
  void: '#030511',
  floor: '#070a1b',
  floorEdge: '#0d1633',
  cyan: '#00f6ff',
  blue: '#5268ff',
  magenta: '#ff2bd6',
  violet: '#8a48ff',
  gold: '#ffd45c',
} as const

const FLOOR_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FLOOR_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform vec3 uCyan;
  uniform vec3 uMagenta;
  varying vec2 vUv;

  float gridLine(vec2 point, float scale) {
    vec2 coordinate = point * scale;
    vec2 derivative = max(fwidth(coordinate), vec2(0.0001));
    vec2 grid = abs(fract(coordinate - 0.5) - 0.5) / derivative;
    return 1.0 - min(min(grid.x, grid.y), 1.0);
  }

  float band(float value, float target, float width) {
    return 1.0 - smoothstep(width, width * 2.1, abs(value - target));
  }

  void main() {
    vec2 point = (vUv - 0.5) * 2.0;
    float radius = length(point);

    if (radius > 1.0) discard;

    float angle = atan(point.y, point.x);
    float minorGrid = gridLine(point, 18.0);
    float majorGrid = gridLine(point, 4.5);
    float rings = max(
      max(band(radius, 0.255, 0.0045), band(radius, 0.535, 0.0045)),
      band(radius, 0.84, 0.006)
    );
    float spokes = 1.0 - smoothstep(0.012, 0.04, abs(sin(angle * 6.0)));
    spokes *= smoothstep(0.2, 0.32, radius) * (1.0 - smoothstep(0.86, 0.94, radius));

    float brokenTrace = step(0.62, sin(angle * 12.0 + radius * 42.0));
    float trace = max(rings, spokes * brokenTrace);
    float travellingPulse = pow(
      max(0.0, 0.5 + 0.5 * cos(angle * 3.0 - radius * 18.0 - uTime * 0.75)),
      13.0
    );

    float edgeFade = 1.0 - smoothstep(0.82, 1.0, radius);
    float centerFade = smoothstep(0.08, 0.19, radius);
    float energy = minorGrid * 0.10 + majorGrid * 0.31 + trace * 0.72;
    energy += trace * travellingPulse * 0.8;

    vec3 color = mix(
      uCyan,
      uMagenta,
      0.32 + 0.28 * sin(angle * 2.0 + radius * 8.0 + uTime * 0.12)
    );
    color *= 0.78 + travellingPulse * 0.45;

    float alpha = energy * edgeFade * centerFade;
    gl_FragColor = vec4(color, alpha);
  }
`

function CircuitFloor({ reducedEffects }: { reducedEffects: boolean }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uCyan: { value: new THREE.Color(COLORS.cyan) },
      uMagenta: { value: new THREE.Color(COLORS.magenta) },
    }),
    [],
  )

  useFrame(({ clock }) => {
    if (materialRef.current && !reducedEffects) {
      materialRef.current.uniforms.uTime.value = clock.elapsedTime
    }
  })

  const circuitNodes = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const angle = (index / 12) * Math.PI * 2
        const radius = index % 2 === 0 ? ARENA_RADIUS * 0.54 : ARENA_RADIUS * 0.76
        return {
          angle,
          color: index % 3 === 0 ? COLORS.magenta : COLORS.cyan,
          position: [Math.cos(angle) * radius, 0.055, Math.sin(angle) * radius] as const,
        }
      }),
    [],
  )

  return (
    <group>
      <mesh receiveShadow position={[0, -0.34, 0]}>
        <cylinderGeometry args={[ARENA_RADIUS, ARENA_RADIUS + 0.65, 0.66, 96]} />
        <meshStandardMaterial color={COLORS.floor} metalness={0.68} roughness={0.54} />
      </mesh>

      <mesh position={[0, -0.7, 0]}>
        <cylinderGeometry args={[ARENA_RADIUS + 0.8, ARENA_RADIUS + 1.6, 0.22, 96]} />
        <meshStandardMaterial color={COLORS.floorEdge} metalness={0.82} roughness={0.32} />
      </mesh>

      <mesh position={[0, 0.018, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ARENA_RADIUS * 2, ARENA_RADIUS * 2, 1, 1]} />
        <shaderMaterial
          ref={materialRef}
          vertexShader={FLOOR_VERTEX_SHADER}
          fragmentShader={FLOOR_FRAGMENT_SHADER}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      {[ARENA_RADIUS * 0.25, ARENA_RADIUS * 0.54, ARENA_RADIUS * 0.84].map((radius, index) => (
        <mesh key={radius} position={[0, 0.044 + index * 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[radius - 0.045, radius + 0.045, 128]} />
          <meshBasicMaterial
            color={index === 1 ? COLORS.magenta : COLORS.cyan}
            transparent
            opacity={reducedEffects ? 0.28 : 0.46}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}

      {circuitNodes.map(({ angle, color, position }, index) => (
        <group key={index} position={position} rotation={[-Math.PI / 2, 0, angle]}>
          <mesh>
            <ringGeometry args={[0.42, 0.58, 32]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={reducedEffects ? 0.35 : 0.72}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          <mesh position={[0, 0, -0.002]}>
            <circleGeometry args={[0.19, 24]} />
            <meshBasicMaterial color={color} transparent opacity={0.46} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function Reactor({ reducedEffects, bankReady }: { reducedEffects: boolean; bankReady: boolean }) {
  const gyroscopeRef = useRef<THREE.Group>(null)
  const innerRingRef = useRef<THREE.Mesh>(null)
  const coreRef = useRef<THREE.Mesh>(null)
  const lightRef = useRef<THREE.PointLight>(null)

  useFrame(({ clock }, delta) => {
    if (reducedEffects) return

    const time = clock.elapsedTime
    if (gyroscopeRef.current) {
      gyroscopeRef.current.rotation.y += delta * 0.12
      gyroscopeRef.current.rotation.z = Math.sin(time * 0.23) * 0.08
    }
    if (innerRingRef.current) {
      innerRingRef.current.rotation.z -= delta * 0.24
      innerRingRef.current.rotation.x = Math.PI / 2 + Math.sin(time * 0.38) * 0.12
    }
    if (coreRef.current) {
      const pulse = 1 + Math.sin(time * 1.8) * 0.045
      coreRef.current.scale.setScalar(pulse)
      coreRef.current.rotation.y += delta * 0.18
    }
    if (lightRef.current) {
      lightRef.current.intensity = (bankReady ? 27 : 19) + Math.sin(time * (bankReady ? 4.2 : 1.8)) * (bankReady ? 5 : 2.5)
    }
  })

  return (
    <group>
      <mesh receiveShadow position={[0, 0.18, 0]}>
        <cylinderGeometry args={[4.45, 5.1, 0.34, 64]} />
        <meshStandardMaterial color="#090d25" metalness={0.78} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.37, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3.65, 4.25, 96]} />
        <meshBasicMaterial color={COLORS.cyan} transparent opacity={0.2} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.56, 0]}>
        <cylinderGeometry args={[2.25, 3.15, 0.72, 48]} />
        <meshStandardMaterial color="#111633" metalness={0.84} roughness={0.25} />
      </mesh>

      <mesh position={[0, 2.7, 0]}>
        <cylinderGeometry args={[0.42, 0.82, 4.25, 32, 1, true]} />
        <meshBasicMaterial
          color={bankReady ? COLORS.gold : COLORS.cyan}
          transparent
          opacity={reducedEffects ? 0.08 : 0.16}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>

      <group ref={gyroscopeRef} position={[0, 3.05, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[2.8, 0.075, 10, 96]} />
          <meshBasicMaterial color={COLORS.cyan} toneMapped={false} />
        </mesh>
        <mesh rotation={[0.62, 0.28, 0.2]}>
          <torusGeometry args={[2.2, 0.065, 10, 96]} />
          <meshBasicMaterial color={COLORS.magenta} toneMapped={false} />
        </mesh>
        <mesh ref={innerRingRef} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.58, 0.055, 8, 80]} />
          <meshBasicMaterial color={COLORS.gold} toneMapped={false} />
        </mesh>

        <mesh ref={coreRef} castShadow>
          <icosahedronGeometry args={[0.93, 1]} />
          <meshStandardMaterial
            color={bankReady ? '#fff8d5' : '#d9fdff'}
            emissive={bankReady ? COLORS.gold : COLORS.cyan}
            emissiveIntensity={bankReady ? 6.4 : 3.8}
            metalness={0.18}
            roughness={0.15}
            toneMapped={false}
          />
        </mesh>
        <mesh scale={1.42}>
          <icosahedronGeometry args={[0.93, 1]} />
          <meshBasicMaterial
            color={COLORS.blue}
            wireframe
            transparent
            opacity={0.34}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>

      <pointLight
        ref={lightRef}
        position={[0, 3.3, 0]}
        color={bankReady ? COLORS.gold : COLORS.cyan}
        intensity={reducedEffects ? (bankReady ? 18 : 12) : bankReady ? 27 : 19}
        distance={24}
        decay={2}
      />

      {!reducedEffects && (
        <Sparkles
          position={[0, 3.1, 0]}
          count={54}
          scale={[6, 7, 6]}
          size={2.2}
          speed={0.28}
          opacity={0.72}
          color={COLORS.cyan}
          noise={[1.2, 1.8, 1.2]}
        />
      )}

      {bankReady ? (
        <group>
          <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[4.7, 5.25, 96]} />
            <meshBasicMaterial
              color={COLORS.gold}
              transparent
              opacity={0.72}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          <mesh position={[0, 7.5, 0]}>
            <cylinderGeometry args={[0.12, 0.75, 14, 16, 1, true]} />
            <meshBasicMaterial
              color={COLORS.gold}
              transparent
              opacity={0.22}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              side={THREE.DoubleSide}
              toneMapped={false}
            />
          </mesh>
          {!reducedEffects ? (
            <Sparkles position={[0, 3, 0]} count={80} scale={[8, 9, 8]} size={2.8} speed={0.65} color={COLORS.gold} />
          ) : null}
        </group>
      ) : null}
    </group>
  )
}

function ArenaPerimeter({ reducedEffects }: { reducedEffects: boolean }) {
  const monoliths = useMemo(
    () =>
      Array.from({ length: 16 }, (_, index) => {
        const angle = (index / 16) * Math.PI * 2
        const height = 3.7 + ((index * 7) % 5) * 0.58
        const radius = ARENA_RADIUS + 0.2
        return {
          angle,
          color: index % 4 === 1 ? COLORS.magenta : COLORS.cyan,
          height,
          position: [Math.cos(angle) * radius, 0, Math.sin(angle) * radius] as const,
        }
      }),
    [],
  )

  return (
    <group>
      <mesh position={[0, 0.06, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[ARENA_RADIUS - 0.35, 0.09, 8, 192]} />
        <meshBasicMaterial color={COLORS.cyan} transparent opacity={0.72} toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.28, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[ARENA_RADIUS + 0.72, 0.2, 10, 192]} />
        <meshStandardMaterial
          color="#18224a"
          emissive={COLORS.violet}
          emissiveIntensity={reducedEffects ? 0.35 : 0.65}
          metalness={0.74}
          roughness={0.28}
        />
      </mesh>

      {monoliths.map(({ angle, color, height, position }, index) => (
        <group key={index} position={position} rotation={[0, -angle - Math.PI / 2, 0]}>
          <mesh castShadow position={[0, height / 2 - 0.15, 0]}>
            <boxGeometry args={[1.7, height, 1.1]} />
            <meshStandardMaterial color="#0b1028" metalness={0.74} roughness={0.36} />
          </mesh>
          <mesh position={[0, height * 0.55, 0.561]}>
            <boxGeometry args={[0.14, height * 0.58, 0.025]} />
            <meshBasicMaterial color={color} transparent opacity={0.86} toneMapped={false} />
          </mesh>
          <mesh position={[0, height + 0.12, 0]}>
            <octahedronGeometry args={[0.35, 0]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={reducedEffects ? 1.2 : 2.4}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export function BackgroundRig({ reducedEffects = false }: ArenaProps) {
  const orbitalRef = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    if (orbitalRef.current && !reducedEffects) {
      orbitalRef.current.rotation.y += delta * 0.012
      orbitalRef.current.rotation.z -= delta * 0.006
    }
  })

  return (
    <group>
      <Stars
        radius={76}
        depth={42}
        count={reducedEffects ? 500 : 1400}
        factor={3.2}
        saturation={0.5}
        fade
        speed={reducedEffects ? 0 : 0.08}
      />

      {!reducedEffects && (
        <>
          <Sparkles
            count={100}
            scale={[82, 34, 82]}
            position={[0, 12, 0]}
            size={1.35}
            speed={0.08}
            opacity={0.32}
            color={COLORS.blue}
            noise={[1, 0.35, 1]}
          />
          <Sparkles
            count={46}
            scale={[64, 22, 64]}
            position={[0, 5, 0]}
            size={1.7}
            speed={0.12}
            opacity={0.24}
            color={COLORS.magenta}
            noise={[1, 0.5, 1]}
          />
        </>
      )}

      <group ref={orbitalRef} position={[-24, 18, -50]} rotation={[0.42, -0.32, 0.25]}>
        <mesh>
          <torusGeometry args={[20, 0.12, 8, 128]} />
          <meshBasicMaterial color={COLORS.blue} transparent opacity={0.18} toneMapped={false} />
        </mesh>
        <mesh rotation={[1.1, 0.2, 0.45]}>
          <torusGeometry args={[15.5, 0.08, 8, 128]} />
          <meshBasicMaterial color={COLORS.magenta} transparent opacity={0.13} toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}

export function Arena({ reducedEffects = false, bankReady = false }: ArenaProps) {
  return (
    <>
      <color attach="background" args={[COLORS.void]} />
      <fog attach="fog" args={[COLORS.void, 34, 108]} />

      <ambientLight color="#6073bb" intensity={0.38} />
      <hemisphereLight args={['#667dff', '#050712', 0.52]} />
      <directionalLight
        castShadow={!reducedEffects}
        position={[18, 29, 14]}
        color="#dce7ff"
        intensity={1.35}
        shadow-mapSize-width={reducedEffects ? 512 : 1024}
        shadow-mapSize-height={reducedEffects ? 512 : 1024}
        shadow-camera-near={4}
        shadow-camera-far={78}
        shadow-camera-left={-42}
        shadow-camera-right={42}
        shadow-camera-top={42}
        shadow-camera-bottom={-42}
      />
      <pointLight position={[-22, 8, -18]} color={COLORS.magenta} intensity={7} distance={42} decay={2} />
      <pointLight position={[23, 6, 19]} color={COLORS.blue} intensity={6} distance={38} decay={2} />

      <BackgroundRig reducedEffects={reducedEffects} />
      <CircuitFloor reducedEffects={reducedEffects} />
      <ArenaPerimeter reducedEffects={reducedEffects} />
      <Reactor reducedEffects={reducedEffects} bankReady={bankReady} />
    </>
  )
}
