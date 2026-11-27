const drawnOutlineSelector = '.task-row, .outline, .filled, .timer-status, .task-row[data-invalid] .minutes';
const svgNamespace = 'http://www.w3.org/2000/svg';
const drawnOutlines = new WeakMap();
let nextHatchMask = 0;

function createOutlineProfile(element) {
  const taskId = element.closest('[data-task-id]')?.dataset.taskId;
  const key = taskId ? `${taskId}:${element.className}` : element.id || element.className;
  let seed = 2166136261;
  for (const character of key) seed = Math.imul(seed ^ character.codePointAt(0), 16777619);
  const next = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const edge = () => {
    const direction = next() < .5 ? -1 : 1;
    return {
      crestAt: .18 + .23 * next(),
      troughAt: .57 + .23 * next(),
      crest: direction * (.48 + .52 * next()),
      trough: -direction * (.39 + .61 * next()),
    };
  };
  return { corners: Array.from({ length: 4 }, () => .85 + .3 * next()), top: edge(), bottom: edge() };
}

function buildWavyEdge(start, end, y, amplitude, profile) {
  const at = (fraction) => start + (end - start) * fraction;
  const { crestAt, troughAt } = profile;
  const crest = y + amplitude * profile.crest;
  const trough = y + amplitude * profile.trough;
  const middle = troughAt - crestAt;
  const tail = 1 - troughAt;
  // Horizontal handles at each crest and valley keep the segments tangent.
  return [
    `C ${at(crestAt * .35)} ${y} ${at(crestAt * .68)} ${crest} ${at(crestAt)} ${crest}`,
    `C ${at(crestAt + middle * .3)} ${crest} ${at(troughAt - middle * .3)} ${trough} ${at(troughAt)} ${trough}`,
    `C ${at(troughAt + tail * .34)} ${trough} ${at(1 - tail * .3)} ${y} ${end} ${y}`,
  ].join(' ');
}

function buildOutlinePath(width, height, radius, profile) {
  const inset = 1.15;
  const right = width - inset;
  const bottom = height - inset;
  const limit = Math.min((right - inset) / 2, (bottom - inset) / 2);
  const corner = Math.min(radius, limit);
  const [topLeft, topRight, bottomRight, bottomLeft] = profile.corners.map((factor) => Math.min(limit, corner * factor));
  const amplitude = Math.min(2.15, (right - inset - 2 * corner) / 130);

  return [
    `M ${inset + topLeft} ${inset}`,
    buildWavyEdge(inset + topLeft, right - topRight, inset, amplitude, profile.top),
    `Q ${right} ${inset} ${right} ${inset + topRight}`,
    `L ${right} ${bottom - bottomRight}`,
    `Q ${right} ${bottom} ${right - bottomRight} ${bottom}`,
    buildWavyEdge(right - bottomRight, inset + bottomLeft, bottom, amplitude, profile.bottom),
    `Q ${inset} ${bottom} ${inset} ${bottom - bottomLeft}`,
    `L ${inset} ${inset + topLeft}`,
    `Q ${inset} ${inset} ${inset + topLeft} ${inset}`,
    'Z',
  ].join(' ');
}

function createHatchWave(element, svg, base) {
  const trigger = element.querySelector(':scope > .task-open') ?? element;
  const mask = document.createElementNS(svgNamespace, 'mask');
  mask.id = `hatch-mask-${++nextHatchMask}`;
  mask.style.maskType = 'alpha';
  const front = document.createElementNS(svgNamespace, 'circle');
  front.setAttribute('fill', 'url(#hover-hatch-front)');
  mask.append(front);

  const paint = document.createElementNS(svgNamespace, 'path');
  paint.classList.add('hatch-paint');
  paint.setAttribute('mask', `url(#${mask.id})`);
  const border = document.createElementNS(svgNamespace, 'path');
  border.classList.add('hatch-border');
  base.classList.add('hatch-base');
  svg.append(mask, paint, border);

  const motionReduced = matchMedia('(prefers-reduced-motion: reduce)');
  const duration = 560;
  let width = 0;
  let height = 0;
  let originX = .5;
  let originY = .5;
  let progress = 0;
  let frame = 0;

  function drawFront() {
    const x = width * originX;
    const y = height * originY;
    const reach = Math.hypot(Math.max(x, width - x), Math.max(y, height - y));
    front.setAttribute('cx', x);
    front.setAttribute('cy', y);
    front.setAttribute('r', progress * (reach + 3) / .86);
  }

  function revealFromPointer(event) {
    if (event.pointerType !== 'mouse' || width === 0 || trigger.matches(':disabled')) return;
    const bounds = element.getBoundingClientRect();
    // A quick return continues the visible wave while it is still fading.
    if (Number(getComputedStyle(paint).opacity) < .06) {
      originX = (event.clientX - bounds.left) / bounds.width;
      originY = (event.clientY - bounds.top) / bounds.height;
      progress = 0;
      drawFront();
    }
    cancelAnimationFrame(frame);
    const from = progress;
    const startedAt = performance.now();

    function step(now) {
      const elapsed = Math.min(1, Math.max(0, (now - startedAt) / duration));
      progress = 1 - (1 - from) * (1 - elapsed) ** 2;
      drawFront();
      if (elapsed < 1) frame = requestAnimationFrame(step);
    }

    if (motionReduced.matches) step(startedAt + duration);
    else if (from < 1) frame = requestAnimationFrame(step);
  }

  trigger.addEventListener('pointerenter', revealFromPointer);
  return (newWidth, newHeight, outline) => {
    width = newWidth;
    height = newHeight;
    paint.setAttribute('d', outline);
    border.setAttribute('d', outline);
    drawFront();
  };
}

const drawnOutlineObserver = new ResizeObserver((entries) => {
  for (const { target } of entries) {
    const { width, height } = target.getBoundingClientRect();
    if (width < 3 || height < 3) continue;
    const radius = Number.parseFloat(getComputedStyle(target).borderTopLeftRadius);
    const { svg, path, profile, resizeHatch } = drawnOutlines.get(target);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const outline = buildOutlinePath(width, height, radius, profile);
    path.setAttribute('d', outline);
    resizeHatch?.(width, height, outline);
  }
});

function observeDrawnOutlines(root) {
  for (const element of root.querySelectorAll(drawnOutlineSelector)) {
    if (drawnOutlines.has(element)) continue;
    const svg = document.createElementNS(svgNamespace, 'svg');
    svg.classList.add('drawn-outline');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const path = document.createElementNS(svgNamespace, 'path');
    svg.append(path);
    const resizeHatch = element.matches('.filled, [data-hover-effect="hatch"]') ? createHatchWave(element, svg, path) : null;
    drawnOutlines.set(element, { svg, path, profile: createOutlineProfile(element), resizeHatch });
    element.prepend(svg);
    drawnOutlineObserver.observe(element);
  }
}

function unobserveDrawnOutlines(root) {
  for (const element of root.querySelectorAll(drawnOutlineSelector)) drawnOutlineObserver.unobserve(element);
}
