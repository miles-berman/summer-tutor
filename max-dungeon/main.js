import kaplay from "https://unpkg.com/kaplay@3001.0.19/dist/kaplay.mjs"
import { TILE } from "./constants.js"
import { loadAssets } from "./assets.js"
import { buildLevel } from "./level.js"
import { makePlayer, defaultStats } from "./player.js"
import { spawnEnemy } from "./enemy.js"

kaplay({ background: [22, 20, 30], crisp: true })

loadAssets()

// ---- upgrade pool: one of three after each cleared level. Values are modest
// and capped so nothing (especially speed) spirals out of control. ----
const UPGRADES = [
  { name: "Vitality",        desc: "+2 max HP",               apply: (s) => { s.maxHp += 2 } },
  { name: "Sharpened Blade", desc: "+1 jab damage",           apply: (s) => { s.quickDamage += 1 } },
  { name: "Heavy Splash",    desc: "+1 splash damage",        apply: (s) => { s.splashDamage += 1 } },
  { name: "Wide Splash",     desc: "+6 splash radius",        apply: (s) => { s.splashRadius = Math.min(56, s.splashRadius + 6) } },
  { name: "Swift Feet",      desc: "+6 move speed",           apply: (s) => { s.speed = Math.min(126, s.speed + 6) } },
  { name: "Quick Hands",     desc: "faster jabs",             apply: (s) => { s.quickCd = Math.max(0.09, s.quickCd - 0.015) } },
  { name: "Splash Recovery", desc: "shorter splash cooldown", apply: (s) => { s.splashCd = Math.max(0.9, s.splashCd - 0.15) } },
]

function pickThree() {
  const pool = [...UPGRADES]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, 3)
}

// screen-space health bar: segmented pips that recolor green -> red as HP drops
function drawHealthBar(player) {
  const x0 = 6, y0 = 24
  const hpRef = { value: player.hp }
  const bar = add([fixed(), z(100)])
  bar.onUpdate(() => { hpRef.value = player.hp })
  bar.onDraw(() => {
    const max = player.maxHp
    const ratio = max > 0 ? hpRef.value / max : 0
    // recolor from green (healthy) through yellow to red (critical)
    const g = Math.round(200 * Math.min(1, ratio * 1.6))
    const r = Math.round(200 * Math.min(1, (1 - ratio) * 1.8))
    const fill = rgb(r + 30, g + 30, 55)
    const empty = rgb(40, 38, 50)
    const edge = rgb(15, 14, 20)

    if (max <= 20) {
      const pipW = 9, gap = 3, h = 11
      for (let i = 0; i < max; i++) {
        const x = x0 + i * (pipW + gap)
        drawRect({ pos: vec2(x, y0), width: pipW, height: h, radius: 2,
          color: empty, outline: { color: edge, width: 1 } })
        if (i < hpRef.value)
          drawRect({ pos: vec2(x, y0), width: pipW, height: h, radius: 2, color: fill })
      }
    } else {
      const W = 170, h = 12
      drawRect({ pos: vec2(x0, y0), width: W, height: h, radius: 3,
        color: empty, outline: { color: edge, width: 1 } })
      drawRect({ pos: vec2(x0, y0), width: W * Math.max(0, ratio), height: h, radius: 3, color: fill })
    }
  })
  return bar
}

// ---- cleared a level: choose an upgrade before continuing ----
scene("upgrade", (level, stats) => {
  const choices = pickThree()

  add([text(`LEVEL ${level} CLEARED`, { size: 20 }), pos(width() / 2, height() / 2 - 70),
    anchor("center"), fixed(), z(100)])
  add([text("Choose an upgrade — press 1, 2, or 3", { size: 12 }),
    pos(width() / 2, height() / 2 - 40), anchor("center"), fixed(), z(100)])

  choices.forEach((u, i) => {
    add([text(`${i + 1}.  ${u.name}  —  ${u.desc}`, { size: 14 }),
      pos(width() / 2, height() / 2 + i * 28), anchor("center"), fixed(), z(100)])
    onKeyPress(`${i + 1}`, () => {
      u.apply(stats)
      go("play", level + 1, stats)
    })
  })
})

// ---- one level of play ----
scene("play", (level, stats) => {
  const s = stats || defaultStats()
  const { spawn, enemySpawns, cols, rows, openDoor, isWallAt } = buildLevel(level)
  const player = makePlayer(spawn, s, isWallAt)
  enemySpawns.forEach((p) => spawnEnemy(p, level))

  let doorOpen = false
  let ended = false

  const info = add([text("", { size: 10 }), pos(6, 6), fixed(), z(100)])
  drawHealthBar(player)
  const banner = add([
    text("", { size: 16 }), pos(width() / 2, 26), anchor("top"), fixed(), z(100),
  ])

  onUpdate(() => {
    const alive = get("enemy").filter((e) => !e.dead).length

    if (!doorOpen && alive === 0) {
      doorOpen = true
      openDoor()
      banner.text = "The exit is open!"
    }

    info.text = player.dead
      ? `LEVEL ${level}   —  YOU DIED`
      : `LEVEL ${level}      ENEMIES ${alive}`

    if (player.dead && !ended) {
      ended = true
      banner.text = "You died — restarting run..."
      wait(1.5, () => go("play", 1, defaultStats()))
    }
  })

  // reach the exit -> upgrade screen -> next (harder) level
  player.onCollide("door", () => {
    if (ended) return
    ended = true
    go("upgrade", level, s)
  })

  const w = cols * TILE
  const h = rows * TILE
  camScale(Math.min(width() / w, height() / h))
  camPos(w / 2, h / 2)
})

go("play", 1, defaultStats())
