function createPaintEngineRing(canvas) {
  if (!window.PaintEngine || !canvas.getContext('2d')) return null;

  const center = 200;
  const radius = 148;
  const circumference = 2 * Math.PI * radius;
  const samplesPerTurn = Math.ceil(circumference / 2.5);
  const sampleDistance = circumference / samplesPerTurn;
  const color = '#ef4597';
  const seed = 8129;
  const brush = PaintEngine.createPaintEngine({ canvas, paper: false, scale: .92, seed });
  brush.resize(center * 2, center * 2);
  canvas.style.removeProperty('width');
  canvas.style.removeProperty('height');

  let sample = 0;
  let brushTime = 0;
  brush.beginStroke(center, center - radius, brushTime, { color, seed });

  return (progress) => {
    // Cross the thinner first brush contact so the end of the ring meets the start.
    const overlap = .082 * Math.max(0, (progress - .8) / .2) ** 2;
    const target = Math.floor((progress + overlap) * samplesPerTurn);

    if (target < sample) {
      sample = 0;
      brushTime = 0;
      brush.beginStroke(center, center - radius, brushTime, { color, seed });
      brush.flush();
    }

    while (sample < target) {
      sample += 1;
      const angle = sample / samplesPerTurn * 2 * Math.PI;
      // The brush gets its own speed in canvas pixels so the timer can pause or speed up.
      const speed = 245 + 37 * Math.sin(angle * 3) + 24 * Math.sin(angle * 8);
      brushTime += sampleDistance / speed * 1000;
      brush.extendStroke(center + radius * Math.sin(angle), center - radius * Math.cos(angle), brushTime);
    }
  };
}
