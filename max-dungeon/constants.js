export const TILE = 16
export const SPEED = 90

const COLS = 18
export function tile(col, row) {
  return row * COLS + col
}

export const TILES = {
  FLOOR: tile(9, 6),
  WALL: tile(4, 2),
  DOOR: tile(10, 4),
}