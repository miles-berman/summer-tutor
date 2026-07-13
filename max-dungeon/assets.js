const BASE = "sprites/tiny-questers-warrior-free/png"

function frames(name, count) {
  return Array.from({ length: count }, (_, i) =>
    `${BASE}/single/${name}/${name}${i + 1}.png`)
}

export function loadAssets() {
  loadSprite("tiles", "sprites/tiles.png", { sliceX: 18, sliceY: 7 })

  // idle — only down + up exist. 320x49 strip = 5 frames @ 64x49
  for (const dir of ["down", "up"]) {
    loadSprite(`idle_${dir}`, `${BASE}/atlas/idle_${dir}.png`, {
      sliceX: 5,
      anims: { main: { from: 0, to: 4, loop: true, speed: 6 } },
    })
  }

  // walk — all 4. 256x49 strip = 4 frames @ 64x49
  for (const dir of ["down", "up", "left", "right"]) {
    loadSprite(`walk_${dir}`, `${BASE}/atlas/walk_${dir}.png`, {
      sliceX: 4,
      anims: { main: { from: 0, to: 3, loop: true, speed: 10 } },
    })
  }

  // attacks — moving + in-place "_stay", 128x128 single frames
  const counts = { down: 20, up: 20, left: 18, right: 18 }
  for (const [dir, n] of Object.entries(counts)) {
    for (const suffix of ["", "_stay"]) {
      const name = `attack_${dir}${suffix}`
      loadSprite(name, frames(name, n), {
        anims: { main: { from: 0, to: n - 1, loop: false, speed: 30 } },
      })
    }
  }

  // hit — 128x49 strip = 2 frames @ 64x49 (non-directional flinch)
  loadSprite("hit", `${BASE}/atlas/hit.png`, {
    sliceX: 2,
    anims: { main: { from: 0, to: 1, loop: false, speed: 10 } },
  })

  // die loaded but unused for now (skipping per request)
  loadSprite("die", `${BASE}/atlas/die.png`, {
    sliceX: 10,
    anims: { main: { from: 0, to: 9, loop: false, speed: 12 } },
  })
}