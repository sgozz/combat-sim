export const HEX_SIZE = 1

export type HexCube = {
  q: number
  r: number
  s: number
}

export const hexToWorld = (q: number, r: number): [number, number] => {
  const x = HEX_SIZE * (Math.sqrt(3) * (q + r / 2))
  const z = HEX_SIZE * (1.5 * r)
  return [x, z]
}

export const worldToHex = (x: number, z: number): { q: number; r: number } => {
  const q = (Math.sqrt(3) / 3 * x - 1 / 3 * z) / HEX_SIZE
  const r = (2 / 3 * z) / HEX_SIZE

  const cubeX = q
  const cubeZ = r
  const cubeY = -cubeX - cubeZ

  let rx = Math.round(cubeX)
  let ry = Math.round(cubeY)
  let rz = Math.round(cubeZ)

  const xDiff = Math.abs(rx - cubeX)
  const yDiff = Math.abs(ry - cubeY)
  const zDiff = Math.abs(rz - cubeZ)

  if (xDiff > yDiff && xDiff > zDiff) {
    rx = -ry - rz
  } else if (yDiff > zDiff) {
    ry = -rx - rz
  } else {
    rz = -rx - ry
  }

  return { q: rx, r: rz }
}

export const hexDistance = (q1: number, r1: number, q2: number, r2: number): number => {
  return (Math.abs(q1 - q2) + Math.abs(q1 + r1 - q2 - r2) + Math.abs(r1 - r2)) / 2
}

export const getHexInDirection = (q: number, r: number, direction: number): { q: number; r: number } => {
  const directions = [
    { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
    { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
  ];
  // Ensure positive modulo
  const d = directions[(direction % 6 + 6) % 6];
  return { q: q + d.q, r: r + d.r };
}
