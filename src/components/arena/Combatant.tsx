import { useState, useEffect, useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, useGLTF } from '@react-three/drei'
import type { GridSystem, GridType } from '../../../shared/grid'
import { hexGrid, squareGrid8 } from '../../../shared/grid'
import type { CharacterSheet, VisualEffect } from '../../../shared/types'
import type { CombatantState } from '../../../shared/rulesets'
import { isGurpsCharacter, isPF2Character } from '../../../shared/rulesets/characterSheet'
import { isGurpsCombatant } from '../../../shared/rulesets'
import * as THREE from 'three'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'

const getGridSystem = (gridType: GridType): GridSystem => {
  return gridType === 'square' ? squareGrid8 : hexGrid
}

type AnimationState = 'idle' | 'walk' | 'run' | 'death' | 'jump' | 'punch' | 'working'

type CombatantProps = {
  combatant: CombatantState
  character: CharacterSheet | undefined
  isPlayer: boolean
  isSelected: boolean
  visualEffects: (VisualEffect & { id: string })[]
  gridType: GridType
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

    return clone
  }, [scene, isPlayer, emissive])

  useEffect(() => {
    const mixer = new THREE.AnimationMixer(clonedScene)
    mixerRef.current = mixer
    actionsRef.current = {}
    animations.forEach(clip => {
      actionsRef.current[clip.name] = mixer.clipAction(clip)
    })

    return () => {
      mixer.stopAllAction()
    }
  }, [clonedScene, animations])

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
      action.reset().fadeIn(0.2)
      if (animationState === 'death') {
        action.setLoop(THREE.LoopOnce, 1)
        action.clampWhenFinished = true
      }
      action.play()
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

const IDLE_THRESHOLD = 0.05
const WALK_TO_RUN_DISTANCE = 2.0
const RUN_TO_WALK_DISTANCE = 1.0
const WALK_SPEED_MULTIPLIER = 0.5
const ROTATION_SPEED = 8

export const Combatant = ({ combatant, character, isPlayer, isSelected, visualEffects, gridType, onClick }: CombatantProps) => {
  const emissive = isSelected ? '#ffff00' : '#000000'
  const gridSystem = useMemo(() => getGridSystem(gridType), [gridType])
  const worldPos = gridSystem.coordToWorld({ q: combatant.position.x, r: combatant.position.z })
  const targetX = worldPos.x
  const targetZ = worldPos.z
  const targetRotation = -combatant.facing * (Math.PI / 3)

  const groupRef = useRef<THREE.Group>(null)
  const currentPos = useRef(new THREE.Vector3(targetX, 0, targetZ))
  const currentRot = useRef(targetRotation)
  const [animationState, setAnimationState] = useState<AnimationState>('idle')
  const wasMovingRef = useRef(false)
  const combatAnimationRef = useRef<{ type: 'punch' | 'jump'; until: number } | null>(null)
  const processedEffectsRef = useRef<Set<string>>(new Set())

  const basicMove = useMemo(() => {
    if (!character) return 5
    if (isGurpsCharacter(character)) {
      return character.derived.basicMove
    } else if (isPF2Character(character)) {
      // PF2 speed is in feet, convert to yards (1 yard ≈ 3 feet)
      return Math.floor(character.derived.speed / 3)
    }
    return 5
  }, [character])
  
  const isDead = combatant.currentHP <= 0

  useEffect(() => {
    for (const effect of visualEffects) {
      if (processedEffectsRef.current.has(effect.id)) continue
      processedEffectsRef.current.add(effect.id)

      if ((effect.type === 'damage' || effect.type === 'miss') && effect.attackerId === combatant.playerId) {
        combatAnimationRef.current = { type: 'punch', until: Date.now() + 800 }
      } else if (effect.type === 'defend' && effect.targetId === combatant.playerId) {
        combatAnimationRef.current = { type: 'jump', until: Date.now() + 800 }
      }
    }
  }, [visualEffects, combatant.playerId])

  useFrame((_, delta) => {
    if (!groupRef.current) return

    if (isDead) {
      if (animationState !== 'death') setAnimationState('death')
      return
    }

    const combatAnim = combatAnimationRef.current
    if (combatAnim && Date.now() < combatAnim.until) {
      if (animationState !== combatAnim.type) setAnimationState(combatAnim.type)
      return
    } else if (combatAnim) {
      combatAnimationRef.current = null
    }

    const distanceToTarget = Math.sqrt(
      Math.pow(targetX - currentPos.current.x, 2) + 
      Math.pow(targetZ - currentPos.current.z, 2)
    )

    let newState: AnimationState
    let moveSpeed: number

    if (distanceToTarget < IDLE_THRESHOLD) {
      newState = 'idle'
      moveSpeed = 0
      wasMovingRef.current = false
    } else if (!wasMovingRef.current || distanceToTarget < RUN_TO_WALK_DISTANCE) {
      newState = 'walk'
      moveSpeed = basicMove * WALK_SPEED_MULTIPLIER
      wasMovingRef.current = true
    } else if (distanceToTarget > WALK_TO_RUN_DISTANCE) {
      newState = 'run'
      moveSpeed = basicMove
    } else {
      newState = animationState === 'idle' ? 'walk' : animationState
      moveSpeed = newState === 'run' ? basicMove : basicMove * WALK_SPEED_MULTIPLIER
    }
    
    if (newState !== animationState) setAnimationState(newState)

    if (moveSpeed > 0 && distanceToTarget > IDLE_THRESHOLD) {
      const moveDistance = moveSpeed * delta
      const ratio = Math.min(moveDistance / distanceToTarget, 1)
      currentPos.current.x += (targetX - currentPos.current.x) * ratio
      currentPos.current.z += (targetZ - currentPos.current.z) * ratio
    }

    let rotDiff = targetRotation - currentRot.current
    while (rotDiff > Math.PI) rotDiff -= Math.PI * 2
    while (rotDiff < -Math.PI) rotDiff += Math.PI * 2
    currentRot.current += rotDiff * Math.min(ROTATION_SPEED * delta, 1)

    groupRef.current.position.x = currentPos.current.x
    groupRef.current.position.z = currentPos.current.z
    groupRef.current.rotation.y = currentRot.current
  })

  const maxHP = character?.derived.hitPoints ?? 10
  const hpPercent = Math.max(0, Math.min(100, (combatant.currentHP / maxHP) * 100))

  const prevHpRef = useRef(combatant.currentHP)
  const [flashKey, setFlashKey] = useState(0)

  useEffect(() => {
    if (combatant.currentHP < prevHpRef.current) {
      queueMicrotask(() => setFlashKey(k => k + 1))
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

  const isGrappling = isGurpsCombatant(combatant) && combatant.grapple?.grappling != null
  const isGrappled = isGurpsCombatant(combatant) && combatant.grapple?.grappledBy != null
  const inCloseCombat = isGurpsCombatant(combatant) && combatant.inCloseCombatWith != null

  return (
    <group ref={groupRef} onClick={(e) => { e.stopPropagation(); onClick() }}>
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

      <Html position={[0, 2.5, 0]} center zIndexRange={[0, 50]} style={{ pointerEvents: 'none' }}>
        <div key={flashKey} className="hp-bar-compact flash-on-mount">
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
