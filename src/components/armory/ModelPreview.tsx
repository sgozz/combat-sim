import { useMemo, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { useGLTF, OrbitControls, Stage } from '@react-three/drei'
import * as THREE from 'three'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import { getModelEntry } from '../../data/modelRegistry'

const TARGET_HEIGHT = 1.8

function computeNormalizedScale(obj: THREE.Object3D): number {
  const box = new THREE.Box3().setFromObject(obj)
  const height = box.max.y - box.min.y
  if (height <= 0) return 1
  return TARGET_HEIGHT / height
}

type ModelPreviewProps = {
  modelId?: string
}

const PreviewModel = ({ modelId }: { modelId?: string }) => {
  const model = getModelEntry(modelId)
  const { scene } = useGLTF(model.path)

  const { clonedScene, normalizedScale } = useMemo(() => {
    const clone = SkeletonUtils.clone(scene)
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        child.castShadow = true
        child.receiveShadow = true
        if (!Array.isArray(child.material)) {
          child.material = child.material.clone()
        }
      }
    })
    return { clonedScene: clone, normalizedScale: computeNormalizedScale(clone) }
  }, [scene])

  return (
    <primitive
      object={clonedScene}
      scale={normalizedScale}
      rotation={[0, model.rotationOffset, 0]}
    />
  )
}

export const ModelPreview = ({ modelId }: ModelPreviewProps) => {
  return (
    <div className="model-preview-container" style={{ width: '100%', height: '300px', background: '#1a1a1a', borderRadius: '8px', overflow: 'hidden', marginBottom: '1rem' }}>
      <Canvas shadows dpr={[1, 2]} camera={{ fov: 50 }}>
        <Suspense fallback={null}>
          <Stage environment="city" intensity={0.6}>
            <PreviewModel modelId={modelId} />
          </Stage>
          <OrbitControls autoRotate autoRotateSpeed={4} enableZoom={false} makeDefault />
        </Suspense>
      </Canvas>
    </div>
  )
}
