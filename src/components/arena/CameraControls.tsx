/* eslint-disable react-hooks/immutability */
import { useFrame, useThree } from '@react-three/fiber'
import { useRef, useEffect, useMemo } from 'react'
import { Vector3 } from 'three'
import { hexToWorld } from '../../utils/hex'
import type { GridPosition } from '../../../shared/types'

export type CameraMode = 'free' | 'follow' | 'overview'

interface OrbitControlsLike {
  enabled: boolean
  target: Vector3
  update: () => void
}

type CameraControlsProps = {
  targetPosition: GridPosition | null
  allPositions: GridPosition[]
  selectedTargetPosition: GridPosition | null
  mode: CameraMode
}

const gridToWorld = (pos: GridPosition): Vector3 => {
  const [wx, wz] = hexToWorld(pos.x, pos.z)
  return new Vector3(wx, 0, wz)
}

export const CameraControls = ({ targetPosition, allPositions, selectedTargetPosition, mode }: CameraControlsProps) => {
  const controls = useThree((state) => state.controls) as unknown as OrbitControlsLike | null
  const { camera } = useThree()
  
  const followTarget = useRef(new Vector3(0, 0, 0))
  
  useEffect(() => {
    if (targetPosition) {
      followTarget.current.copy(gridToWorld(targetPosition))
    }
  }, [targetPosition])

  const overviewGoal = useMemo(() => {
    if (mode !== 'overview' || allPositions.length === 0) return null

    const worldPoints = allPositions.map(gridToWorld)

    const activeWorld = targetPosition ? gridToWorld(targetPosition) : null
    const targetWorld = selectedTargetPosition ? gridToWorld(selectedTargetPosition) : null

    const geoCenter = worldPoints
      .reduce((acc, cur) => acc.add(cur), new Vector3())
      .multiplyScalar(1 / worldPoints.length)

    const focusPoint = new Vector3()
    let totalWeight = 0

    for (const wp of worldPoints) {
      focusPoint.add(wp)
      totalWeight += 1
    }
    if (activeWorld) {
      focusPoint.add(activeWorld.clone().multiplyScalar(2))
      totalWeight += 2
    }
    if (targetWorld) {
      focusPoint.add(targetWorld.clone().multiplyScalar(1.5))
      totalWeight += 1.5
    }
    focusPoint.multiplyScalar(1 / totalWeight)

    const maxDist = worldPoints.reduce(
      (max, cur) => Math.max(max, cur.distanceTo(geoCenter)),
      0
    )
    const spread = Math.max(6, maxDist + 4)
    const height = Math.max(10, spread * 1.1)

    const camPos = focusPoint.clone().add(new Vector3(spread * 0.7, height, spread * 0.7))

    return { lookAt: focusPoint, camPos }
  }, [mode, allPositions, targetPosition, selectedTargetPosition])

  useFrame((_, delta) => {
    if (!controls) return

    if (!controls.enabled) controls.enabled = true

    if (mode === 'free') return

    const speed = 0.4 * delta

    if (mode === 'follow') {
      const target = followTarget.current
      const offset = new Vector3(8, 10, 8)
      camera.position.lerp(target.clone().add(offset), speed)
      controls.target.lerp(target, speed)
    } else if (mode === 'overview' && overviewGoal) {
      camera.position.lerp(overviewGoal.camPos, speed)
      controls.target.lerp(overviewGoal.lookAt, speed)
    }

    camera.lookAt(controls.target)
  })

  return null
}
