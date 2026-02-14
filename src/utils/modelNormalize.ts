import * as THREE from 'three'

const TARGET_HEIGHT = 1.8
const FBX_SCALE_THRESHOLD = 10

export function computeNormalizedScale(obj: THREE.Object3D): number {
  const box = new THREE.Box3().setFromObject(obj)
  const height = box.max.y - box.min.y
  if (height <= 0) return 1
  return TARGET_HEIGHT / height
}

/**
 * FBX-exported GLBs have scale [100,100,100] on armature/mesh nodes (Blender cm→m convention).
 * SkinnedMesh applies bone world transforms (including this 100x) PLUS any external scale,
 * causing vertices to be double-scaled. Stripping the FBX scale and rebinding the skeleton
 * lets computeNormalizedScale work identically for FBX and native-scale models.
 * No-op for models already at scale [1,1,1].
 */
export function normalizeFBXScales(root: THREE.Object3D): void {
  let hasFBXScale = false
  root.traverse((node) => {
    if (node.scale && (Math.abs(node.scale.x) >= FBX_SCALE_THRESHOLD ||
        Math.abs(node.scale.y) >= FBX_SCALE_THRESHOLD ||
        Math.abs(node.scale.z) >= FBX_SCALE_THRESHOLD)) {
      hasFBXScale = true
    }
  })

  if (!hasFBXScale) return

  bakeScalesIntoSkinnedGeometry(root)

  root.traverse((node) => {
    if (!node.scale || (Math.abs(node.scale.x) < FBX_SCALE_THRESHOLD &&
        Math.abs(node.scale.y) < FBX_SCALE_THRESHOLD &&
        Math.abs(node.scale.z) < FBX_SCALE_THRESHOLD)) return
    node.scale.set(1, 1, 1)
  })

  root.updateMatrixWorld(true)

  const processedSkeletons = new Set<THREE.Skeleton>()

  root.traverse((node) => {
    if (node instanceof THREE.SkinnedMesh && node.skeleton) {
      if (!processedSkeletons.has(node.skeleton)) {
        node.skeleton.calculateInverses()
        processedSkeletons.add(node.skeleton)
      }
      node.bind(node.skeleton, node.matrixWorld)
    }
  })
}

/**
 * SkinnedMesh vertices are in local space. When a SkinnedMesh (or its parent Group)
 * carries a large FBX scale that differs from the armature's scale, stripping scales
 * and rebinding the skeleton produces mismatched transforms. Fix: multiply the scale
 * factor directly into vertex positions BEFORE stripping, so all meshes share the
 * same coordinate space as the armature bones after normalization.
 */
function bakeScalesIntoSkinnedGeometry(root: THREE.Object3D): void {
  root.traverse((node) => {
    if (!(node instanceof THREE.SkinnedMesh)) return

    let scaleFactor = 1
    if (Math.abs(node.scale.x) >= FBX_SCALE_THRESHOLD) {
      scaleFactor = node.scale.x
    } else if (node.parent && Math.abs(node.parent.scale.x) >= FBX_SCALE_THRESHOLD) {
      scaleFactor = node.parent.scale.x
    }
    if (scaleFactor === 1) return

    const posAttr = node.geometry.attributes.position
    if (!posAttr) return
    for (let i = 0; i < posAttr.count; i++) {
      posAttr.setXYZ(
        i,
        posAttr.getX(i) * scaleFactor,
        posAttr.getY(i) * scaleFactor,
        posAttr.getZ(i) * scaleFactor,
      )
    }
    posAttr.needsUpdate = true

    if (node.geometry.attributes.normal) {
      node.geometry.attributes.normal.needsUpdate = true
    }
    node.geometry.computeBoundingBox()
    node.geometry.computeBoundingSphere()
  })
}
