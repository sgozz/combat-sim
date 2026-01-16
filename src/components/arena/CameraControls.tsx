/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
// Disabling lint rules that conflict with Three.js imperative mutations
/* eslint-disable */

import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useState, useMemo } from 'react'
import { Vector3 } from 'three'

type CameraMode = 'free' | 'top' | 'isometric'

interface OrbitControlsLike {
  enabled: boolean
  target: Vector3
  update: () => void
}

export const CameraControls = () => {
  const controls = useThree((state) => state.controls) as unknown as OrbitControlsLike | null
  const { camera } = useThree()
  
  const [mode, setMode] = useState<CameraMode>('free')

  const TOP_POS = useMemo(() => new Vector3(0, 20, 0), [])
  const ISO_POS = useMemo(() => new Vector3(15, 15, 15), [])
  const CENTER = useMemo(() => new Vector3(0, 0, 0), [])

  useFrame((_, delta) => {
    if (!controls) return

    if (mode === 'free') {
      if (!controls.enabled) controls.enabled = true
      return
    }

    if (controls.enabled) controls.enabled = false

    const targetPos = mode === 'top' ? TOP_POS : ISO_POS
    const speed = 2.0 * delta

    camera.position.lerp(targetPos, speed)
    controls.target.lerp(CENTER, speed)
    camera.lookAt(controls.target)
  })

  return (
    <Html fullscreen style={{ pointerEvents: 'none', zIndex: 100 }}>
      <div className="camera-controls-compact">
        <button 
          className={`camera-btn-compact ${mode === 'top' ? 'active' : ''}`}
          onClick={() => setMode('top')}
          title="Top-Down"
        >
          ⬇
        </button>
        <button 
          className={`camera-btn-compact ${mode === 'isometric' ? 'active' : ''}`}
          onClick={() => setMode('isometric')}
          title="Isometric"
        >
          ◇
        </button>
        <button 
          className={`camera-btn-compact ${mode === 'free' ? 'active' : ''}`}
          onClick={() => setMode('free')}
          title="Free Camera"
        >
          ⟲
        </button>
      </div>
    </Html>
  )
}
