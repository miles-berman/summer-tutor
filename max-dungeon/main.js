import kaplay from "https://unpkg.com/kaplay@3001.0.19/dist/kaplay.mjs"

// Start Kaplay. It makes the canvas for us.
kaplay({
  background: [22, 20, 30],
  crisp: true,        // keep pixel art sharp instead of blurry
})

// ----- Load the tilesheet and slice it -----
// "Set 1.1.png" is 18 tiles across and 7 down, so we tell Kaplay that.
// (Rename your sheet to sprites/tiles.png, or change the path here.)
loadSprite("tiles", "sprites/tiles.png", {
  sliceX: 18,
  sliceY: 7,
})

const TILE = 16
const SPEED = 90   // player speed in pixels per second

// Each tile gets a frame number, counted left-to-right, top-to-bottom.
// The formula is:  frame = row * 18 + column   (use the overview image to pick)
const FLOOR = 0            // c0_r0
const WALL  = 2 * 18 + 4   // c4_r2  ->  frame 40

// ----- The level, drawn as ASCII art -----
// Edit this picture to design the dungeon:
//   # = wall (solid)   . = floor   @ = where the player starts
const LAYOUT = [
  "####################",
  "#..................#",
  "#..................#",
  "#....##....##......#",
  "#....##....##......#",
  "#.........@........#",
  "#..................#",
  "#......####........#",
  "#......#..........##",
  "#..................#",
  "####################",
]

addLevel(LAYOUT, {
  tileWidth: TILE,
  tileHeight: TILE,
  tiles: {
    // floor under normal cells AND under the player's start
    ".": () => [sprite("tiles", { frame: FLOOR })],
    "@": () => [sprite("tiles", { frame: FLOOR })],
    // walls are solid: area() gives them a hitbox, body(isStatic) makes them immovable
    "#": () => [
      sprite("tiles", { frame: WALL }),
      area(),
      body({ isStatic: true }),
      "wall",
    ],
  },
})

// ----- The player -----
// Find the "@" in the level art and spawn the player at its center.
let spawn = vec2(TILE, TILE)
LAYOUT.forEach((row, r) => {
  const c = row.indexOf("@")
  if (c >= 0) spawn = vec2(c * TILE + TILE / 2, r * TILE + TILE / 2)
})

const player = add([
  rect(12, 14),                 // placeholder block; swap for sprite("tiles", {frame: ...}) later
  color(220, 180, 90),
  anchor("center"),
  pos(spawn),
  area(),
  body(),                       // dynamic body -> walls stop it automatically
  "player",
])

// ----- Movement -----
const moves = {
  left:  () => player.move(-SPEED, 0),
  right: () => player.move(SPEED, 0),
  up:    () => player.move(0, -SPEED),
  down:  () => player.move(0, SPEED),
}
for (const [key, fn] of Object.entries(moves)) onKeyDown(key, fn)
// WASD mirrors the arrow keys
onKeyDown("a", moves.left)
onKeyDown("d", moves.right)
onKeyDown("w", moves.up)
onKeyDown("s", moves.down)

// ----- Camera: zoom in and center on the room -----
const cols = LAYOUT[0].length
const rows = LAYOUT.length
camScale(3)
camPos((cols * TILE) / 2, (rows * TILE) / 2)