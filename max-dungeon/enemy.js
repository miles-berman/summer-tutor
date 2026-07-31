import { attachAnim, attackSprite, facingFromVec } from "./anim.js"

const ENEMY_SPEED = 48
const ENEMY_HP = 3
const ENEMY_KNOCKBACK = 200
const ATTACK_RANGE = 18      // distance at which a mob plants and starts a swing
const ATTACK_HIT_RANGE = 24  // the swing connects if the player is still this close when it lands
const ATTACK_WINDUP = 0.22   // delay from swing start to the moment damage is dealt
const ATTACK_DURATION = 0.45 // time locked in the swing clip
const ENEMY_ATTACK_CD = 1.1
const HIT_LOCK = 0.2
const DIE_TIME = 0.85        // 10 frames @ 12fps

// ---- boss tuning (a giant, scaled-up mob with the same AI) ----
const BOSS_SCALE = 1.35
const BOSS_HP = (level) => 20 + level * 4
const BOSS_SPEED_MULT = 0.6   // lumbering: slower than a normal mob (and the player)
const BOSS_KNOCKBACK = 0       // immune: a giant isn't shoved by jabs. (Any
                               // knockback makes its AI skip a frame, and spammed
                               // jabs re-apply it faster than it decays, which
                               // would lock the boss out of ever acting.)
const BOSS_MASS = 10           // heavy: the player can't shove it around
const BOSS_MELEE_BONUS = 1     // hits harder in melee than a mob of the same level
const BOSS_ATTACK_RANGE = 28   // longer reach (big body, long arms)
const BOSS_HIT_RANGE = 46
const BOSS_TINT = [190, 90, 200] // purple — reads as "boss", not a normal red mob

// ---- pot throw (boss special) ----
const POT_CD = 4.0            // seconds between throws
const POT_WINDUP = 0.5        // telegraph before the pot leaves the hand
const POT_SPEED = 130         // px/s — dodgeable if you move perpendicular
const POT_STUN = 1.2          // seconds the player is frozen on a hit
const POT_SCALE = 1.0
const POT_MAX_RANGE = 340     // shatters after travelling this far
const POT_MIN_THROW_DIST = 40 // don't throw if the player is basically on top of us

// A thrown pot: flies toward where the player was, stuns on contact, and
// shatters on the player / a wall / max range. Moves on the fixed step so it
// can't tunnel past the player during a frame spike.
function throwPot(fromPos, targetPos, { isWallAt = () => false, stun = POT_STUN } = {}) {
  const dir = targetPos.sub(fromPos)
  const vel = (dir.len() > 0 ? dir.unit() : vec2(1, 0)).scale(POT_SPEED)

  const pot = add([
    sprite("pot"),
    anchor("center"),
    scale(POT_SCALE),
    pos(fromPos),
    rotate(0),
    area({ shape: new Rect(vec2(0), 12, 12) }),
    z(60),
    "pot",
    { vel, traveled: 0, done: false },
  ])

  function shatter() {
    if (pot.done) return
    pot.done = true
    spawnShatter(pot.pos)
    destroy(pot)
  }

  pot.onFixedUpdate(() => {
    if (pot.done) return
    const step = pot.vel.scale(dt())
    pot.pos = pot.pos.add(step)
    pot.traveled += step.len()
    pot.angle += 360 * dt() // spin in flight
    if (pot.traveled >= POT_MAX_RANGE) return shatter()
    if (isWallAt(pot.pos.x, pot.pos.y)) return shatter()
  })

  pot.onCollideUpdate("player", (pl) => {
    if (pot.done || pl.dead) return
    pl.stun?.(stun)
    shatter()
  })

  return pot
}

// little clay-shard puff when a pot breaks
function spawnShatter(at) {
  const fx = add([pos(0, 0), z(59), { t: 0 }])
  fx.onUpdate(() => { fx.t += dt(); if (fx.t > 0.3) destroy(fx) })
  fx.onDraw(() => {
    const f = fx.t / 0.3
    drawCircle({
      pos: at, radius: 4 + f * 20, fill: false,
      outline: { color: rgb(200, 150, 90), width: 2 }, opacity: 1 - f,
    })
  })
}

// `opts`: { onKill, boss, isWallAt }. A boss is a giant, slower, tankier mob
// that shares this AI but can also lob pots.
export function spawnEnemy(p, level = 1, opts = {}) {
  const { onKill = null, boss = false, isWallAt = () => false, isActive = () => true, critter = false } = opts

  const baseSpeed = Math.min(ENEMY_SPEED + (level - 1) * 3, 92)
  const hp = boss ? BOSS_HP(level) : ENEMY_HP + Math.floor(level * 0.75)
  const speed = critter ? 40 : boss ? Math.round(baseSpeed * BOSS_SPEED_MULT) : baseSpeed
  const dmg = 1 + Math.floor((level - 1) / 4) + (boss ? BOSS_MELEE_BONUS : 0)
  const atkCd = Math.max(0.55, ENEMY_ATTACK_CD - (level - 1) * 0.04)
  const knockback = boss ? BOSS_KNOCKBACK : ENEMY_KNOCKBACK
  const attackRange = boss ? BOSS_ATTACK_RANGE : ATTACK_RANGE
  const hitRange = boss ? BOSS_HIT_RANGE : ATTACK_HIT_RANGE
  const areaShape = boss ? new Rect(vec2(0), 30, 34) : new Rect(vec2(0), 18, 24)
  const baseTint = boss ? BOSS_TINT : [255, 110, 110]

  const e = add([
    sprite("idle_down", { anim: "main" }),
    color(...baseTint),
    anchor("center"),
    scale(boss ? BOSS_SCALE : 0.5),
    pos(p),
    area({ shape: areaShape }),
    body(boss ? { mass: BOSS_MASS } : {}),
    ...(critter ? ["critter"] : ["enemy", boss ? "boss" : "mob"]),
    {
      isBoss: boss,
      critter,
      wanderDir: vec2(0),
      wanderUntil: 0,
      dmg,
      speed,
      hp,
      maxHp: hp,
      kb: vec2(0),
      dead: false,
      facing: "down",
      action: null,        // null | "attack" | "hit"
      actionUntil: 0,
      atkCd: 0,
      flashUntil: 0,       // brief white hit-flash so hits read even without knockback
      swingAt: 0,          // time() a pending melee swing lands (0 = none)
      nextPotAt: 0,        // boss: earliest time() the next pot may be thrown
      potReleaseAt: 0,     // boss: time() the wound-up pot leaves the hand (0 = none)
    },
  ])

  attachAnim(e, "idle_down")

  e.hurt = (amount = 1, fromPos = null) => {
    if (e.dead) return
    e.hp -= amount
    e.flashUntil = time() + 0.07
    if (fromPos) {
      const away = e.pos.sub(fromPos)
      e.kb = (away.len() > 0 ? away.unit() : vec2(1, 0)).scale(knockback)
    }
    if (e.hp <= 0) {
      e.dead = true
      e.action = null
      e.swingAt = 0
      e.potReleaseAt = 0
      e.show("die", { loop: false, speed: 12, restart: true })
      onKill?.()
      wait(DIE_TIME, () => destroy(e))
      return
    }
    // Mobs flinch (and drop a wind-up) when hit; the boss shrugs it off and
    // keeps attacking, so it can't be jab-locked into never acting.
    if (!boss) {
      e.swingAt = 0
      e.action = "hit"
      e.actionUntil = time() + HIT_LOCK
      e.show("hit", { loop: false, speed: 10, restart: true })
    }
  }

  // Land a scheduled melee swing once its wind-up elapses (connects mid-clip,
  // not on body contact — so a stationary player still gets hit).
  function resolveSwing() {
    if (e.swingAt === 0 || time() < e.swingAt) return
    e.swingAt = 0
    const player = get("player")[0]
    if (player && !player.dead && player.pos.dist(e.pos) <= hitRange) {
      player.hurt(e.dmg, e.pos)
    }
  }

  // Release a wound-up pot toward the player's current position.
  function resolvePot() {
    if (e.potReleaseAt === 0 || time() < e.potReleaseAt) return
    e.potReleaseAt = 0
    const player = get("player")[0]
    if (!player || player.dead) return
    const aim = player.pos.sub(e.pos)
    const from = e.pos.add((aim.len() > 0 ? aim.unit() : vec2(0, 1)).scale(30)) // leave the giant's hands, not its belly
    throwPot(from, player.pos.clone(), { isWallAt, stun: POT_STUN })
  }

  // Physics + AI on the fixed 50Hz step. Big frame gaps get replayed as several
  // small, collision-checked steps, so it can never tunnel through a wall.
  e.onFixedUpdate(() => {
    if (e.dead) return

    // pre-level countdown: hold position, don't tick cooldowns
    if (!isActive()) {
      e.showIdle(e.facing)
      return
    }

    // critters just amble around aimlessly and never attack or chase
    if (e.critter) {
      if (time() >= e.wanderUntil) {
        const ang = Math.random() * Math.PI * 2
        e.wanderDir = Math.random() < 0.25 ? vec2(0) : vec2(Math.cos(ang), Math.sin(ang))
        e.wanderUntil = time() + 0.6 + Math.random() * 1.6
      }
      if (e.wanderDir.len() > 0) {
        e.move(e.wanderDir.scale(e.speed))
        e.facing = facingFromVec(e.wanderDir.x, e.wanderDir.y, e.facing)
        e.showWalk(e.facing)
      } else {
        e.showIdle(e.facing)
      }
      return
    }

    if (e.atkCd > 0) e.atkCd -= dt()
    if (e.action && time() >= e.actionUntil) e.action = null
    resolveSwing()
    if (e.isBoss) resolvePot()

    // knockback overrides everything else
    if (e.kb.len() > 4) {
      e.move(e.kb)
      e.kb = e.kb.scale(0.8)
      return
    }

    // locked into an attack / flinch clip — hold still, let it play out
    if (e.action) return

    const player = get("player")[0]
    if (!player || player.dead) {
      e.showIdle(e.facing)
      return
    }

    const toward = player.pos.sub(e.pos)
    const dist = toward.len()
    e.facing = facingFromVec(toward.x, toward.y, e.facing)

    if (dist > attackRange) {
      // Boss at range: lob a pot if it's ready, otherwise close the distance.
      if (e.isBoss && time() >= e.nextPotAt && dist > POT_MIN_THROW_DIST) {
        e.action = "attack"
        e.actionUntil = time() + POT_WINDUP + 0.25
        e.nextPotAt = time() + POT_CD
        e.potReleaseAt = time() + POT_WINDUP
        e.show(`attack_${attackSprite(e.facing)}_stay`, { loop: false, speed: 18, restart: true })
      } else {
        e.move(toward.unit().scale(e.speed))
        e.showWalk(e.facing)
      }
    } else if (e.atkCd <= 0) {
      // in range: plant, swing, and schedule the hit for mid-swing
      e.action = "attack"
      e.actionUntil = time() + ATTACK_DURATION
      e.atkCd = atkCd
      e.swingAt = time() + ATTACK_WINDUP
      e.show(`attack_${attackSprite(e.facing)}_stay`, { loop: false, speed: 24, restart: true })
    } else {
      e.showIdle(e.facing)
    }
  })

  // brief white flash on hit (drawn each frame; the base tint otherwise)
  const flashCol = rgb(255, 240, 240)
  const baseCol = rgb(...baseTint)
  e.onUpdate(() => { e.color = time() < e.flashUntil ? flashCol : baseCol })

  return e
}
