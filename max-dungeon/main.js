import kaplay from "https://unpkg.com/kaplay@3001.0.19/dist/kaplay.mjs"

kaplay({
  background: [22, 20, 30],
  crisp: true,
})

// ======================================================
// Assets
// ======================================================

loadSprite("tiles", "sprites/tiles.png", {
  sliceX: 18,
  sliceY: 7,
})

// ======================================================
// Constants
// ======================================================

const TILE = 16
const SPEED = 90

function tile(col, row) {
  return row * 18 + col
}

const TILES = {
  FLOOR: tile(8, 6),
  WALL: tile(4, 2),
  DOOR: tile(10, 4),
}

// ======================================================
// Level Layout
// ======================================================

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

// ======================================================
// Find Player Spawn
// ======================================================

let spawn = vec2(TILE, TILE)

LEVEL.forEach((row, r) => {
  const c = row.indexOf("@")

  if (c >= 0) {
    spawn = vec2(
      c * TILE + TILE / 2,
      r * TILE + TILE / 2,
    )
  }
})

// ======================================================
// Build Level
// ======================================================

addLevel(LEVEL, {
  tileWidth: TILE,
  tileHeight: TILE,

  tiles: {
    ".": () => [
      sprite("tiles", { frame: TILES.FLOOR }),
    ],

    "@": () => [
      sprite("tiles", { frame: TILES.FLOOR }),
    ],

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

// ======================================================
// Player
// ======================================================

const player = add([
  rect(12, 14),
  color(220, 180, 90),
  anchor("center"),
  pos(spawn),
  area(),
  body(),
  "player",
])

// ======================================================
// Movement
// ======================================================

const moves = {
  left: () => player.move(-SPEED, 0),
  right: () => player.move(SPEED, 0),
  up: () => player.move(0, -SPEED),
  down: () => player.move(0, SPEED),
}

for (const [key, fn] of Object.entries(moves)) {
  onKeyDown(key, fn)
}

onKeyDown("a", moves.left)
onKeyDown("d", moves.right)
onKeyDown("w", moves.up)
onKeyDown("s", moves.down)

// ======================================================
// Interactions
// ======================================================

player.onCollide("door", () => {
  debug.log("You found the exit!")
})

// ======================================================
// Camera
// ======================================================

const cols = LEVEL[0].length
const rows = LEVEL.length

const levelWidth = cols * TILE
const levelHeight = rows * TILE

// Auto-fit the level to the screen
const zoomX = width() / levelWidth
const zoomY = height() / levelHeight

camScale(Math.min(zoomX, zoomY) * 0.9)

camPos(
  levelWidth / 2,
  levelHeight / 2,
)