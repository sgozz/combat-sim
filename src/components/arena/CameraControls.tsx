/* eslint-disable react-hooks/immutability */
import { useFrame, useThree } from '@react-three/fiber'
import { useRef, useEffect } from 'react'
import { Vector3 } from 'three'
import { hexToWorld } from '../../utils/hex'
import type { GridPosition } from '../../../shared/types'

export type CameraMode = 'free' | 'top' | 'isometric' | 'follow' | 'overview'

interface OrbitControlsLike {
  enabled: boolean
  target: Vector3
  update: () => void
}

type CameraControlsProps = {
  targetPosition: GridPosition | null
  focusPositions: GridPosition[]
  mode: CameraMode
}

export const CameraControls = ({ targetPosition, focusPositions, mode }: CameraControlsProps) => {
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
    } else if (mode === 'overview' && focusPositions.length > 0) {
      const worldPoints = focusPositions.map((pos) => {
        const [wx, wz] = hexToWorld(pos.x, pos.z)
        return new Vector3(wx, 0, wz)
      })
      const center = worldPoints.reduce((acc, cur) => acc.add(cur), new Vector3()).multiplyScalar(1 / worldPoints.length)
      const maxDistance = worldPoints.reduce((max, cur) => Math.max(max, cur.distanceTo(center)), 0)
      const height = Math.max(12, maxDistance * 2 + 6)
      const overviewPos = center.clone().add(new Vector3(maxDistance, height, maxDistance))
      camera.position.lerp(overviewPos, speed)
      controls.target.lerp(center, speed)
    }
    
    camera.lookAt(controls.target)
  })

  return null
}
