## VS Code setup

- Install **Live Server** extension
- Open settings (`Ctrl/Cmd + ,`), flip on:
    - `editor.formatOnSave: true`
    - `editor.fontSize: 16`
    - `editor.wordWrap: "on"`

## Project setup

- Grab the starter (zip or git link — TBD)
- Open in VS Code
- Run Live Server

Folder layout:

```
my-game/
  index.html
  game.js
  assets/
    sprites/
    sounds/
```

## Kaplay walkthrough

### 1. Boot the engine

Nothing renders until `kaplay()` runs. Always first.

```javascript
kaplay({
  width: 800,
  height: 600,
  background: [135, 206, 235], // RGB — sky blue
});
```

Basic blue sky.

### 2. Add a game object

Everything in Kaplay is a **game object** built from a list of **components**. Each component gives the object an ability.

```javascript
const player = add([
  rect(40, 40),       // shape
  pos(100, 100),      // where it starts
  color(255, 100, 100), // red
]);
```

- `add([...])` creates and adds the object to the scene
- `rect`, `pos`, `color` are components
- This is the whole mental model: objects = lists of components

### 3. Make it move

```javascript
onKeyDown("left",  () => player.move(-200, 0));
onKeyDown("right", () => player.move( 200, 0));
onKeyDown("up",    () => player.move(0, -200));
onKeyDown("down",  () => player.move(0,  200));
```

- `onKeyDown` fires every frame the key is held
- `onKeyPress` fires once per press (use for jump, shoot, etc.)
- `player.move(x, y)` is pixels per second — Kaplay handles the frame timing

### 4. Add gravity (optional — skip for top-down)

```javascript
setGravity(1200);
```

Then give the player a `body()` component so it falls:

```javascript
const player = add([
  rect(40, 40),
  pos(100, 100),
  color(255, 100, 100),
  body(),  // allows gravity
]);
```

Replace the up/down keys with a jump:

```javascript
onKeyPress("space", () => {
  if (player.isGrounded()) player.jump(500);
});
```

### 5. Add ground so the player lands

A static body doesn't move but other bodies collide with it.

```javascript
add([
  rect(800, 40),
  pos(0, 560),
  color(80, 160, 80),
  area(),                  // has a collider
  body({ isStatic: true }), // doesn't fall, but blocks others
]);
```

Player also needs `area()` to collide:

```javascript
const player = add([
  rect(40, 40),
  pos(100, 100),
  color(255, 100, 100),
  area(),
  body(),
]);
```

**Key idea:** `area()` = "I have a collider." `body()` = "I obey physics." Both needed for collision + gravity.

### 6. Add something to collect

```javascript
add([
  circle(12),
  pos(500, 500),
  color(255, 215, 0),
  area(),
  "coin",  // tag — just a string in the components list
]);
```

Tags group objects so you can refer to them in handlers.

### 7. Collision handler

```javascript
player.onCollide("coin", (c) => {
  destroy(c);
  debug.log("got it!");
});
```

- Fires when player touches anything tagged `"coin"`
- `destroy(obj)` removes a game object
- `debug.log(...)` prints to Kaplay's debug overlay — press backtick (`) in-game to toggle it

### 8. Use images instead of shapes

Drop a PNG into `assets/sprites/`, load it, then swap `rect`/`circle` for `sprite`.

```javascript
loadSprite("hero", "assets/sprites/hero.png");
loadSprite("coin", "assets/sprites/coin.png");
```

Loaders go at the top, after `kaplay()`. They run once. Then replace the shape component:

```javascript
const player = add([
  sprite("hero"),  // was: rect(40, 40), color(255, 100, 100)
  pos(100, 100),
  area(),
  body(),
]);
```

- The collider from `area()` auto-sizes to the sprite — no need to specify
- `pos`, `area`, `body`, tags all work the same — only the shape component changes
- Sprite anchor is top-left by default. Add `anchor("center")` if you want `pos` to mean the middle of the sprite

Resize a sprite with `scale`:

```javascript
sprite("hero"),
scale(2),  // 2x size — good for pixel art
```

**Gotcha:** sprites need to be served over HTTP — they only load via Live Server, not by double-clicking `index.html`. If sprites are invisible, check the URL bar says `127.0.0.1:5500` and not `file:///...`.

### 9. Sounds

Same pattern as sprites — load at the top, play when something happens.

```javascript
loadSound("pickup", "assets/sounds/pickup.wav");
loadSound("jump",   "assets/sounds/jump.wav");
```

Play with `play()`:

```javascript
player.onCollide("coin", (c) => {
  destroy(c);
  play("pickup");
});
onKeyPress("space", () => {
  if (player.isGrounded()) {
    player.jump(500);
    play("jump");
  }
});
```

Options for volume, looping, and pitch:

```javascript
play("pickup", { volume: 0.5 });
play("music",  { loop: true });
play("jump",   { detune: rand(-200, 200) }); // random pitch — sounds less repetitive
```

`.wav`, `.mp3`, `.ogg` all work. `.wav` is the safest cross-browser choice for short sound effects.

### 10. The game loop — `onUpdate`

`onUpdate(fn)` runs every frame (~60 times/sec). This is how things move, animate, or react continuously.

```javascript
// Move an object to the right forever
const obj = add([rect(20, 20), pos(0, 100)]);

obj.onUpdate(() => {
  obj.move(100, 0); // 100 px/sec to the right
});
```

Three flavors:

```javascript
// Global — runs every frame, no matter what
onUpdate(() => {
  debug.log("frame");
});

// Per-tag — runs once per frame for EACH object with that tag
onUpdate("enemy", (e) => {
  e.move(-50, 0); // every enemy drifts left
});

// Per-object — runs while that object exists, dies with it
const player = add([rect(20, 20), pos(100, 100)]);
player.onUpdate(() => {
  // do something per frame for just this player
});
```

**`dt()`** = seconds since last frame. Use it when you need frame-rate-independent math that isn't already handled by `move()`:

```javascript
obj.onUpdate(() => {
  obj.angle += 90 * dt(); // rotate 90 degrees per second
});
```

### 11. Mouse input

```javascript
onMousePress(() => {
  debug.log("clicked at " + mousePos());
});

// Or for a specific button
onMousePress("left",  () => debug.log("left click"));
onMousePress("right", () => debug.log("right click"));
```

- `mousePos()` returns the current mouse position as a `vec2`
- `onMouseDown(fn)` fires every frame the button is held
- `onMouseMove(fn)` fires whenever the mouse moves

**Hitscan-style click detection** — check if a click landed on a tagged object:

```javascript
onMousePress(() => {
  const hits = get("target").filter(t => t.hasPoint(mousePos()));
  hits.forEach(t => destroy(t));
});
```

- `get("tag")` returns all objects with that tag
- `obj.hasPoint(pos)` returns true if that point is inside the object's `area()`

### 12. Timers — `wait` and `loop`

```javascript
// Run once after a delay
wait(2, () => {
  debug.log("two seconds later");
});

// Run repeatedly forever
loop(1, () => {
  debug.log("every second");
});
```

Use `loop` to spawn things on a rhythm:

```javascript
loop(1.5, () => {
  add([
    circle(10),
    pos(rand(0, 800), 0),
    color(255, 100, 100),
    "enemy",
  ]);
});
```

Both return a handle you can cancel:

```javascript
const spawner = loop(1, spawnEnemy);
// later...
spawner.cancel();
```

### API cheatsheet

|Function|What it does|
|---|---|
|`kaplay({...})`|Boot the engine. First call.|
|`add([components])`|Create a game object.|
|`destroy(obj)`|Remove a game object.|
|`get("tag")`|Get all objects with a tag. Returns array.|
|`rect(w, h)` / `circle(r)`|Shape components.|
|`sprite(name)`|Shape component — uses a loaded image.|
|`text("hi")`|Text component — renders a string.|
|`pos(x, y)`|Position.|
|`color(r, g, b)`|Fill color.|
|`scale(n)`|Resize. `scale(2)` = double size.|
|`rotate(deg)`|Rotation in degrees.|
|`opacity(n)`|0 = invisible, 1 = solid.|
|`anchor("center")`|Make `pos` refer to the center instead of top-left.|
|`area()`|Gives the object a collider.|
|`body()`|Obeys gravity / physics. `{ isStatic: true }` = immovable.|
|`"tagname"`|A tag — bare string in the components list.|
|`setGravity(n)`|Global gravity strength.|
|`loadSprite(name, path)`|Load an image. Call once, at the top.|
|`loadSound(name, path)`|Load a sound. Call once, at the top.|
|`play(name, opts?)`|Play a sound. Opts: `volume`, `loop`, `detune`.|
|`onKeyDown(key, fn)`|Fires every frame key is held.|
|`onKeyPress(key, fn)`|Fires once per press.|
|`onMousePress(fn)`|Fires on mouse click. Also `onMouseMove`, `onMouseDown`.|
|`mousePos()`|Current mouse position as `vec2`.|
|`obj.hasPoint(pos)`|Does this object's area contain that point? (needs `area()`)|
|`onUpdate(fn)`|Runs every frame (~60/sec). The game loop.|
|`onUpdate("tag", fn)`|Runs every frame for each object with that tag.|
|`obj.onUpdate(fn)`|Per-object update — runs while that object exists.|
|`dt()`|Seconds since last frame. For frame-rate-independent math.|
|`wait(secs, fn)`|Run once after a delay.|
|`loop(secs, fn)`|Run repeatedly on an interval. Returns a handle with `.cancel()`.|
|`obj.move(x, y)`|Move at pixels/second.|
|`obj.moveBy(x, y)`|Move by exact pixels (no time scaling).|
|`obj.jump(force)`|Jump (needs `body()`).|
|`obj.isGrounded()`|Is the body on the ground?|
|`obj.onCollide(tag, fn)`|Collision handler.|
|`scene("name", fn)` / `go("name")`|Define and switch scenes (menu, game, lose).|
|`rand(a, b)` / `choose([...])`|Random number / random pick from list.|
|`width()` / `height()` / `center()`|Canvas dimensions and center point.|
|`shake(n)`|Screen shake — great for impacts.|
|`addKaboom(pos)`|Built-in explosion effect. Free polish.|
|`debug.log(...)`|Print to in-game debug overlay (toggle with `).|