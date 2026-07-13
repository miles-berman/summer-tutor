import kaplay from "https://unpkg.com/kaplay@3001.0.19/dist/kaplay.mjs"
import { TILE } from "./constants.js"
import { loadAssets } from "./assets.js"
import { buildLevel } from "./level.js"
import { makePlayer } from "./player.js"
import { spawnEnemy } from "./enemy.js"

kaplay({ background: [22, 20, 30], crisp: true })

loadAssets()
const { spawn, cols, rows } = buildLevel()
const player = makePlayer(spawn)

spawnEnemy(vec2(TILE * 3, TILE * 3))
spawnEnemy(vec2(TILE * 16, TILE * 8))

// simple HP readout (screen-space, ignores camera)
const hud = add([text("", { size: 12 }), pos(4, 4), fixed(), z(100)])
hud.onUpdate(() => { hud.text = `HP ${player.hp}/${player.maxHp}` })

const w = cols * TILE
const h = rows * TILE
camScale(Math.min(width() / w, height() / h) * 0.9)
camPos(w / 2, h / 2)