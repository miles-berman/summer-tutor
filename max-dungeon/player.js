import { attachAnim, attackSprite } from "./anim.js"

const HIT_KNOCKBACK = 260   // px/s shove when the player is hit
const INVULN_TIME = 0.7     // i-frames after a hit
const HIT_LOCK = 0.25       // control lock while flinching

// ---- quick attack (tap / spam): fast, sharp jab in the facing direction ----
const QUICK_LOCK = 0.12     // control lock per jab (short, so you stay mobile)
const QUICK_SPEED = 44      // anim fps
const QUICK_ACTIVE = 0.10   // hitbox live time
const QUICK_REACH = 15
const QUICK_W = 20
const QUICK_H = 16

// ---- splash attack (hold to FULL charge, release): heavy AoE, long cooldown --
const CHARGE_SHOW = 0.12    // when the charge ring starts showing
const FULL_CHARGE = 0.5     // must hold this long for a splash to be available
const SPLASH_LOCK = 0.42
const SPLASH_SPEED = 18
const SPLASH_ACTIVE = 0.20

// Baseline player stats. Upgrades between levels mutate a copy of this.
export function defaultStats() {
  return {
    maxHp: 5,
    speed: 90,
    quickDamage: 1,
    quickCd: 0.14,     // min time between jabs (lower = faster)
    splashDamage: 2,
    splashRadius: 30,
    splashCd: 1.4,     // long: splash is a committed move, not spammable
    score: 0,          // run score, carried across levels via the stats object
  }
}

export function makePlayer(spawn, stats = defaultStats(), isWallAt = () => false) {
  const player = add([
    sprite("idle_down", { anim: "main" }),
    anchor("center"),
    scale(0.5),
    pos(spawn),
    area({ shape: new Rect(vec2(0), 18, 16) }),
    body(),
    opacity(1),
    "player",
    {
      stats,
      facing: "down",
      action: null,        // null | "attack" | "hit"
      actionUntil: 0,
      dead: false,
      hp: stats.maxHp,
      maxHp: stats.maxHp,
      kb: vec2(0),
      invuln: 0,
      charging: false,
      chargeStart: 0,
      spaceDown: false,
      nextQuickAt: 0,
      nextSplashAt: 0,
    },
  ])

  attachAnim(player, "idle_down")

  const dirs = {
    left:  { keys: ["left", "a"],  vec: vec2(-1, 0) },
    right: { keys: ["right", "d"], vec: vec2(1, 0) },
    up:    { keys: ["up", "w"],    vec: vec2(0, -1) },
    down:  { keys: ["down", "s"],  vec: vec2(0, 1) },
  }

  function readInput() {
    let dx = 0, dy = 0, moving = false, facing = player.facing
    for (const [name, d] of Object.entries(dirs)) {
      if (d.keys.some(isKeyDown)) {
        dx += d.vec.x; dy += d.vec.y; facing = name; moving = true
      }
    }
    return { dx, dy, moving, facing }
  }

  // is the straight line from a->b clear of walls? (samples between the ends,
  // skipping the endpoints so standing next to a wall doesn't self-block)
  function hasLineOfSight(a, b) {
    const d = b.sub(a)
    const dist = d.len()
    const steps = Math.max(2, Math.ceil(dist / 4))
    for (let i = 1; i < steps; i++) {
      const p = a.add(d.scale(i / steps))
      if (isWallAt(p.x, p.y)) return false
    }
    return true
  }

  // ---------- hitboxes ----------
  function spawnHitbox({ shape, follow, active, damage }) {
    const box = add([
      pos(follow()),
      anchor("center"),
      area({ shape }),
      "playerHitbox",
      { struck: new Set() },
    ])
    box.onUpdate(() => { box.pos = follow() })
    box.onCollideUpdate("enemy", (e) => {
      if (box.struck.has(e)) return                    // one hit per swing
      if (!hasLineOfSight(player.pos, e.pos)) return    // no hitting through walls
      box.struck.add(e)
      e.hurt?.(damage, player.pos)
    })
    wait(active, () => destroy(box))
    return box
  }

  function spawnRing(at, radius, col) {
    const ring = add([pos(0, 0), z(49), { t: 0 }])
    ring.onUpdate(() => { ring.t += dt(); if (ring.t > 0.28) destroy(ring) })
    ring.onDraw(() => {
      const f = ring.t / 0.28
      drawCircle({
        pos: at, radius: 6 + f * radius, fill: false,
        outline: { color: col, width: 2 }, opacity: 1 - f,
      })
    })
  }

  // ---------- attacks ----------
  function quickAttack() {
    if (player.dead || player.action === "hit") return
    if (time() < player.nextQuickAt) return
    player.action = "attack"
    player.actionUntil = time() + QUICK_LOCK
    player.nextQuickAt = time() + player.stats.quickCd
    const dir = player.facing
    player.show(`attack_${attackSprite(dir)}_stay`, { loop: false, speed: QUICK_SPEED, restart: true })
    const off = dirs[dir].vec.scale(QUICK_REACH)
    spawnHitbox({
      shape: new Rect(vec2(0), QUICK_W, QUICK_H),
      follow: () => player.pos.add(off),
      active: QUICK_ACTIVE,
      damage: player.stats.quickDamage,
    })
  }

  // only fires when fully charged AND off cooldown; otherwise falls back to a jab
  function splashAttack() {
    if (player.dead || player.action === "hit") return
    if (time() < player.nextSplashAt) { quickAttack(); return }
    const r = player.stats.splashRadius
    player.action = "attack"
    player.actionUntil = time() + SPLASH_LOCK
    player.nextSplashAt = time() + player.stats.splashCd
    player.nextQuickAt = time() + 0.2
    player.show(`attack_${attackSprite(player.facing)}_stay`, { loop: false, speed: SPLASH_SPEED, restart: true })
    spawnHitbox({
      shape: new Rect(vec2(0), r * 2, r * 2),
      follow: () => player.pos,
      active: SPLASH_ACTIVE,
      damage: player.stats.splashDamage,
    })
    spawnRing(player.pos, r, rgb(120, 220, 255))
  }

  // ---------- take damage ----------
  player.hurt = (dmg = 1, fromPos = null) => {
    if (player.dead || player.invuln > 0) return
    player.hp = Math.max(0, player.hp - dmg)
    player.invuln = INVULN_TIME
    if (fromPos) {
      const away = player.pos.sub(fromPos)
      player.kb = (away.len() > 0 ? away.unit() : vec2(0, 1)).scale(HIT_KNOCKBACK)
    }
    if (player.hp <= 0) {
      player.dead = true
      player.action = null
      player.charging = false
      player.opacity = 1
      player.show("die", { loop: false, speed: 12, restart: true })
      return
    }
    player.action = "hit"
    player.actionUntil = time() + HIT_LOCK
    player.show("hit", { loop: false, speed: 10, restart: true })
  }

  // ---------- input ----------
  // Tap or short hold = jab (spammable). Hold to full charge, then release = splash.
  onKeyPress("space", () => {
    if (player.dead) return
    player.spaceDown = true
    player.chargeStart = time()
    player.charging = false
  })

  onKeyRelease("space", () => {
    if (!player.spaceDown) return
    player.spaceDown = false
    player.charging = false
    if (player.dead) return
    const held = time() - player.chargeStart
    if (held >= FULL_CHARGE) splashAttack()
    else quickAttack()
  })

  // charge feedback ring — fills as you hold; turns red when a splash is ready.
  // Purely visual: the splash only fires on release (no auto-fire, no hold-spam).
  const chargeFx = add([pos(0, 0), z(48)])
  chargeFx.onDraw(() => {
    if (!player.charging || player.dead) return
    const f = Math.min(1, (time() - player.chargeStart) / FULL_CHARGE)
    const ready = f >= 1 && time() >= player.nextSplashAt
    drawCircle({
      pos: player.pos, radius: 10 + f * 16, fill: false,
      outline: { color: ready ? rgb(255, 140, 140) : rgb(120, 220, 255), width: 2 },
      opacity: 0.85,
    })
  })

  // ---------- per-frame movement (fixed 50Hz step) ----------
  // Running movement on the fixed step means a lag spike is replayed as several
  // small, wall-collision-checked steps instead of one big teleport — no clipping.
  player.onFixedUpdate(() => {
    // build charge visual while holding (no auto-fire)
    if (player.spaceDown && !player.dead) {
      if (time() - player.chargeStart >= CHARGE_SHOW) player.charging = true
    }

    // i-frame flicker
    if (player.invuln > 0) {
      player.invuln -= dt()
      player.opacity = Math.floor(time() * 20) % 2 ? 0.35 : 1
      if (player.invuln <= 0) player.opacity = 1
    }

    // clear timed action locks
    if (player.action && time() >= player.actionUntil) player.action = null

    // knockback (built-in body() handles wall collision)
    if (player.kb.len() > 4) {
      player.move(player.kb)
      player.kb = player.kb.scale(0.82)
    }

    if (player.dead || player.action) return

    const { dx, dy, moving, facing } = readInput()
    player.facing = facing
    if (moving) {
      player.move(dx * player.stats.speed, dy * player.stats.speed)
      player.showWalk(facing)
    } else {
      player.showIdle(facing)
    }
  })

  player.onCollideUpdate("enemy", (e) => player.hurt(e.dmg ?? 1, e.pos))

  return player
}
