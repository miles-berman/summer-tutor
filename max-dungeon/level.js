import { TILE, TILES } from "./constants.js"

const LEVEL = [
  "###########D########",
  "#..................#",
  "#..................#",
  "#....##....##......#",
  "#........##......###",
  "#.........@........#",
  "#..................#",
  "#......####........#",
  "#.................##",
  "#..................#",
  "####################",
]

export function buildLevel() {
  addLevel(LEVEL, {
    tileWidth: TILE,
    tileHeight: TILE,
    tiles: {
      ".": () => [sprite("tiles", { frame: TILES.FLOOR })],
      "@": () => [sprite("tiles", { frame: TILES.FLOOR })],
      "#": () => [
        sprite("tiles", { frame: TILES.WALL }),
        area(),
        body({ isStatic: true }),
        "wall",
      ],
      "D": () => [
        sprite("tiles", { frame: TILES.DOOR }),
        area(),
        body({ isStatic: true }),
        "door",
      ],
    },
  })

  let spawn = vec2(TILE, TILE)
  LEVEL.forEach((row, r) => {
    const c = row.indexOf("@")
    if (c >= 0) spawn = vec2(c * TILE + TILE / 2, r * TILE + TILE / 2)
  })

  return { spawn, cols: LEVEL[0].length, rows: LEVEL.length }
}