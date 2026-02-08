import { useMemo, useEffect, useRef, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF, OrbitControls, Stage } from '@react-three/drei'
import * as THREE from 'three'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import { getModelEntry } from '../../data/modelRegistry'
import type { ModelEntry } from '../../data/modelRegistry'

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

function findBoneByName(root: THREE.Object3D, name: string): THREE.Bone | null {
  let found: THREE.Bone | null = null
  root.traverse((child) => {
    if (child instanceof THREE.Bone && child.name === name) {
      found = child
    }
  })
  return found
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

  const { clonedScene, normalizedScale } = useMemo(() => {
    const clone = SkeletonUtils.clone(scene)
    prepareCloneMaterials(clone)
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

const CompositePreviewModel = ({ model }: { model: ModelEntry }) => {
  const composite = model.composite!
  const bodyGltf = useGLTF(composite.body)
  const animGltf = useGLTF(composite.animationSrc)
  const outfitGltf = useGLTF(composite.outfit ?? composite.body)
  const weaponGltf = useGLTF(composite.weapon ?? composite.body)
  const hasOutfit = !!composite.outfit
  const hasWeapon = !!composite.weapon

  const mixerRef = useRef<THREE.AnimationMixer | null>(null)

  const { assembledGroup, normalizedScale } = useMemo(() => {
    const group = new THREE.Group()

    const bodyClone = SkeletonUtils.clone(bodyGltf.scene)
    group.add(bodyClone)

    const scale = computeNormalizedScale(bodyClone)

    if (hasOutfit) {
      const outfitClone = SkeletonUtils.clone(outfitGltf.scene)
      prepareCloneMaterials(outfitClone)

      let bodySkeleton: THREE.Skeleton | null = null
      bodyClone.traverse((child) => {
        if (child instanceof THREE.SkinnedMesh && child.skeleton) {
          bodySkeleton = child.skeleton
          child.visible = false
        }
      })

      if (bodySkeleton) {
        const skel = bodySkeleton as THREE.Skeleton
        outfitClone.traverse((child) => {
          if (child instanceof THREE.SkinnedMesh) {
            child.skeleton = skel
            child.bind(skel)
          }
        })
      }

      group.add(outfitClone)
    } else {
      prepareCloneMaterials(bodyClone)
    }

    if (hasWeapon) {
      const weaponClone = weaponGltf.scene.clone(true)
      weaponClone.scale.setScalar(0.01)
      const handBone = findBoneByName(bodyClone, 'hand_r')
      if (handBone) {
        handBone.add(weaponClone)
      }
    }

    return { assembledGroup: group, normalizedScale: scale }
  }, [bodyGltf.scene, outfitGltf.scene, weaponGltf.scene, hasOutfit, hasWeapon])

  useEffect(() => {
    const mixer = new THREE.AnimationMixer(assembledGroup)
    mixerRef.current = mixer

    const idleClipName = model.animations.idle
    const idleClip = animGltf.animations.find(c => c.name === idleClipName)
    if (idleClip) {
      mixer.clipAction(idleClip).play()
    }

    return () => { mixer.stopAllAction() }
  }, [assembledGroup, animGltf.animations, model.animations])

  useFrame((_, delta) => { mixerRef.current?.update(delta) })

  return (
    <primitive
      object={assembledGroup}
      scale={normalizedScale}
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
