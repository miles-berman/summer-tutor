// Shared animation controller used by both the player and the enemies.
// The warrior sprite pack only ships idle art for "down" and "up", so for
// left/right we freeze the first walk frame as a stand-in idle (same trick the
// original player used).

export const ATTACK_FPS = 30

// In-game the attack_left / attack_right art reads inverted, so map the true
// facing to the sprite that actually swings that way.
export function attackSprite(facing) {
  if (facing === "left") return "right"
  if (facing === "right") return "left"
  return facing
}

// Turn a movement vector into one of the four cardinal facings.
export function facingFromVec(dx, dy, fallback = "down") {
  if (dx === 0 && dy === 0) return fallback
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? "left" : "right"
  return dy < 0 ? "up" : "down"
}

// Attach show / showWalk / showIdle helpers to an already-added game object that
// has a sprite() comp. `obj._cur` caches the current clip so we don't restart an
// animation every frame — pass { restart: true } when we deliberately want to
// replay (e.g. re-swinging on a fresh attack).
export function attachAnim(obj, start = "idle_down") {
  obj._cur = null

  obj.show = (name, { loop = true, speed = 8, freeze = false, restart = false } = {}) => {
    const key = `${name}:${freeze ? "frozen" : "main"}`
    if (!restart && obj._cur === key) return
    obj._cur = key
    obj.use(sprite(name))
    obj.play("main", { loop, speed })
    if (freeze) obj.stop()
  }

  obj.showWalk = (dir, speed = 10) => obj.show(`walk_${dir}`, { speed })

  obj.showIdle = (dir) => {
    if (dir === "down" || dir === "up") obj.show(`idle_${dir}`, { speed: 6 })
    else obj.show(`walk_${dir}`, { freeze: true }) // no sideways idle in the pack
  }

  obj.show(start, { speed: 6 })
}
