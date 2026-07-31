import { TILE, TILES } from "./constants.js"

const COLS = 20
const ROWS = 13

// ---- tilesheet dressing (frames on the 18x7 "tiles" sheet) ----
// These add ground variety beyond plain floor/wall. They were picked by
// analyzing the sheet (alpha coverage + pixel position), not by eye, so if any
// frame looks wrong in-game just add/remove indices here — they're purely
// cosmetic and never block movement.
//
// Floor variants: near-identical flat floor tiles, mixed in so the ground isn't
// one repeated texture. TILES.FLOOR is weighted heavily so variants stay subtle.
const FLOOR_FRAMES = [TILES.FLOOR, TILES.FLOOR, TILES.FLOOR, TILES.FLOOR, TILES.FLOOR, 116, 98, 113]
// Decorations: small transparent-background props (bones/rubble/cracks/etc.)
// that sit ON a floor cell. All are bottom-heavy/centered ground objects.
const DECOR_FRAMES = [100, 102, 103, 104, 105, 119, 123]
const DECOR_CHANCE = 0.09  // fraction of eligible floor cells that get a prop

const pickFloor = () => FLOOR_FRAMES[Math.floor(Math.random() * FLOOR_FRAMES.length)]

const cellCenter = (c, r) => vec2(c * TILE + TILE / 2, r * TILE + TILE / 2)
const key = (c, r) => `${c},${r}`

// Flood-fill the floor reachable from (sc, sr). Walls are "#"/"X".
function reachableFrom(grid, sc, sr) {
  const seen = new Set([key(sc, sr)])
  const stack = [[sc, sr]]
  while (stack.length) {
    const [c, r] = stack.pop()
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc, nr = r + dr
      if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue
      if (grid[nr][nc] === "#" || grid[nr][nc] === "X") continue
      const k = key(nc, nr)
      if (seen.has(k)) continue
      seen.add(k)
      stack.push([nc, nr])
    }
  }
  return seen
}

// Build one random room. Returns the grid plus spawn/door/enemy cells,
// guaranteed traversable (player can reach the door and every enemy).
// Boss rooms are open arenas (no wall clusters) so the giant has room to roam.
function generate(level, boss = false, secret = false) {
  const open = boss || secret  // open arena (no wall clusters)
  for (let attempt = 0; attempt < 60; attempt++) {
    // start: floor interior, solid border
    const grid = []
    for (let r = 0; r < ROWS; r++) {
      const row = []
      for (let c = 0; c < COLS; c++) {
        const border = c === 0 || c === COLS - 1 || r === 0 || r === ROWS - 1
        row.push(border ? "#" : ".")
      }
      grid.push(row)
    }

    // sealed exit on the top wall (rendered as a wall until cleared)
    const doorCol = 2 + Math.floor(Math.random() * (COLS - 4))
    grid[0][doorCol] = "X"

    // scatter wall clusters (more, and larger, as levels climb) — skipped for
    // boss arenas, which stay open.
    if (!open) {
      const clusters = 4 + Math.min(level, 8)
      for (let i = 0; i < clusters; i++) {
        const w = 1 + Math.floor(Math.random() * 3)
        const h = 1 + Math.floor(Math.random() * 3)
        const c0 = 2 + Math.floor(Math.random() * (COLS - 4 - w))
        const r0 = 3 + Math.floor(Math.random() * (ROWS - 6 - h))
        for (let r = r0; r < r0 + h; r++)
          for (let c = c0; c < c0 + w; c++) grid[r][c] = "#"
      }
    }

    // keep the cell directly under the door walkable
    grid[1][doorCol] = "."

    // player spawn near the bottom center, cleared
    const spawnCell = { c: Math.floor(COLS / 2), r: ROWS - 2 }
    grid[spawnCell.r][spawnCell.c] = "."

    // must be able to reach the door's approach cell
    const reach = reachableFrom(grid, spawnCell.c, spawnCell.r)
    if (!reach.has(key(doorCol, 1))) continue

    // secret easter-egg room: one boss plus a handful of aimless critters
    if (secret) {
      const bossCell = { c: Math.floor(COLS / 2), r: 3 }
      const critterCells = []
      for (const k of reach) {
        const [c, r] = k.split(",").map(Number)
        if (r <= 1) continue
        if (Math.abs(c - spawnCell.c) + Math.abs(r - spawnCell.r) < 3) continue
        if (Math.abs(c - bossCell.c) + Math.abs(r - bossCell.r) < 2) continue
        critterCells.push({ c, r })
      }
      for (let i = critterCells.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[critterCells[i], critterCells[j]] = [critterCells[j], critterCells[i]]
      }
      return { grid, spawnCell, doorCol, enemyCells: [], bossCell, critterCells: critterCells.slice(0, 7) }
    }

    // boss arena: one giant near the top-center, no regular mobs
    if (boss) {
      const bossCell = { c: Math.floor(COLS / 2), r: 3 }
      return { grid, spawnCell, doorCol, enemyCells: [], bossCell, critterCells: [] }
    }

    // pick enemy spawns from reachable floor, away from the player & door
    const candidates = []
    for (const k of reach) {
      const [c, r] = k.split(",").map(Number)
      const nearPlayer = Math.abs(c - spawnCell.c) + Math.abs(r - spawnCell.r) < 4
      const nearDoor = Math.abs(c - doorCol) + Math.abs(r - 1) < 2
      if (!nearPlayer && !nearDoor) candidates.push({ c, r })
    }
    const enemyCount = Math.min(2 + Math.floor((level - 1) / 2), 6)
    if (candidates.length < enemyCount) continue

    // shuffle, take the first N
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[candidates[i], candidates[j]] = [candidates[j], candidates[i]]
    }
    const enemyCells = candidates.slice(0, enemyCount)

    return { grid, spawnCell, doorCol, enemyCells, bossCell: null, critterCells: [] }
  }

  // fallback: empty room if generation kept failing
  const grid = []
  for (let r = 0; r < ROWS; r++) {
    const row = []
    for (let c = 0; c < COLS; c++) {
      const border = c === 0 || c === COLS - 1 || r === 0 || r === ROWS - 1
      row.push(border ? "#" : ".")
    }
    grid.push(row)
  }
  const doorCol = Math.floor(COLS / 2)
  grid[0][doorCol] = "X"
  const spawnCell = { c: Math.floor(COLS / 2), r: ROWS - 2 }
  return {
    grid,
    spawnCell,
    doorCol,
    enemyCells: (boss || secret) ? [] : [{ c: 4, r: 3 }, { c: COLS - 5, r: 3 }],
    bossCell: (boss || secret) ? { c: Math.floor(COLS / 2), r: 3 } : null,
    critterCells: secret ? [{ c: 4, r: 4 }, { c: COLS - 5, r: 4 }, { c: 6, r: 8 }] : [],
  }
}

export function buildLevel(level = 1, { boss = false, secret = false } = {}) {
  const { grid, spawnCell, doorCol, enemyCells, bossCell, critterCells } = generate(level, boss, secret)

  addLevel(grid.map((row) => row.join("")), {
    tileWidth: TILE,
    tileHeight: TILE,
    tiles: {
      ".": () => [sprite("tiles", { frame: pickFloor() })],
      "#": () => [
        sprite("tiles", { frame: TILES.WALL }),
        area(),
        body({ isStatic: true }),
        "wall",
      ],
      // sealed exit: looks like a wall and blocks, until openDoor() runs
      "X": () => [
        sprite("tiles", { frame: TILES.WALL }),
        area(),
        body({ isStatic: true }),
        "wall",
        "doorwall",
      ],
    },
  })

  // Scatter cosmetic props on floor cells for a more lived-in look. These are
  // plain sprites (no area/body) placed exactly over a cell, so they align with
  // the grid and never affect movement or line-of-sight. Added here — after the
  // floor, before the player is spawned — so they layer above ground, below
  // actors. Kept clear of the spawn and the exit approach.
  for (let r = 2; r < ROWS - 1; r++) {
    for (let c = 1; c < COLS - 1; c++) {
      if (grid[r][c] !== ".") continue
      if (Math.abs(c - spawnCell.c) + Math.abs(r - spawnCell.r) < 3) continue
      if (Math.abs(c - doorCol) + Math.abs(r - 1) < 3) continue
      if (Math.random() >= DECOR_CHANCE) continue
      add([
        sprite("tiles", { frame: DECOR_FRAMES[Math.floor(Math.random() * DECOR_FRAMES.length)] }),
        pos(c * TILE, r * TILE),
        z(0),
        "decor",
      ])
    }
  }

  // reveal the exit: remove the sealed wall, drop in a walkable door
  function openDoor() {
    get("doorwall").forEach(destroy)
    add([
      sprite("tiles", { frame: TILES.DOOR }),
      pos(doorCol * TILE, 0),
      area(),
      "door",
    ])
  }

  // world-space solid test (for attack line-of-sight)
  function isWallAt(x, y) {
    const c = Math.floor(x / TILE)
    const r = Math.floor(y / TILE)
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return true
    const ch = grid[r][c]
    return ch === "#" || ch === "X"
  }

  return {
    spawn: cellCenter(spawnCell.c, spawnCell.r),
    enemySpawns: enemyCells.map((e) => cellCenter(e.c, e.r)),
    bossSpawn: bossCell ? cellCenter(bossCell.c, bossCell.r) : null,
    critterSpawns: (critterCells || []).map((e) => cellCenter(e.c, e.r)),
    isBoss: boss,
    cols: COLS,
    rows: ROWS,
    openDoor,
    isWallAt,
  }
}
