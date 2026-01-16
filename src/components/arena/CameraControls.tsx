/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable */

import { useFrame, useThree } from '@react-three/fiber'
import { useRef, useEffect } from 'react'
import { Vector3 } from 'three'
import { hexToWorld } from '../../utils/hex'
import type { GridPosition } from '../../../shared/types'

export type CameraMode = 'free' | 'top' | 'isometric' | 'follow'

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

    if (mode === 'free') {
      if (!controls.enabled) controls.enabled = true
      return
    }

    if (controls.enabled) controls.enabled = false

    const speed = 2.0 * delta
    const target = followTarget.current

    if (mode === 'follow') {
      const offset = new Vector3(8, 10, 8)
      const targetCamPos = target.clone().add(offset)
      camera.position.lerp(targetCamPos, speed)
      controls.target.lerp(target, speed)
    } else if (mode === 'top') {
      const topPos = target.clone().add(new Vector3(0, 20, 0.1))
      camera.position.lerp(topPos, speed)
      controls.target.lerp(target, speed)
    } else if (mode === 'isometric') {
      const isoPos = target.clone().add(new Vector3(12, 12, 12))
      camera.position.lerp(isoPos, speed)
      controls.target.lerp(target, speed)
    }
    
    camera.lookAt(controls.target)
  })

  return null
}
