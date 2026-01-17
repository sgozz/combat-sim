import { useState, useEffect, useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, useGLTF } from '@react-three/drei'
import { hexToWorld } from '../../utils/hex'
import type { CombatantState, CharacterSheet } from '../../../shared/types'
import * as THREE from 'three'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'

type AnimationState = 'idle' | 'walk' | 'run' | 'death' | 'jump' | 'punch' | 'working'

type CombatantProps = {
  combatant: CombatantState
  character: CharacterSheet | undefined
  isPlayer: boolean
  isSelected: boolean
  onClick: () => void
}

const STATUS_ICONS: Record<string, string> = {
  shock: '⚡',
  defending: '🛡️',
  stunned: '😵',
  aiming: '🎯',
  unconscious: '💤',
  dead: '💀',
  grappling: '🤼',
  grappled: '🔒',
  close_combat: '⚔️',
}

useGLTF.preload('/models/human.glb')

const MODEL_ROTATION_OFFSET = Math.PI / 2
const MODEL_SCALE = 0.342

const INDICATOR_DISTANCE = 0.7
const INDICATOR_HEIGHT = 0.05
const INDICATOR_LATERAL_OFFSET = Math.PI / 2

function HumanModel({ emissive, isPlayer, animationState }: { emissive: string; isPlayer: boolean; animationState: AnimationState }) {
  const { scene, animations } = useGLTF('/models/human.glb')
  const mixerRef = useRef<THREE.AnimationMixer | null>(null)
  const actionsRef = useRef<Record<string, THREE.AnimationAction>>({})

  const clonedScene = useMemo(() => {
    const clone = SkeletonUtils.clone(scene)

    clone.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const material = child.material.clone()
        if (material instanceof THREE.MeshStandardMaterial) {
          material.color.multiplyScalar(isPlayer ? 1.2 : 0.9)
          if (isPlayer) {
            material.emissive.setHex(0x2244ff)
            material.emissiveIntensity = 0.15
          } else {
            material.emissive.setHex(0xff2222)
            material.emissiveIntensity = 0.15
          }
          if (emissive !== '#000000') {
            material.emissive.setHex(0xffff00)
            material.emissiveIntensity = 0.4
          }
        }
        child.material = material
      }
    })

    const mixer = new THREE.AnimationMixer(clone)
    mixerRef.current = mixer
    actionsRef.current = {}
    animations.forEach(clip => {
      actionsRef.current[clip.name] = mixer.clipAction(clip)
    })

    return clone
  }, [scene, animations, isPlayer, emissive])

  useFrame((_, delta) => {
    mixerRef.current?.update(delta)
  })

  useEffect(() => {
    const animationMap: Record<AnimationState, string> = {
      idle: 'Human Armature|Idle',
      walk: 'Human Armature|Walk',
      run: 'Human Armature|Run',
      death: 'Human Armature|Death',
      jump: 'Human Armature|Jump',
      punch: 'Human Armature|Punch',
      working: 'Human Armature|Working'
    }
    const action = actionsRef.current[animationMap[animationState]]
    if (action) {
      Object.values(actionsRef.current).forEach(a => a?.fadeOut(0.2))
      action.reset().fadeIn(0.2).play()
    }
  }, [animationState, clonedScene])

  return (
    <group rotation={[0, MODEL_ROTATION_OFFSET, 0]}>
      <primitive object={clonedScene} scale={MODEL_SCALE} />
      <mesh 
        position={[
          INDICATOR_DISTANCE * Math.cos(INDICATOR_LATERAL_OFFSET), 
          INDICATOR_HEIGHT, 
          INDICATOR_DISTANCE * Math.sin(INDICATOR_LATERAL_OFFSET)
        ]} 
        rotation={[Math.PI / 2, -INDICATOR_LATERAL_OFFSET, 0]}>
        <coneGeometry args={[0.1, 0.25, 6]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} />
      </mesh>
    </group>
  )
}

const WALK_THRESHOLD = 0.01
const RUN_THRESHOLD = 0.5

export const Combatant = ({ combatant, character, isPlayer, isSelected, onClick }: CombatantProps) => {
  const emissive = isSelected ? '#ffff00' : '#000000'
  const [targetX, targetZ] = hexToWorld(combatant.position.x, combatant.position.z)
  const targetRotation = -combatant.facing * (Math.PI / 3)

  const groupRef = useRef<THREE.Group>(null)
  const currentPos = useRef(new THREE.Vector3(targetX, 0, targetZ))
  const currentRot = useRef(targetRotation)
  const [animationState, setAnimationState] = useState<AnimationState>('idle')

  useFrame((_, delta) => {
    if (!groupRef.current) return

    const lerpFactor = 1 - Math.pow(0.001, delta)

    const prevX = currentPos.current.x
    const prevZ = currentPos.current.z

    currentPos.current.x = THREE.MathUtils.lerp(currentPos.current.x, targetX, lerpFactor)
    currentPos.current.z = THREE.MathUtils.lerp(currentPos.current.z, targetZ, lerpFactor)

    const moveSpeed = Math.sqrt(
      Math.pow(currentPos.current.x - prevX, 2) + 
      Math.pow(currentPos.current.z - prevZ, 2)
    ) / delta

    let newState: AnimationState = 'idle'
    if (moveSpeed > RUN_THRESHOLD) newState = 'run'
    else if (moveSpeed > WALK_THRESHOLD) newState = 'walk'
    
    if (newState !== animationState) setAnimationState(newState)

    let rotDiff = targetRotation - currentRot.current
    while (rotDiff > Math.PI) rotDiff -= Math.PI * 2
    while (rotDiff < -Math.PI) rotDiff += Math.PI * 2
    currentRot.current += rotDiff * lerpFactor

    groupRef.current.position.x = currentPos.current.x
    groupRef.current.position.z = currentPos.current.z
    groupRef.current.rotation.y = currentRot.current
  })

  const maxHP = character?.derived.hitPoints ?? 10
  const hpPercent = Math.max(0, Math.min(100, (combatant.currentHP / maxHP) * 100))

  const [isFlashing, setIsFlashing] = useState(false)
  const prevHpRef = useRef(combatant.currentHP)

  useEffect(() => {
    if (combatant.currentHP < prevHpRef.current) {
      setIsFlashing(true)
      const timer = setTimeout(() => setIsFlashing(false), 400)
      return () => clearTimeout(timer)
    }
    prevHpRef.current = combatant.currentHP
  }, [combatant.currentHP])

  let hpColor = '#4f4'
  if (combatant.currentHP <= 0) {
    hpColor = '#666'
  } else if (hpPercent <= 20) {
    hpColor = '#f44'
  } else if (hpPercent <= 50) {
    hpColor = '#ff4'
  }

  const isGrappling = combatant.grapple?.grappling != null
  const isGrappled = combatant.grapple?.grappledBy != null
  const inCloseCombat = combatant.inCloseCombatWith != null

  return (
    <group ref={groupRef} position={[targetX, 0, targetZ]} onClick={(e) => { e.stopPropagation(); onClick() }}>
      <HumanModel emissive={emissive} isPlayer={isPlayer} animationState={animationState} />

      {isSelected && (
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.5, 0.65, 6]} />
          <meshBasicMaterial color="#ff0" transparent opacity={0.8} />
        </mesh>
      )}

      {inCloseCombat && !isSelected && (
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.45, 0.55, 6]} />
          <meshBasicMaterial color={isGrappling || isGrappled ? '#f80' : '#f0f'} transparent opacity={0.6} />
        </mesh>
      )}

      <Html position={[0, 2.5, 0]} center style={{ zIndex: 10, pointerEvents: 'none' }}>
        <div className={`hp-bar-compact ${isFlashing ? 'flash' : ''}`}>
          <div className="hp-bar-name-compact">{character?.name ?? '?'}</div>
          <div className="hp-bar-track-compact">
            <div
              className="hp-bar-fill-compact"
              style={{ width: `${hpPercent}%`, backgroundColor: hpColor }}
            />
          </div>
          {(combatant.statusEffects.length > 0 || inCloseCombat) && (
            <div className="status-icons-compact">
              {isGrappling && <span title="Grappling">{STATUS_ICONS.grappling}</span>}
              {isGrappled && <span title="Grappled">{STATUS_ICONS.grappled}</span>}
              {inCloseCombat && !isGrappling && !isGrappled && <span title="Close Combat">{STATUS_ICONS.close_combat}</span>}
              {combatant.statusEffects.slice(0, 2).map((effect) => (
                <span key={effect} title={effect}>{STATUS_ICONS[effect] || '•'}</span>
              ))}
            </div>
          )}
        </div>
        <div className="hp-bar-details">
          <div className="hp-bar-details-content">
            <div className="hp-detail-name">{character?.name ?? 'Unknown'}</div>
            <div className="hp-detail-hp">{Math.ceil(combatant.currentHP)} / {maxHP} HP</div>
            {(combatant.statusEffects.length > 0 || inCloseCombat) && (
              <div className="hp-detail-status">
                {isGrappling && <span className="status-tag">{STATUS_ICONS.grappling} Grappling</span>}
                {isGrappled && <span className="status-tag">{STATUS_ICONS.grappled} Grappled</span>}
                {inCloseCombat && !isGrappling && !isGrappled && <span className="status-tag">{STATUS_ICONS.close_combat} Close Combat</span>}
                {combatant.statusEffects.map((effect) => (
                  <span key={effect} className="status-tag">
                    {STATUS_ICONS[effect]} {effect}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </Html>
    </group>
  )
}
