import { attachAnim, attackSprite, facingFromVec } from "./anim.js"

const ENEMY_SPEED = 48
const ENEMY_HP = 3
const ENEMY_KNOCKBACK = 200
const ATTACK_RANGE = 18      // distance at which it plants and starts a swing
const ATTACK_HIT_RANGE = 24  // the swing connects if the player is still this close when it lands
const ATTACK_WINDUP = 0.22   // delay from swing start to the moment damage is dealt
const ATTACK_DURATION = 0.45 // time locked in the swing clip
const ENEMY_ATTACK_CD = 1.1
const HIT_LOCK = 0.2
const DIE_TIME = 0.85        // 10 frames @ 12fps

// `onKill` (optional) fires once when this enemy dies — used by the scene for scoring.
export function spawnEnemy(p, level = 1, onKill = null) {
  const hp = ENEMY_HP + Math.floor(level * 0.75)          // tankier each level
  const speed = Math.min(ENEMY_SPEED + (level - 1) * 3, 92) // faster, capped
  const dmg = 1 + Math.floor((level - 1) / 4)             // hits harder over time
  const atkCd = Math.max(0.55, ENEMY_ATTACK_CD - (level - 1) * 0.04) // more aggressive

  const e = add([
    sprite("idle_down", { anim: "main" }),
    color(255, 110, 110),   // red tint marks them as hostile (no shader needed)
    anchor("center"),
    scale(0.5),
    pos(p),
    area({ shape: new Rect(vec2(0), 18, 24) }),
    body(),
    "enemy",
    {
      dmg,
      speed,
      hp,
      kb: vec2(0),
      dead: false,
      facing: "down",
      action: null,        // null | "attack" | "hit"
      actionUntil: 0,
      atkCd: 0,
      swingAt: 0,          // time() at which a pending swing lands (0 = none)
    },
  ])

  attachAnim(e, "idle_down")

  e.hurt = (amount = 1, fromPos = null) => {
    if (e.dead) return
    e.hp -= amount
    e.swingAt = 0          // taking a hit interrupts a wind-up swing
    if (fromPos) {
      const away = e.pos.sub(fromPos)
      e.kb = (away.len() > 0 ? away.unit() : vec2(1, 0)).scale(ENEMY_KNOCKBACK)
    }
    if (e.hp <= 0) {
      e.dead = true
      e.action = null
      e.show("die", { loop: false, speed: 12, restart: true })
      onKill?.()
      wait(DIE_TIME, () => destroy(e))
      return
    }
    e.action = "hit"
    e.actionUntil = time() + HIT_LOCK
    e.show("hit", { loop: false, speed: 10, restart: true })
  }

  // Land a scheduled swing once its wind-up elapses. Runs even while the attack
  // clip has us locked, so the hit connects mid-swing rather than on body contact.
  function resolveSwing() {
    if (e.swingAt === 0 || time() < e.swingAt) return
    e.swingAt = 0
    const player = get("player")[0]
    if (player && !player.dead && player.pos.dist(e.pos) <= ATTACK_HIT_RANGE) {
      player.hurt(e.dmg, e.pos)
    }
  }

  // Physics + AI on the fixed 50Hz step. Big frame gaps get replayed as several
  // small, collision-checked steps, so the enemy can never tunnel through a wall.
  e.onFixedUpdate(() => {
    if (e.dead) return

    if (e.atkCd > 0) e.atkCd -= dt()
    if (e.action && time() >= e.actionUntil) e.action = null
    resolveSwing()

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

    if (dist > ATTACK_RANGE) {
      e.move(toward.unit().scale(e.speed))
      e.showWalk(e.facing)
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

  return e
}
