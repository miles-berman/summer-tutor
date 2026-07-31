import kaplay from "https://unpkg.com/kaplay@3001.0.19/dist/kaplay.mjs"
import { TILE } from "./constants.js"
import { loadAssets } from "./assets.js"
import { buildLevel } from "./level.js"
import { makePlayer, defaultStats } from "./player.js"
import { spawnEnemy } from "./enemy.js"

kaplay({ background: [22, 20, 30], crisp: true })

loadAssets()

// ---- scoring: depth-and-kills, with a persistent best kept in localStorage ----
const HS_KEY = "maxDungeonHighScore"
const BEST_LEVEL_KEY = "maxDungeonBestLevel"  // highest level ever reached
const RUNS_KEY = "maxDungeonRuns"             // total runs played (deaths)
const KILL_POINTS = 10
const CLEAR_POINTS = 100
const BOSS_POINTS = 300

// ---- currency: coins are spendable in the shop, earned from kills and from
// clearing a level cleanly (the less damage you take, the bigger the bonus) ----
const KILL_COINS = 2
const BOSS_COINS = 20
const CLEAR_COINS = 5      // flat reward for clearing a level
const FLAWLESS_BONUS = 10  // max bonus, for taking zero damage
const DMG_PENALTY = 2      // bonus lost per point of HP damage taken

const COUNTDOWN = 3        // "3 / 2 / 1 / GO" before a level's timer starts

// every 5th floor is a boss arena
const isBossLevel = (level) => level % 5 === 0

// ---- shop pool: three offered after each level, bought with coins. Values are
// modest and capped so nothing (especially speed) spirals out of control.
// `icon` is the sprite name for the card art — all share upg_boot for now; give
// an upgrade its own by loading a sprite in assets.js and changing its icon. ----
const UPGRADES = [
  { name: "Vitality",        desc: "+2 max HP",               price: 12, icon: "upg_heart", apply: (s) => { s.maxHp += 2 } },
  { name: "Sharpened Blade", desc: "+1 jab damage",           price: 15, icon: "upg_blade", apply: (s) => { s.quickDamage += 1 } },
  { name: "Heavy Splash",    desc: "+1 splash damage",        price: 15, icon: "upg_sharpsplash", apply: (s) => { s.splashDamage += 1 } },
  { name: "Wide Splash",     desc: "+6 splash radius",        price: 10, icon: "upg_bigsplash", apply: (s) => { s.splashRadius = Math.min(56, s.splashRadius + 6) } },
  { name: "Swift Feet",      desc: "+6 move speed",           price: 12, icon: "upg_boot", apply: (s) => { s.speed = Math.min(126, s.speed + 6) } },
  { name: "Quick Hands",     desc: "faster jabs",             price: 14, icon: "upg_hands", apply: (s) => { s.quickCd = Math.max(0.09, s.quickCd - 0.015) } },
  { name: "Splash Recovery", desc: "shorter splash cooldown", price: 12, icon: "upg_clock", apply: (s) => { s.splashCd = Math.max(0.9, s.splashCd - 0.15) } },
]

function pickThree() {
  const pool = [...UPGRADES]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, 3)
}

// ---------- small HUD primitives ----------
function drawHeart(cx, cy, s, col) {
  const r = s * 0.5
  drawCircle({ pos: vec2(cx - r * 0.5, cy - r * 0.25), radius: r * 0.62, color: col })
  drawCircle({ pos: vec2(cx + r * 0.5, cy - r * 0.25), radius: r * 0.62, color: col })
  drawPolygon({ pts: [vec2(cx - r, cy - r * 0.05), vec2(cx + r, cy - r * 0.05), vec2(cx, cy + r)], color: col })
}

function drawCoin(cx, cy, r) {
  drawCircle({ pos: vec2(cx, cy), radius: r, color: rgb(238, 196, 72) })
  drawCircle({ pos: vec2(cx, cy), radius: r * 0.62, color: rgb(206, 158, 54) })
}

function fmtTime(sec) {
  const t = Math.max(0, Math.floor(sec))
  const m = Math.floor(t / 60)
  const r = t % 60
  return `${m}:${String(r).padStart(2, "0")}`
}

// boss health bar along the bottom of the screen
function drawBossBar(boss) {
  const bar = add([fixed(), z(100)])
  bar.onDraw(() => {
    if (!boss.exists() || boss.dead) return
    const W = width() * 0.6, h = 10
    const x0 = (width() - W) / 2, y0 = height() - 22
    const ratio = boss.maxHp > 0 ? Math.max(0, boss.hp / boss.maxHp) : 0
    drawRect({ pos: vec2(x0 - 2, y0 - 2), width: W + 4, height: h + 4, radius: 3, color: rgb(15, 14, 20) })
    drawRect({ pos: vec2(x0, y0), width: W, height: h, radius: 2, color: rgb(45, 40, 55) })
    drawRect({ pos: vec2(x0, y0), width: W * ratio, height: h, radius: 2, color: rgb(200, 70, 90) })
    drawText({ text: "BOSS", size: 10, pos: vec2(width() / 2, y0 - 11), anchor: "center", color: rgb(220, 180, 210) })
  })
  return bar
}

// ---- cleared a level: spend coins in the shop before descending ----
scene("upgrade", (level, stats, summary = {}) => {
  const choices = pickThree()
  const sold = [false, false, false]

  function buy(i) {
    const u = choices[i]
    if (!u || sold[i] || stats.coins < u.price) return
    stats.coins -= u.price
    u.apply(stats)
    sold[i] = true
  }
  const descend = () => go("play", level + 1, stats)

  // ui object also holds the highlighted row so keyboard + gamepad can navigate
  const ui = add([fixed(), z(100), "shopui", { sel: 0 }])
  const moveSel = (d) => { ui.sel = (ui.sel + d + choices.length) % choices.length }

  // keyboard: number keys buy directly; arrows/WASD move the cursor; space buys
  // the highlighted item; enter descends
  onKeyPress("1", () => buy(0))
  onKeyPress("2", () => buy(1))
  onKeyPress("3", () => buy(2))
  onKeyPress("up", () => moveSel(-1));   onKeyPress("w", () => moveSel(-1))
  onKeyPress("down", () => moveSel(1));  onKeyPress("s", () => moveSel(1))
  onKeyPress("space", () => buy(ui.sel))
  onKeyPress("enter", descend)

  // gamepad: d-pad moves the cursor, A buys, Start/B descends
  onGamepadButtonPress("dpad-up", () => moveSel(-1))
  onGamepadButtonPress("dpad-down", () => moveSel(1))
  onGamepadButtonPress("south", () => buy(ui.sel))
  onGamepadButtonPress("start", descend)
  onGamepadButtonPress("east", descend)

  // left stick menu nav, latched so one flick = one step
  let stickLatched = false
  onUpdate(() => {
    const y = getGamepadStick("left").y
    if (!stickLatched && Math.abs(y) > 0.5) { moveSel(y > 0 ? 1 : -1); stickLatched = true }
    else if (Math.abs(y) < 0.3) stickLatched = false
  })

  ui.onDraw(() => {
    const W = width(), H = height()
    drawRect({ pos: vec2(0, 0), width: W, height: H, color: rgb(16, 14, 22) })

    drawText({ text: `LEVEL ${level} CLEARED`, size: 13, pos: vec2(W / 2, 40), anchor: "center", color: rgb(180, 175, 195) })
    drawText({ text: "SHOP", size: 30, pos: vec2(W / 2, 68), anchor: "center", color: rgb(245, 240, 250) })

    // coin balance
    drawCoin(W / 2 - 34, 104, 9)
    drawText({ text: `${stats.coins}`, size: 22, pos: vec2(W / 2 - 20, 104), anchor: "left", color: rgb(245, 215, 90) })

    // clear reward feedback
    if (summary.earned != null) {
      const msg = summary.flawless
        ? `FLAWLESS CLEAR!  +${summary.earned} coins`
        : `cleared with ${summary.dmgTaken} dmg taken  ·  +${summary.earned} coins`
      drawText({ text: msg, size: 12, pos: vec2(W / 2, 132), anchor: "center",
        color: summary.flawless ? rgb(130, 240, 150) : rgb(190, 185, 205) })
    }

    // item cards
    const cardW = Math.min(470, W - 80), x0 = (W - cardW) / 2
    const top = 158, rowH = 62
    choices.forEach((u, i) => {
      const y = top + i * rowH
      const afford = stats.coins >= u.price
      const selected = i === ui.sel
      const bg = sold[i] ? rgb(26, 40, 30) : (afford ? rgb(32, 30, 44) : rgb(34, 26, 30))
      const edge = selected ? rgb(130, 225, 255)
        : (sold[i] ? rgb(70, 120, 80) : (afford ? rgb(90, 82, 120) : rgb(80, 60, 66)))
      drawRect({ pos: vec2(x0, y), width: cardW, height: 52, radius: 6, color: bg,
        outline: { color: edge, width: selected ? 2 : 1 } })
      // cursor marker for the highlighted row
      if (selected) {
        drawPolygon({ pts: [vec2(x0 - 16, y + 20), vec2(x0 - 16, y + 32), vec2(x0 - 7, y + 26)], color: rgb(130, 225, 255) })
      }
      drawText({ text: `${i + 1}`, size: 16, pos: vec2(x0 + 16, y + 26), anchor: "center", color: rgb(225, 220, 238) })
      // custom pixel-art icon
      drawSprite({ sprite: u.icon, pos: vec2(x0 + 52, y + 26), width: 40, height: 40, anchor: "center" })
      drawText({ text: u.name, size: 15, pos: vec2(x0 + 80, y + 16), anchor: "left", color: rgb(240, 235, 248) })
      drawText({ text: u.desc, size: 11, pos: vec2(x0 + 80, y + 35), anchor: "left", color: rgb(178, 172, 194) })
      if (sold[i]) {
        drawText({ text: "SOLD", size: 14, pos: vec2(x0 + cardW - 22, y + 26), anchor: "right", color: rgb(140, 225, 160) })
      } else {
        drawCoin(x0 + cardW - 60, y + 26, 6)
        drawText({ text: `${u.price}`, size: 15, pos: vec2(x0 + cardW - 48, y + 26), anchor: "left",
          color: afford ? rgb(245, 215, 90) : rgb(190, 95, 95) })
      }
    })

    drawText({ text: "move ↕    ·    1–3 / (A) buy    ·    Enter / Start descend", size: 12,
      pos: vec2(W / 2, top + 3 * rowH + 12), anchor: "center", color: rgb(175, 172, 192) })
  })
})

// ---- one level of play ----
scene("play", (level, stats, opts = {}) => {
  const s = stats || defaultStats()
  const secret = !!opts.secret
  let best = getData(HS_KEY) ?? 0

  // track the deepest level ever reached
  if (level > (getData(BEST_LEVEL_KEY) ?? 0)) setData(BEST_LEVEL_KEY, level)

  function addScore(n) {
    s.score += n
    if (s.score > best) {
      best = s.score
      setData(HS_KEY, best)
    }
  }
  const addCoins = (n) => { s.coins += n }

  // countdown / level timer state
  const sceneStartAt = time()
  let running = false
  let levelStartAt = 0
  let goUntil = 0
  const isActive = () => running

  let doorOpen = false
  let ended = false

  // easter egg: on level 6, once the room is cleared, mashing attack 6x quickly
  // (each within 1s) opens a secret room
  let combo = 0
  let lastAttackAt = 0
  const onAttack = () => {
    const now = time()
    combo = now - lastAttackAt < 1 ? combo + 1 : 1
    lastAttackAt = now
    if (!secret && level === 6 && combo >= 6 && !ended &&
        get("enemy").filter((e) => !e.dead).length === 0) {
      ended = true
      go("play", 6, s, { secret: true })
    }
  }

  const boss = isBossLevel(level)
  const { spawn, enemySpawns, bossSpawn, critterSpawns, cols, rows, openDoor, isWallAt } =
    buildLevel(level, { boss, secret })
  const player = makePlayer(spawn, s, isWallAt, isActive, onAttack)

  if (secret) {
    const bossObj = spawnEnemy(bossSpawn, level, {
      onKill: () => { addScore(BOSS_POINTS); addCoins(BOSS_COINS) }, boss: true, isWallAt, isActive,
    })
    drawBossBar(bossObj)
    critterSpawns.forEach((p) => spawnEnemy(p, level, { critter: true, isActive }))
  } else if (boss) {
    const bossObj = spawnEnemy(bossSpawn, level, {
      onKill: () => { addScore(BOSS_POINTS); addCoins(BOSS_COINS) }, boss: true, isWallAt, isActive,
    })
    drawBossBar(bossObj)
  } else {
    enemySpawns.forEach((p) => spawnEnemy(p, level, {
      onKill: () => { addScore(KILL_POINTS); addCoins(KILL_COINS) }, isWallAt, isActive,
    }))
  }

  const banner = add([text("", { size: 15 }), pos(width() / 2, 42), anchor("top"), fixed(), z(100)])
  if (secret) banner.text = "✨ a secret room ✨"
  else if (boss) banner.text = "A giant guards the exit!"

  // ---------- HUD ----------
  const hud = add([fixed(), z(100)])
  hud.onDraw(() => {
    const W = width()
    // top panel
    drawRect({ pos: vec2(0, 0), width: W, height: 30, color: rgb(18, 16, 24), opacity: 0.82 })
    drawRect({ pos: vec2(0, 30), width: W, height: 2, color: rgb(44, 40, 56), opacity: 0.9 })

    // HP hearts (left)
    const max = player.maxHp
    if (max <= 12) {
      for (let i = 0; i < max; i++) {
        drawHeart(14 + i * 15, 15, 12, i < player.hp ? rgb(232, 72, 92) : rgb(52, 48, 62))
      }
    } else {
      drawHeart(14, 15, 12, rgb(232, 72, 92))
      drawText({ text: `${player.hp}/${max}`, size: 12, pos: vec2(26, 15), anchor: "left", color: rgb(240, 232, 236) })
    }

    // center: level · timer · enemies
    const alive = get("enemy").filter((e) => !e.dead).length
    const tsec = running ? time() - levelStartAt : 0
    const midLabel = (boss || secret) ? "BOSS" : `${alive} left`
    drawText({ text: `LV ${level}    ·    ${fmtTime(tsec)}    ·    ${midLabel}`,
      size: 13, pos: vec2(W / 2, 15), anchor: "center", color: rgb(232, 228, 242) })

    // right: coins (prominent) + score/best (dim, secondary line)
    drawCoin(W - 92, 15, 7)
    drawText({ text: `${s.coins}`, size: 15, pos: vec2(W - 80, 15), anchor: "left", color: rgb(245, 215, 90) })
    drawText({ text: `SCORE ${s.score}   BEST ${best}`, size: 9, pos: vec2(W - 8, 41), anchor: "right", color: rgb(150, 148, 165) })

    // countdown overlay
    if (!running) {
      const remain = COUNTDOWN - (time() - sceneStartAt)
      const n = Math.ceil(remain)
      drawRect({ pos: vec2(0, 0), width: W, height: height(), color: rgb(10, 9, 14), opacity: 0.4 })
      drawText({ text: `${n}`, size: 72, pos: vec2(W / 2, height() / 2 - 6), anchor: "center", color: rgb(245, 240, 250) })
      drawText({ text: "get ready", size: 14, pos: vec2(W / 2, height() / 2 + 46), anchor: "center", color: rgb(200, 195, 212) })
      drawText({ text: "move: stick / WASD     ·     attack: A / space", size: 11,
        pos: vec2(W / 2, height() / 2 + 66), anchor: "center", color: rgb(150, 146, 165) })
    } else if (time() < goUntil) {
      drawText({ text: "GO!", size: 60, pos: vec2(W / 2, height() / 2 - 6), anchor: "center", color: rgb(150, 240, 160), opacity: Math.max(0, (goUntil - time()) / 0.6) })
    }
  })

  onUpdate(() => {
    // start the level once the countdown elapses
    if (!running && time() - sceneStartAt >= COUNTDOWN) {
      running = true
      levelStartAt = time()
      goUntil = time() + 0.6
    }

    const alive = get("enemy").filter((e) => !e.dead).length
    if (running && !doorOpen && alive === 0) {
      doorOpen = true
      openDoor()
      banner.text = "The exit is open!"
    }

    if (player.dead && !ended) {
      ended = true
      banner.text = "You died..."
      setData(RUNS_KEY, (getData(RUNS_KEY) ?? 0) + 1)  // count this run
      wait(1.2, () => go("gameover", level, s.score))
    }
  })

  // reach the exit -> reward coins by how clean the clear was -> shop -> descend
  player.onCollide("door", () => {
    if (ended) return
    ended = true
    const dmgTaken = Math.max(0, player.maxHp - player.hp)
    const flawless = dmgTaken === 0
    const earned = CLEAR_COINS + Math.max(0, FLAWLESS_BONUS - dmgTaken * DMG_PENALTY)
    addScore(CLEAR_POINTS)
    addCoins(earned)
    go("upgrade", level, s, { flawless, dmgTaken, earned })
  })

  const w = cols * TILE
  const h = rows * TILE
  setCamScale(Math.min(width() / w, height() / h))
  setCamPos(w / 2, h / 2)
})

// ---- game over: this run's result + lifetime stats, restart on a key ----
scene("gameover", (level, score) => {
  const bestLevel = getData(BEST_LEVEL_KEY) ?? 0
  const best = getData(HS_KEY) ?? 0
  const runs = getData(RUNS_KEY) ?? 0
  const restart = () => go("play", 1, defaultStats())
  onKeyPress("space", restart)
  onKeyPress("enter", restart)
  onGamepadButtonPress("south", restart)
  onGamepadButtonPress("start", restart)

  const ui = add([fixed(), z(100)])
  ui.onDraw(() => {
    const W = width(), H = height(), cx = W / 2
    drawRect({ pos: vec2(0, 0), width: W, height: H, color: rgb(16, 14, 22) })
    drawText({ text: "GAME OVER", size: 34, pos: vec2(cx, H / 2 - 120), anchor: "center", color: rgb(240, 120, 130) })
    drawText({ text: `You reached Level ${level}`, size: 17, pos: vec2(cx, H / 2 - 74), anchor: "center", color: rgb(232, 228, 242) })
    drawText({ text: `Score  ${score}`, size: 13, pos: vec2(cx, H / 2 - 50), anchor: "center", color: rgb(200, 196, 214) })

    // lifetime stats
    drawText({ text: "— lifetime —", size: 11, pos: vec2(cx, H / 2 - 8), anchor: "center", color: rgb(140, 138, 156) })
    drawText({ text: `Highest Level   ${bestLevel}`, size: 15, pos: vec2(cx, H / 2 + 18), anchor: "center", color: rgb(245, 215, 90) })
    drawText({ text: `High Score   ${best}`, size: 15, pos: vec2(cx, H / 2 + 42), anchor: "center", color: rgb(245, 215, 90) })
    drawText({ text: `Runs Played   ${runs}`, size: 15, pos: vec2(cx, H / 2 + 66), anchor: "center", color: rgb(200, 196, 214) })

    drawText({ text: "press Space / A to try again", size: 12, pos: vec2(cx, H / 2 + 112), anchor: "center", color: rgb(175, 172, 192) })
  })
})

go("play", 1, defaultStats())
