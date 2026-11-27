function createRingBristle(parent, radius, width, opacity) {
  const trace = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  trace.setAttribute('cx', '200');
  trace.setAttribute('cy', '200');
  trace.setAttribute('r', radius);
  trace.setAttribute('pathLength', '360');
  trace.setAttribute('fill', 'none');
  trace.setAttribute('stroke', 'white');
  trace.setAttribute('stroke-linecap', 'round');
  trace.setAttribute('stroke-width', width);
  trace.setAttribute('opacity', opacity);
  parent.append(trace);
  return trace;
}

function setPaintedArc(bristle, start, end) {
  const length = Math.min(360, Math.max(0, end - start));
  bristle.setAttribute('stroke-dasharray', `${length} ${360 - length}`);
  bristle.setAttribute('stroke-dashoffset', -start);
}

function ringPoint(radius, angle) {
  const radians = angle * Math.PI / 180;
  const x = 200 + radius * Math.sin(radians);
  const y = 200 - radius * Math.cos(radians);
  return `${x.toFixed(3)} ${y.toFixed(3)}`;
}

function shapePaintCap(depth, rise) {
  const inside = 120;
  const outside = 177;
  const middle = (inside + outside) / 2;
  // Both sides of the lip run along the ring, then meet on the centerline in the direction of travel.
  return [
    `M ${ringPoint(inside, -depth)}`,
    `A ${inside} ${inside} 0 0 1 ${ringPoint(inside, -rise)}`,
    `C ${ringPoint(inside, -rise * .34)} ${ringPoint(middle - 15, 0)} ${ringPoint(middle, 0)}`,
    `C ${ringPoint(middle + 15, 0)} ${ringPoint(outside, -rise * .34)} ${ringPoint(outside, -rise)}`,
    `A ${outside} ${outside} 0 0 0 ${ringPoint(outside, -depth)}`,
    'Z',
  ].join(' ');
}

function createPaintRing(bristlesGroup, pigmentLayer, paintCap, glaze) {
  const bristleCount = 28;
  const innerRadius = 118;
  const outerRadius = 178;
  const spacing = (outerRadius - innerRadius) / (bristleCount - 1);
  const fringeGroup = document.createElementNS(bristlesGroup.namespaceURI, 'g');
  bristlesGroup.append(fringeGroup);

  // One concentric trace per bristle lane. Each lane catches and releases pigment at its own angle.
  const bristles = Array.from({ length: bristleCount }, (_, index) => {
    const position = index / (bristleCount - 1);
    const radius = innerRadius + index * spacing;
    return {
      core: createRingBristle(bristlesGroup, radius, spacing + .85, 1),
      fringe: createRingBristle(fringeGroup, radius, spacing * .83, .42 + .19 * Math.cos(index * 1.71)),
      start: 16 * (.5 - position) + 3.4 * Math.sin(index * .73) + 2.5 * Math.sin(index * 2.5),
      end: 17 * (position - .5) + 3.8 * Math.sin(index * .61 + 1.2) + 2.1 * Math.cos(index * 2.7),
      startFringe: 4 + 7 * (1 + Math.sin(index * 1.83)) / 2,
      endFringe: 1 + 2 * (1 + Math.cos(index * 2.36)) / 2,
      phase: index * .59,
    };
  });

  return (progress) => {
    if (progress === 0) {
      pigmentLayer.setAttribute('visibility', 'hidden');
      glaze.setAttribute('opacity', '0');
      return;
    }
    pigmentLayer.setAttribute('visibility', 'visible');

    if (progress === 1) {
      pigmentLayer.removeAttribute('mask');
      glaze.setAttribute('opacity', '0');
      return;
    }
    pigmentLayer.setAttribute('mask', 'url(#ring-pigment)');

    const sweep = progress * 360;
    const taper = Math.min(1, sweep / 28, (360 - sweep) / 28);
    const pressure = Math.sin(sweep * .067 - .85);
    for (const bristle of bristles) {
      const start = bristle.start * taper;
      const drag = 2.2 * Math.sin(sweep * .089 + bristle.phase);
      const end = sweep - (12 - bristle.end * .4 - drag) * taper;
      setPaintedArc(bristle.core, start, end);
      setPaintedArc(bristle.fringe, start - bristle.startFringe * taper, end + bristle.endFringe * taper);
    }

    const direction = `rotate(${sweep} 200 200)`;
    paintCap.setAttribute('d', shapePaintCap(24 * taper, (9.6 + .6 * pressure) * taper));
    paintCap.setAttribute('transform', direction);
    glaze.setAttribute('transform', direction);
    glaze.setAttribute('opacity', (.79 + .11 * pressure) * taper);
  };
}
