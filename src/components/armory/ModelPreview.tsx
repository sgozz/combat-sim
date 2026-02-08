import { useRef, useMemo, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF, OrbitControls, Stage } from '@react-three/drei'
import * as THREE from 'three'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import { getModelEntry } from '../../data/modelRegistry'

type ModelPreviewProps = {
  modelId?: string
}

const PreviewModel = ({ modelId }: { modelId?: string }) => {
  const model = getModelEntry(modelId)
  const { scene } = useGLTF(model.path)
  
  const clonedScene = useMemo(() => {
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
    
    return clone
  }, [scene])

  return (
    <group dispose={null}>
       <primitive 
        object={clonedScene} 
        scale={model.scale} 
        rotation={[0, model.rotationOffset, 0]} 
      />
    </group>
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
