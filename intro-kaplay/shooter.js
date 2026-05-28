// ---------- Boot ----------
kaplay({
  width: 800,
  height: 600,
  background: [100, 150, 200], // hazy sky
  cursor: "none", // hide the OS cursor — we draw our own
});

// ---------- Crosshair ----------
const crosshair = add([
  circle(12),
  pos(0, 0),
  color(255, 255, 255),
  outline(2, rgb(0, 0, 0)),
  opacity(0.6),
  anchor("center"),
  z(100), // draw on top of everything
]);

crosshair.onUpdate(() => {
  crosshair.pos = mousePos();
});

// ---------- Ground (just visual) ----------
add([
  rect(800, 150),
  pos(0, 450),
  color(80, 130, 60),
]);

// ---------- Spawning clays ----------
function spawnClay() {
  const fromLeft = chance(0.5);
  const startX = fromLeft ? 50 : 750;
  const dirX = fromLeft ? rand(150, 300) : rand(-300, -150);

  add([
    circle(8),
    pos(startX, 400),
    color(255, 40, 40),
    outline(2, rgb(255, 200, 40)),
    anchor("center"),
    area(),
    scale(1),
    {
      vel: vec2(dirX, rand(-450, -550)),
      lifetime: 0,
    },
    "clay",
  ]);
}

loop(1.5, spawnClay);

// ---------- Clay behavior ----------
onUpdate("clay", (clay) => {
  clay.lifetime += dt();

  // manual physics
  clay.vel.y += 600 * dt(); // gravity
  clay.move(clay.vel);

  // grow as it "comes toward camera"
  const s = 2 + clay.lifetime * 0.8;
  clay.scaleTo(s);

  // clean up if it flies off the bottom
  if (clay.pos.y > 700) destroy(clay);
});

// ---------- Shooting ----------
let score = 0;

onMousePress(() => {
  const hits = get("clay").filter(c => c.hasPoint(mousePos()));
  hits.forEach(c => {
    addKaboom(c.pos);
    destroy(c);
    score++;
  });
  shake(hits.length > 0 ? 4 : 1);
});

// ---------- HUD ----------
const scoreLabel = add([
  text("Score: 0", { size: 24 }),
  pos(20, 20),
  color(255, 255, 255),
  z(100),
]);

scoreLabel.onUpdate(() => {
  scoreLabel.text = "Score: " + score;
});