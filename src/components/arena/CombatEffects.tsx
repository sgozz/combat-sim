/* eslint-disable react-hooks/immutability */
import { useRef, useEffect, useMemo, useCallback, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { GridSystem, GridType } from '../../../shared/grid'
import { hexGrid, squareGrid8 } from '../../../shared/grid'
import type { VisualEffect } from '../../../shared/types'

const getGridSystem = (gridType: GridType): GridSystem => {
  return gridType === 'square' ? squareGrid8 : hexGrid
}

type Particle = {
  position: THREE.Vector3
  velocity: THREE.Vector3
  life: number
  maxLife: number
  color: THREE.Color
  size: number
}

type ActiveEffect = {
  id: string
  type: VisualEffect['type']
  particles: Particle[]
}

const PARTICLE_CONFIGS = {
  damage: { count: 24, speed: 4, life: 0.6, size: 0.08, colors: [0xff4422, 0xff8844, 0xffcc44] },
  miss: { count: 8, speed: 2, life: 0.4, size: 0.05, colors: [0x888888, 0xaaaaaa] },
  heal: { count: 20, speed: 2.5, life: 0.7, size: 0.07, colors: [0x22ff44, 0x44ff88, 0x88ffaa] },
  defend: { count: 16, speed: 2.5, life: 0.5, size: 0.06, colors: [0x4488ff, 0x66bbff, 0xffffff] },
  grapple: { count: 12, speed: 1.5, life: 0.5, size: 0.06, colors: [0xff8800, 0xffaa44] },
  close_combat: { count: 12, speed: 1.5, life: 0.5, size: 0.06, colors: [0xff00ff, 0xff88ff] },
} as const

function createParticles(type: VisualEffect['type'], worldX: number, worldZ: number): Particle[] {
  const config = PARTICLE_CONFIGS[type]
  const particles: Particle[] = []

  for (let i = 0; i < config.count; i++) {
    const angle = (Math.PI * 2 * i) / config.count + (Math.random() - 0.5) * 0.5
    const upward = 1 + Math.random() * 2
    const outward = config.speed * (0.5 + Math.random() * 0.5)
    const colorHex = config.colors[Math.floor(Math.random() * config.colors.length)]

    particles.push({
      position: new THREE.Vector3(worldX, 1.2, worldZ),
      velocity: new THREE.Vector3(Math.cos(angle) * outward, upward, Math.sin(angle) * outward),
      life: config.life * (0.7 + Math.random() * 0.3),
      maxLife: config.life,
      color: new THREE.Color(colorHex),
      size: config.size * (0.8 + Math.random() * 0.4),
    })
  }

  if (type === 'defend') {
    for (let i = 0; i < 8; i++) {
      const ringAngle = (Math.PI * 2 * i) / 8
      particles.push({
        position: new THREE.Vector3(worldX + Math.cos(ringAngle) * 0.5, 1.0, worldZ + Math.sin(ringAngle) * 0.5),
        velocity: new THREE.Vector3(Math.cos(ringAngle) * 1.5, 0.3, Math.sin(ringAngle) * 1.5),
        life: 0.4,
        maxLife: 0.4,
        color: new THREE.Color(0x66bbff),
        size: 0.1,
      })
    }
  }

  if (type === 'heal') {
    for (let i = 0; i < 10; i++) {
      const ringAngle = (Math.PI * 2 * i) / 10
      particles.push({
        position: new THREE.Vector3(worldX + Math.cos(ringAngle) * 0.4, 0.5, worldZ + Math.sin(ringAngle) * 0.4),
        velocity: new THREE.Vector3(Math.cos(ringAngle) * 0.5, 3 + Math.random(), Math.sin(ringAngle) * 0.5),
        life: 0.6,
        maxLife: 0.6,
        color: new THREE.Color(0x44ff88),
        size: 0.1,
      })
    }
  }

  return particles
}

type CombatEffectsProps = {
  visualEffects: (VisualEffect & { id: string })[]
  gridType: GridType
}

export const CombatEffects = ({ visualEffects, gridType }: CombatEffectsProps) => {
  const effectsRef = useRef<ActiveEffect[]>([])
  const processedRef = useRef<Set<string>>(new Set())
  const gridSystem = useMemo(() => getGridSystem(gridType), [gridType])
  const [renderKey, setRenderKey] = useState(0)

  useEffect(() => {
    let added = false
    for (const effect of visualEffects) {
      if (processedRef.current.has(effect.id)) continue
      processedRef.current.add(effect.id)

      const worldPos = gridSystem.coordToWorld({ q: effect.position.x, r: effect.position.z })
      effectsRef.current.push({
        id: effect.id,
        type: effect.type,
        particles: createParticles(effect.type, worldPos.x, worldPos.z),
      })
      added = true
    }
    if (added) {
      setRenderKey(k => k + 1)
    }
  }, [visualEffects, gridSystem])

  const cleanup = useCallback(() => {
    const before = effectsRef.current.length
    effectsRef.current = effectsRef.current.filter(e => e.particles.some(p => p.life > 0))
    if (effectsRef.current.length !== before) {
      setRenderKey(k => k + 1)
    }
  }, [])

  useFrame((_, delta) => {
    let hasExpired = false
    for (const effect of effectsRef.current) {
      let allDead = true
      for (const p of effect.particles) {
        if (p.life <= 0) continue
        allDead = false
        p.life -= delta
        p.position.add(p.velocity.clone().multiplyScalar(delta))
        p.velocity.y -= 5 * delta
        p.velocity.multiplyScalar(0.97)
      }
      if (allDead) hasExpired = true
    }
    if (hasExpired) cleanup()
  })

  void renderKey

  if (effectsRef.current.length === 0) return null

  return (
    <group>
      {effectsRef.current.map(effect => (
        <EffectParticles key={effect.id} effect={effect} />
      ))}
    </group>
  )
}

const EffectParticles = ({ effect }: { effect: ActiveEffect }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const tempMatrix = useMemo(() => new THREE.Matrix4(), [])
  const tempColor = useMemo(() => new THREE.Color(), [])

  useFrame(() => {
    if (!meshRef.current) return

    let idx = 0
    for (const p of effect.particles) {
      if (p.life <= 0) continue
      const alpha = p.life / p.maxLife
      const scale = p.size * alpha

      tempMatrix.makeScale(scale, scale, scale)
      tempMatrix.setPosition(p.position)
      meshRef.current.setMatrixAt(idx, tempMatrix)

      tempColor.copy(p.color)
      meshRef.current.setColorAt(idx, tempColor)
      idx++
    }

    meshRef.current.count = idx
    meshRef.current.instanceMatrix.needsUpdate = true
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true
    }
  })

  const maxParticles = effect.particles.length
  if (maxParticles === 0) return null

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, maxParticles]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial transparent opacity={0.9} toneMapped={false} />
    </instancedMesh>
  )
}
