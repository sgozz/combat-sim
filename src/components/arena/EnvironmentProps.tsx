import { useRef, useMemo, useEffect } from 'react'
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

const KNOWN_ASSET_IDS = new Set([
  // dungeon
  'wall', 'wall_corner', 'floor', 'pillar', 'crate', 'barrel', 'door',
  'barrel_damaged', 'table', 'chair', 'bookshelf', 'torch_wall', 'brazier', 'banner',
  // wilderness
  'tree_01', 'tree_02', 'rock_01', 'rock_02', 'bush', 'grass',
  'trunk', 'stump', 'mushroom_red', 'flower_purple',
  // desert
  'cactus_tall', 'cactus_short', 'rock_sand', 'bones', 'dead_bush',
  // graveyard
  'gravestone_1', 'gravestone_2', 'tomb', 'tree_dead', 'fence_iron', 'lantern',
])

const FALLBACK_CONFIG: Record<string, { color: string; geometry: 'box' | 'cylinder' | 'sphere' | 'cone'; dims: [number, number, number] }> = {
  barrel_damaged: { color: '#8B4513', geometry: 'cylinder', dims: [0.3, 0.3, 0.8] },
  table: { color: '#5D4037', geometry: 'box', dims: [1.2, 0.1, 0.8] },
  chair: { color: '#5D4037', geometry: 'box', dims: [0.4, 0.5, 0.4] },
  bookshelf: { color: '#3E2723', geometry: 'box', dims: [0.8, 1.5, 0.3] },
  torch_wall: { color: '#FFD700', geometry: 'cone', dims: [0.1, 0.3, 8] },
  brazier: { color: '#333', geometry: 'cylinder', dims: [0.4, 0.3, 8] },
  banner: { color: '#880000', geometry: 'box', dims: [0.6, 1.2, 0.05] },
  
  trunk: { color: '#5D4037', geometry: 'cylinder', dims: [0.2, 1.5, 8] },
  stump: { color: '#5D4037', geometry: 'cylinder', dims: [0.3, 0.3, 8] },
  mushroom_red: { color: '#FF0000', geometry: 'sphere', dims: [0.2, 16, 16] },
  flower_purple: { color: '#9C27B0', geometry: 'sphere', dims: [0.15, 8, 8] },
  
  cactus_tall: { color: '#2E7D32', geometry: 'cylinder', dims: [0.2, 1.8, 8] },
  cactus_short: { color: '#4CAF50', geometry: 'cylinder', dims: [0.25, 0.8, 8] },
  rock_sand: { color: '#D2B48C', geometry: 'sphere', dims: [0.6, 4, 2] },
  bones: { color: '#EEEEEE', geometry: 'box', dims: [0.4, 0.1, 0.4] },
  dead_bush: { color: '#8D6E63', geometry: 'sphere', dims: [0.4, 4, 4] },
  
  gravestone_1: { color: '#757575', geometry: 'box', dims: [0.4, 0.6, 0.1] },
  gravestone_2: { color: '#616161', geometry: 'box', dims: [0.4, 0.5, 0.1] },
  tomb: { color: '#424242', geometry: 'box', dims: [0.8, 0.5, 1.2] },
  tree_dead: { color: '#3E2723', geometry: 'cylinder', dims: [0.3, 2.5, 6] },
  fence_iron: { color: '#212121', geometry: 'box', dims: [1.0, 0.8, 0.05] },
  lantern: { color: '#FFD700', geometry: 'box', dims: [0.2, 0.3, 0.2] },
}

export const EnvironmentProps = ({ mapDefinition, gridType }: EnvironmentPropsProps) => {
  const gridSystem = gridType === 'square' ? squareGrid8 : hexGrid

  const propGroups = useMemo(() => {
    if (!mapDefinition) return []

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

  if (!mapDefinition) return null

  return (
    <group>
      {propGroups.map((group) => (
        KNOWN_ASSET_IDS.has(group.propId) ? (
          <GLTFPropRenderer key={group.propId} group={group} />
        ) : (
          <FallbackPropRenderer key={group.propId} group={group} />
        )
      ))}
    </group>
  )
}

const GLTFPropRenderer = ({ group }: { group: PropGroup }) => {
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

  useEffect(() => {
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

const FallbackPropRenderer = ({ group }: { group: PropGroup }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const config = useMemo(
    () => FALLBACK_CONFIG[group.propId] ?? { color: '#FF00FF', geometry: 'box' as const, dims: [0.5, 0.5, 0.5] as [number, number, number] },
    [group.propId]
  )

  const geometry = useMemo(() => {
    switch (config.geometry) {
      case 'cylinder': return new THREE.CylinderGeometry(config.dims[0], config.dims[0], config.dims[1], config.dims[2] || 8)
      case 'sphere': return new THREE.SphereGeometry(config.dims[0], config.dims[1] || 8, config.dims[2] || 8)
      case 'cone': return new THREE.ConeGeometry(config.dims[0], config.dims[1], config.dims[2] || 8)
      case 'box':
      default: return new THREE.BoxGeometry(config.dims[0], config.dims[1], config.dims[2])
    }
  }, [config])

  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({ 
      color: config.color,
      roughness: 0.8,
      metalness: 0.1
    })
  }, [config])

  useEffect(() => {
    if (!meshRef.current) return
    const mesh = meshRef.current
    const dummy = new THREE.Object3D()

    // Adjust pivot to bottom for most shapes
    const yOffset = config.geometry === 'box' ? config.dims[1] / 2 
                  : config.geometry === 'cylinder' || config.geometry === 'cone' ? config.dims[1] / 2
                  : config.dims[0]; // sphere

    for (let i = 0; i < group.instances.length; i++) {
      const inst = group.instances[i]
      dummy.position.set(inst.position[0], inst.position[1] + yOffset, inst.position[2])
      dummy.rotation.set(0, inst.rotation, 0)
      
      if (group.propId === 'trunk' || group.propId === 'bones') {
         dummy.rotation.x = Math.PI / 2
         dummy.position.y = 0.1
      }

      dummy.scale.setScalar(group.scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [group, config])

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, group.instances.length]}
      castShadow
      receiveShadow
    />
  )
}
