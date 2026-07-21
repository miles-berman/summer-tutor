import { attachAnim, attackSprite, facingFromVec } from "./anim.js"

const ENEMY_SPEED = 48
const ENEMY_HP = 3
const ENEMY_KNOCKBACK = 200
const ATTACK_RANGE = 18      // distance at which it stops and swings
const ENEMY_ATTACK_CD = 1.1
const HIT_LOCK = 0.2
const DIE_TIME = 0.85        // 10 frames @ 12fps

export function spawnEnemy(p, level = 1) {
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
      dmg: dmg,
      speed: speed,
      hp: hp,
      kb: vec2(0),
      dead: false,
      facing: "down",
      action: null,        // null | "attack" | "hit"
      actionUntil: 0,
      atkCd: 0,
    },
  ])

  attachAnim(e, "idle_down")

  e.hurt = (dmg = 1, fromPos = null) => {
    if (e.dead) return
    e.hp -= dmg
    if (fromPos) {
      const away = e.pos.sub(fromPos)
      e.kb = (away.len() > 0 ? away.unit() : vec2(1, 0)).scale(ENEMY_KNOCKBACK)
    }
    if (e.hp <= 0) {
      e.dead = true
      e.action = null
      e.show("die", { loop: false, speed: 12, restart: true })
      wait(DIE_TIME, () => destroy(e))
      return
    }
    e.action = "hit"
    e.actionUntil = time() + HIT_LOCK
    e.show("hit", { loop: false, speed: 10, restart: true })
  }

  e.onUpdate(() => {
    if (e.dead) return

    if (e.atkCd > 0) e.atkCd -= dt()
    if (e.action && time() >= e.actionUntil) e.action = null

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
      // in range: plant and swing (contact damage is handled by the player)
      e.action = "attack"
      e.actionUntil = time() + 0.45
      e.atkCd = atkCd
      e.show(`attack_${attackSprite(e.facing)}_stay`, { loop: false, speed: 24, restart: true })
    } else {
      e.showIdle(e.facing)
    }
  })

  return e
}
