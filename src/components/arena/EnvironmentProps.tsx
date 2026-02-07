import { useRef, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import type { MapDefinition } from '../../../shared/map/types'
import type { GridType } from '../../../shared/grid/types'
import { hexGrid, squareGrid8 } from '../../../shared/grid'
import { getAssetById } from '../../data/environmentAssets'

type EnvironmentPropsProps = {
  mapDefinition: MapDefinition | undefined
  gridType: GridType
}

type PropGroup = {
  propId: string
  path: string
  scale: number
  instances: { position: [number, number, number]; rotation: number }[]
}

export const EnvironmentProps = ({ mapDefinition, gridType }: EnvironmentPropsProps) => {
  if (!mapDefinition) return null

  const gridSystem = gridType === 'square' ? squareGrid8 : hexGrid

  const propGroups = useMemo(() => {
    const groups = new Map<string, PropGroup>()

    for (const cell of mapDefinition.cells) {
      if (!cell.propId) continue

      const asset = getAssetById(cell.propId)
      if (!asset) continue

      if (!groups.has(cell.propId)) {
        groups.set(cell.propId, {
          propId: cell.propId,
          path: asset.path,
          scale: asset.scale,
          instances: [],
        })
      }

      const worldPos = gridSystem.coordToWorld({ q: cell.q, r: cell.r })
      groups.get(cell.propId)!.instances.push({
        position: [worldPos.x, 0, worldPos.z],
        rotation: cell.propRotation ?? 0,
      })
    }

    return Array.from(groups.values())
  }, [mapDefinition, gridSystem])

  return (
    <group>
      {propGroups.map((group) => (
        <PropGroupRenderer key={group.propId} group={group} />
      ))}
    </group>
  )
}

const PropGroupRenderer = ({ group }: { group: PropGroup }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const { scene } = useGLTF(group.path)

  const geometry = useMemo(() => {
    let geo: THREE.BufferGeometry | null = null
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh && !geo) {
        geo = child.geometry
      }
    })
    return geo ?? new THREE.BoxGeometry(0.5, 0.5, 0.5)
  }, [scene])

  const material = useMemo(() => {
    let mat: THREE.Material | null = null
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh && !mat) {
        mat = child.material as THREE.Material
      }
    })
    return mat ?? new THREE.MeshStandardMaterial({ color: '#666' })
  }, [scene])

  useMemo(() => {
    if (!meshRef.current) return
    const mesh = meshRef.current
    const dummy = new THREE.Object3D()

    for (let i = 0; i < group.instances.length; i++) {
      const inst = group.instances[i]
      dummy.position.set(inst.position[0], inst.position[1], inst.position[2])
      dummy.rotation.set(0, inst.rotation, 0)
      dummy.scale.setScalar(group.scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [group])

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, group.instances.length]}
      castShadow
      receiveShadow
    />
  )
}
