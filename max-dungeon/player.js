import { attachAnim, attackSprite, facingFromVec } from "./anim.js"

const STICK_DEADZONE = 0.28  // ignore small left-stick drift

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
    splashDamage: 4,
    splashRadius: 30,
    splashCd: 1.4,     // long: splash is a committed move, not spammable
    score: 0,          // run score, carried across levels via the stats object
    coins: 0,          // spendable currency, carried across levels
  }
}

export function makePlayer(spawn, stats = defaultStats(), isWallAt = () => false, isActive = () => true, onAttack = () => {}) {
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
      stunUntil: 0,        // time() until which movement/attacks are blocked
      charging: false,
      chargeStart: 0,
      attackHeld: false, // is the attack button (space or gamepad) held?
      stickVec: vec2(0), // left-stick vector, cached each frame (see below)
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

  // Movement from any source: keyboard, gamepad d-pad, or left analog stick.
  // The combined vector is clamped to length 1 so diagonals / full-stick aren't
  // faster than a cardinal press (and partial stick tilt = a slower walk).
  function readInput() {
    let dx = 0, dy = 0
    for (const d of Object.values(dirs)) {
      if (d.keys.some(isKeyDown)) { dx += d.vec.x; dy += d.vec.y }
    }
    if (isGamepadButtonDown("dpad-left"))  dx -= 1
    if (isGamepadButtonDown("dpad-right")) dx += 1
    if (isGamepadButtonDown("dpad-up"))    dy -= 1
    if (isGamepadButtonDown("dpad-down"))  dy += 1
    const st = player.stickVec
    if (Math.abs(st.x) > STICK_DEADZONE) dx += st.x
    if (Math.abs(st.y) > STICK_DEADZONE) dy += st.y

    const mag = Math.sqrt(dx * dx + dy * dy)
    if (mag > 1) { dx /= mag; dy /= mag }
    const moving = mag > 0.001
    const facing = moving ? facingFromVec(dx, dy, player.facing) : player.facing
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

  // ---------- stun (from the boss's pot) ----------
  // Freezes movement and attacks for a few seconds. Doesn't grant i-frames, so
  // a stunned player is a sitting duck — dodge the pot or pay for it.
  player.isStunned = () => !player.dead && time() < player.stunUntil
  player.stun = (dur = 1.5) => {
    if (player.dead) return
    player.stunUntil = Math.max(player.stunUntil, time() + dur)
    player.action = null
    player.charging = false
    player.attackHeld = false
  }

  // ---------- input ----------
  // Tap or short hold = jab (spammable). Hold to full charge, then release = splash.
  // Works from the keyboard (space) or a gamepad (A / south button).
  function beginAttack() {
    if (player.dead || player.isStunned() || !isActive() || player.attackHeld) return
    player.attackHeld = true
    player.chargeStart = time()
    player.charging = false
  }
  function endAttack() {
    if (!player.attackHeld) return
    player.attackHeld = false
    player.charging = false
    if (player.dead || player.isStunned()) return
    const held = time() - player.chargeStart
    if (held >= FULL_CHARGE) splashAttack()
    else quickAttack()
    onAttack()
  }

  onKeyPress("space", beginAttack)
  onKeyRelease("space", endAttack)
  onGamepadButtonPress("south", beginAttack)
  onGamepadButtonRelease("south", endAttack)

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

  // dazed stars orbiting overhead while stunned
  const stunFx = add([pos(0, 0), z(51)])
  stunFx.onDraw(() => {
    if (!player.isStunned()) return
    const cx = player.pos.x, cy = player.pos.y - 16
    for (let i = 0; i < 3; i++) {
      const a = time() * 4 + i * (Math.PI * 2 / 3)
      drawCircle({
        pos: vec2(cx + Math.cos(a) * 9, cy + Math.sin(a) * 3),
        radius: 2.2, color: rgb(255, 230, 120),
      })
    }
  })

  // ---------- per-frame movement (fixed 50Hz step) ----------
  // Running movement on the fixed step means a lag spike is replayed as several
  // small, wall-collision-checked steps instead of one big teleport — no clipping.
  player.onFixedUpdate(() => {
    // pre-level countdown: frozen, no input, no attacks
    if (!isActive()) {
      player.showIdle(player.facing)
      return
    }

    // build charge visual while holding (no auto-fire; not while stunned)
    if (player.attackHeld && !player.dead && !player.isStunned()) {
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

    // knockback (built-in body() handles wall collision) — still shoves a
    // stunned player, they just can't act under their own power
    if (player.kb.len() > 4) {
      player.move(player.kb)
      player.kb = player.kb.scale(0.82)
    }

    if (player.dead) return

    // stunned: frozen in place, no input, no attacks
    if (player.isStunned()) {
      player.showIdle(player.facing)
      return
    }

    if (player.action) return

    const { dx, dy, moving, facing } = readInput()
    player.facing = facing
    if (moving) {
      player.move(dx * player.stats.speed, dy * player.stats.speed)
      player.showWalk(facing)
    } else {
      player.showIdle(facing)
    }
  })

  // contact damage — but a dead enemy still lingers (with its "enemy" tag and
  // hitbox) while its death animation plays, so skip corpses.
  player.onCollideUpdate("enemy", (e) => {
    if (e.dead) return
    player.hurt(e.dmg ?? 1, e.pos)
  })

  // The gamepad stick is only valid during the per-frame update (it's polled
  // then, and zeroed at frame end). Movement runs on the fixed step, which
  // happens before the poll — so cache the stick here and read it there.
  player.onUpdate(() => { player.stickVec = getGamepadStick("left") })

  return player
}
