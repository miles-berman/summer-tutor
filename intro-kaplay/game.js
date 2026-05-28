kaplay({
  width: 800,
  height: 600,
  background: [0, 20, 80], // RGB — sky blue
});

function spawnStar() {
  const x = rand(0, 800)
  const y = rand(0, 600)

  add([
    rect(8, 8),
    pos(x, y),
    color(255, 255, 255),
    anchor("center"),
    area(),
    scale(1),
    "star",
  ]);
}

loop(0.5, spawnStar);