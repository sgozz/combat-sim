/* eslint-disable react-hooks/immutability */
import { useFrame, useThree } from '@react-three/fiber'
import { useRef, useEffect } from 'react'
import { Vector3 } from 'three'
import { hexToWorld } from '../../utils/hex'
import type { GridPosition } from '../../../shared/types'

export type CameraMode = 'free' | 'follow'

interface OrbitControlsLike {
  enabled: boolean
  target: Vector3
  update: () => void
}

type CameraControlsProps = {
  targetPosition: GridPosition | null
  mode: CameraMode
}

export const CameraControls = ({ targetPosition, mode }: CameraControlsProps) => {
  const controls = useThree((state) => state.controls) as unknown as OrbitControlsLike | null
  const { camera } = useThree()
  
  const followTarget = useRef(new Vector3(0, 0, 0))
  
  useEffect(() => {
    if (targetPosition) {
      const [wx, wz] = hexToWorld(targetPosition.x, targetPosition.z)
      followTarget.current.set(wx, 0, wz)
    }
  }, [targetPosition])

  useFrame((_, delta) => {
    if (!controls) return

    if (!controls.enabled) controls.enabled = true

    if (mode === 'free') {
      return
    }

    const GENTLE_SUGGESTION_SPEED = 0.4
    const speed = GENTLE_SUGGESTION_SPEED * delta
    const target = followTarget.current

    const offset = new Vector3(8, 10, 8)
    const targetCamPos = target.clone().add(offset)
    camera.position.lerp(targetCamPos, speed)
    controls.target.lerp(target, speed)
    
    camera.lookAt(controls.target)
  })

  return null
}
