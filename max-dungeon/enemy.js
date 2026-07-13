const ENEMY_SPEED = 55
const ENEMY_HP = 2
const ENEMY_KNOCKBACK = 200

const BASE_COLOR = [210, 70, 90]

export function spawnEnemy(p) {
  const e = add([
    rect(12, 12),
    color(...BASE_COLOR),
    anchor("center"),
    pos(p),
    area(),
    body(),
    "enemy",
    { dmg: 1, speed: ENEMY_SPEED, hp: ENEMY_HP, kb: vec2(0), flash: 0 },
  ])

  e.hurt = (dmg = 1, fromPos = null) => {
    e.hp -= dmg
    e.flash = 0.1
    if (fromPos) {
      const away = e.pos.sub(fromPos)
      e.kb = (away.len() > 0 ? away.unit() : vec2(1, 0)).scale(ENEMY_KNOCKBACK)
    }
    if (e.hp <= 0) destroy(e)
  }

  e.onUpdate(() => {
    if (e.kb.len() > 4) {
      e.move(e.kb)                          // knocked back, no chasing
      e.kb = e.kb.scale(0.8)
    } else {
      const player = get("player")[0]       // chase
      if (player && !player.dead) {
        const toward = player.pos.sub(e.pos)
        if (toward.len() > 1) e.move(toward.unit().scale(e.speed))
      }
    }
    if (e.flash > 0) {
      e.flash -= dt()
      e.color = e.flash > 0 ? rgb(255, 255, 255) : rgb(...BASE_COLOR)
    }
  })

  return e
}