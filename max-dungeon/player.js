import { SPEED } from "./constants.js"

const ATTACK_FPS = 30
const HIT_KNOCKBACK = 260   // px/s shove when the player is hit
const INVULN_TIME = 0.7     // i-frames after a hit

// attack hitbox
const ATTACK_REACH = 16     // world units in front of player center
const ATTACK_W = 22
const ATTACK_H = 18
const ATTACK_DAMAGE = 1
const ATTACK_ACTIVE = 0.22  // seconds the hitbox is live

// the pack's attack_left / attack_right art is mislabeled (swapped),
// so map the true facing to the sprite that actually points that way
function attackSprite(facing) {
  if (facing === "left") return "right"
  if (facing === "right") return "left"
  return facing
}

export function makePlayer(spawn) {
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
      facing: "down",
      action: null,      // null | "attack" | "hit"
      dead: false,
      hp: 5,
      maxHp: 5,
      kb: vec2(0),
      invuln: 0,
      _cur: "idle_down:main",
    },
  ])

  function show(name, { loop = true, speed = 8, freeze = false } = {}) {
    const key = freeze ? `${name}:frozen` : `${name}:main`
    if (player._cur === key) return
    player._cur = key
    player.use(sprite(name))
    player.play("main", { loop, speed })
    if (freeze) player.stop()
  }

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

  function idleFor(dir) {
    if (dir === "down" || dir === "up") show(`idle_${dir}`, { speed: 6 })
    else show(`walk_${dir}`, { freeze: true })   // no sideways idle in the pack
  }

  // spawn the damage sensor in front of the player for the active window
  function swingHitbox(dir) {
    const offset = dirs[dir].vec.scale(ATTACK_REACH)
    const box = add([
      pos(player.pos.add(offset)),
      anchor("center"),
      area({ shape: new Rect(vec2(0), ATTACK_W, ATTACK_H) }),
      "playerHitbox",
      { struck: new Set() },
    ])
    box.onUpdate(() => { box.pos = player.pos.add(offset) })  // follow during knockback
    box.onCollideUpdate("enemy", (e) => {
      if (box.struck.has(e)) return                          // one hit per swing
      box.struck.add(e)
      e.hurt?.(ATTACK_DAMAGE, player.pos)
    })
    wait(ATTACK_ACTIVE, () => destroy(box))
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
    player.action = "hit"
    show("hit", { loop: false, speed: 10 })
    if (player.hp <= 0) {
      player.dead = true
      player.opacity = 1
      debug.log("Player defeated")
    }
  }

  // ---------- attack ----------
  onKeyPress("space", () => {
    if (player.dead || player.action) return
    const { moving, facing } = readInput()
    player.facing = facing
    player.action = "attack"
    show(`attack_${attackSprite(facing)}${moving ? "" : "_stay"}`, { loop: false, speed: ATTACK_FPS })
    swingHitbox(facing)   // true facing, so the hit lands where it should
  })

  onKeyPress("h", () => player.hurt(1))  // debug

  // ---------- per-frame ----------
  player.onUpdate(() => {
    if (player.kb.len() > 4) {
      player.move(player.kb)
      player.kb = player.kb.scale(0.82)
    }
    if (player.invuln > 0) {
      player.invuln -= dt()
      player.opacity = Math.floor(time() * 20) % 2 ? 0.35 : 1
      if (player.invuln <= 0) player.opacity = 1
    }

    if (player.dead || player.action) return

    const { dx, dy, moving, facing } = readInput()
    player.facing = facing
    if (moving) {
      player.move(dx * SPEED, dy * SPEED)
      show(`walk_${facing}`, { speed: 10 })
    } else {
      idleFor(facing)
    }
  })

  player.onAnimEnd(() => {
    if (player.action === "attack" || player.action === "hit") player.action = null
  })

  player.onCollideUpdate("enemy", (e) => player.hurt(e.dmg ?? 1, e.pos))
  player.onCollide("door", () => debug.log("You found the exit!"))

  return player
}