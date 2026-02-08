import { Component, useMemo, useEffect, useRef, useState, useCallback, Suspense } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import type { RootState } from '@react-three/fiber'
import { useGLTF, OrbitControls, Stage } from '@react-three/drei'
import * as THREE from 'three'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import { getModelEntry } from '../../data/modelRegistry'
import type { ModelEntry } from '../../data/modelRegistry'

type ModelPreviewProps = {
  modelId?: string
}

function prepareCloneMaterials(obj: THREE.Object3D) {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material) {
      child.castShadow = true
      child.receiveShadow = true
      if (!Array.isArray(child.material)) {
        child.material = child.material.clone()
      }
    }
  })
}

const SimplePreviewModel = ({ model }: { model: ModelEntry }) => {
  const { scene } = useGLTF(model.path)

  const clonedScene = useMemo(() => {
    const clone = SkeletonUtils.clone(scene)
    prepareCloneMaterials(clone)
    return clone
  }, [scene])

  return (
    <primitive
      object={clonedScene}
      scale={model.scale}
      rotation={[0, model.rotationOffset, 0]}
    />
  )
}

const CompositePreviewModel = ({ model }: { model: ModelEntry }) => {
  const composite = model.composite!
  const bodyGltf = useGLTF(composite.body)
  const animGltf = useGLTF(composite.animationSrc)

  const mixerRef = useRef<THREE.AnimationMixer | null>(null)

  const bodyClone = useMemo(() => {
    const clone = SkeletonUtils.clone(bodyGltf.scene)
    prepareCloneMaterials(clone)
    return clone
  }, [bodyGltf.scene])

  useEffect(() => {
    const mixer = new THREE.AnimationMixer(bodyClone)
    mixerRef.current = mixer

    const idleClipName = model.animations.idle
    const idleClip = animGltf.animations.find(c => c.name === idleClipName)
    if (idleClip) {
      mixer.clipAction(idleClip).play()
    }

    return () => { mixer.stopAllAction() }
  }, [bodyClone, animGltf.animations, model.animations])

  useFrame((_, delta) => { mixerRef.current?.update(delta) })

  return (
    <primitive
      object={bodyClone}
      scale={model.scale}
      rotation={[0, model.rotationOffset, 0]}
    />
  )
}

const PreviewModel = ({ modelId }: { modelId?: string }) => {
  const model = getModelEntry(modelId)

  return (
    <group dispose={null}>
      {model.composite ? (
        <CompositePreviewModel model={model} />
      ) : (
        <SimplePreviewModel model={model} />
      )}
    </group>
  )
}

function RendererCleanup() {
  const glRef = useRef<THREE.WebGLRenderer | null>(null)

  useEffect(() => {
    return () => { glRef.current?.dispose() }
  }, [])

  useFrame((rootState) => {
    if (!glRef.current) glRef.current = rootState.gl
  })

  return null
}

type ErrorBoundaryProps = { fallback: ReactNode; children: ReactNode }
type ErrorBoundaryState = { hasError: boolean }

class PreviewErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('ModelPreview crashed:', error, info)
  }

  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}

const PreviewFallback = () => (
  <div style={{
    width: '100%', height: '300px', background: '#1a1a1a', borderRadius: '8px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#666', fontSize: '0.9rem', marginBottom: '1rem',
  }}>
    3D preview unavailable
  </div>
)

export const ModelPreview = ({ modelId }: ModelPreviewProps) => {
  const [canvasKey, setCanvasKey] = useState(() => Date.now())

  const handleCreated = useCallback((state: RootState) => {
    const canvas = state.gl.domElement
    canvas.addEventListener('webglcontextlost', (e: Event) => {
      e.preventDefault()
      setCanvasKey(Date.now())
    })
  }, [])

  return (
    <PreviewErrorBoundary fallback={<PreviewFallback />}>
      <div className="model-preview-container" style={{ width: '100%', height: '300px', background: '#1a1a1a', borderRadius: '8px', overflow: 'hidden', marginBottom: '1rem' }}>
        <Canvas key={canvasKey} shadows dpr={[1, 2]} camera={{ fov: 50 }} onCreated={handleCreated}>
          <Suspense fallback={null}>
            <RendererCleanup />
            <Stage environment="city" intensity={0.6}>
              <PreviewModel modelId={modelId} />
            </Stage>
            <OrbitControls autoRotate autoRotateSpeed={4} enableZoom={false} makeDefault />
          </Suspense>
        </Canvas>
      </div>
    </PreviewErrorBoundary>
  )
}
