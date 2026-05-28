// ---------- Boot ----------
kaplay({
  width: 800,
  height: 600,
  background: [180, 220, 140], // pale grass
  cursor: "none",
});

// ---------- Load art (uncomment when sprites are ready) ----------
// loadSprite("bug",   "assets/sprites/bug.png");
// loadSprite("swatter", "assets/sprites/swatter.png");

// ---------- Score ----------
let score = 0;

const scoreLabel = add([
  text("Squished: 0", { size: 28 }),
  pos(20, 20),
  color(40, 40, 40),
]);

function updateScore() {
  scoreLabel.text = "Squished: " + score;
}

// ---------- Cursor (the "swatter") ----------
const swatter = add([
  rect(40, 40),
  color(150, 80, 40),
  // sprite("swatter"), 
  pos(0, 0),
  anchor("center"),
  rotate(15),
  z(100),
]);

function followMouse() {
  swatter.pos = mousePos();
}

swatter.onUpdate(followMouse);

// ---------- Spawning bugs ----------
function spawnBug() {
  add([
    circle(20),
    color(80, 50, 30),
    outline(2, rgb(40, 20, 10)),
    // sprite("bug"),
    pos(rand(50, 750), rand(50, 550)),
    anchor("center"),
    area(),
    {
      dir: vec2(rand(-100, 100), rand(-100, 100)), // random starting direction
    },
    "bug",
  ]);
}

// start with 5 bugs
for (let i = 0; i < 5; i++) {
  spawnBug();
}

// add a new bug every 2 seconds
loop(2, spawnBug);

// ---------- Bug behavior ----------
function moveBug(bug) {
  bug.move(bug.dir);

  // bounce off the edges
  if (bug.pos.x < 20 || bug.pos.x > 780) bug.dir.x = -bug.dir.x;
  if (bug.pos.y < 20 || bug.pos.y > 580) bug.dir.y = -bug.dir.y;
}

onUpdate("bug", moveBug);

// every 1.5 seconds, every bug picks a new random direction
function changeDirections() {
  get("bug").forEach(pickNewDirection);
}

function pickNewDirection(bug) {
  bug.dir = vec2(rand(-100, 100), rand(-100, 100));
}

loop(1.5, changeDirections);

// ---------- Squishing ----------
function squish() {
  const hits = get("bug").filter(b => b.hasPoint(mousePos()));
  hits.forEach(squishBug);
}

function squishBug(bug) {
  addKaboom(bug.pos);
  destroy(bug);
  score++;
  updateScore();
}

onMousePress(squish);