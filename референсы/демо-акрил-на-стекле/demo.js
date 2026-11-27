const duration = 25 * 60;
const demoSpeed = 24;
const renderOriginalRing = createPaintRing(
  document.querySelector('#ring-bristles'),
  document.querySelector('#ring-color'),
  document.querySelector('#ring-paint-cap'),
  document.querySelector('#ring-paint-glaze'),
);
const remainingOutput = document.querySelector('#remaining');
const status = document.querySelector('#status');
const toggle = document.querySelector('#toggle');
const toggleLabel = document.querySelector('#toggle-label');
const paintContact = toggle.querySelector('.paint-contact');
const finish = document.querySelector('#finish');
const glass = document.querySelector('.glass');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const dial = document.querySelector('.dial');
const brushLayer = document.querySelector('#paint-engine-layer');
const brushSwitch = document.querySelector('#brush-switch');
const renderBrushRing = createPaintEngineRing(brushLayer);
let renderPaintRing = renderOriginalRing;

let elapsed = duration - (18 * 60 + 42);
let resumeTime = null;
let frameId = 0;
let lastReadoutAt = 0;

function selectBrush(usePaintEngine) {
  renderPaintRing = usePaintEngine ? renderBrushRing : renderOriginalRing;
  dial.dataset.brush = usePaintEngine ? 'paint-engine' : 'original';
  brushLayer.hidden = !usePaintEngine;
  brushSwitch.textContent = usePaintEngine ? 'Показать прежний мазок' : 'Показать мазок Paint Engine';
  render();
}

function render(forceReadout = true) {
  renderPaintRing(elapsed / duration);

  const now = performance.now();
  if (!forceReadout && now - lastReadoutAt < 160) return;
  lastReadoutAt = now;
  const remaining = Math.ceil(duration - elapsed);
  const minutes = Math.floor(remaining / 60);
  const seconds = String(remaining % 60).padStart(2, '0');
  const label = `${minutes}:${seconds}`;

  if (remainingOutput.textContent !== label) {
    remainingOutput.textContent = label;
  }
}

function advanceClock(now) {
  elapsed = Math.min(duration, elapsed + (now - resumeTime) * demoSpeed / 1000);
  resumeTime = now;
}

function stopClock() {
  cancelAnimationFrame(frameId);
  resumeTime = null;
}

function complete(message) {
  stopClock();
  elapsed = duration;
  render();
  status.textContent = message;
  toggleLabel.textContent = 'Начать заново';
  finish.disabled = true;
}

function tick() {
  advanceClock(performance.now());
  if (elapsed >= duration) {
    complete('Время вышло');
    return;
  }
  render(false);
  frameId = requestAnimationFrame(tick);
}

function reflectPaintContact(clientX) {
  if (reducedMotion.matches) return;
  const bounds = paintContact.getBoundingClientRect();
  const origin = clientX === undefined ? bounds.width / 2 : Math.min(bounds.width, Math.max(0, clientX - bounds.left));

  Array.from(paintContact.children).forEach((reflection, index) => {
    const distance = (index === 0 ? 0 : bounds.width) - origin;
    const halfWidth = reflection.offsetWidth / 2;
    const reflect = (fraction, scale, opacity, offset) => ({
      transform: `translateX(${origin + distance * fraction - halfWidth}px) scaleX(${scale})`,
      opacity,
      offset,
    });
    reflection.getAnimations().forEach((animation) => animation.cancel());
    reflection.animate([
      reflect(0, .24, 0, 0),
      reflect(.12, .56, .8, .17),
      reflect(.55, 1.1, .48, .55),
      reflect(1, 1.46, 0, 1),
    ], { duration: 690, easing: 'cubic-bezier(.23,.58,.37,1)' });
  });
}

toggle.addEventListener('pointerdown', (event) => {
  if (event.button === 0) reflectPaintContact(event.clientX);
});

toggle.addEventListener('click', (event) => {
  if (event.detail === 0) reflectPaintContact();
  if (resumeTime !== null) {
    advanceClock(performance.now());
    if (elapsed >= duration) {
      complete('Время вышло');
      return;
    }
    stopClock();
    render();
    status.textContent = 'На паузе';
    toggleLabel.textContent = 'Продолжить';
    return;
  }

  if (elapsed >= duration) elapsed = 0;
  resumeTime = performance.now();
  render();
  status.textContent = 'В работе';
  toggleLabel.textContent = 'Пауза';
  finish.disabled = false;
  frameId = requestAnimationFrame(tick);
});

finish.addEventListener('click', () => complete('Завершено'));

document.querySelector('#reset').addEventListener('click', () => {
  stopClock();
  elapsed = 0;
  render();
  status.textContent = 'Готово к запуску';
  toggleLabel.textContent = 'Начать';
  finish.disabled = false;
});

let lightPosition;
let lightTarget;
let lightFrame = 0;
let lightUpdatedAt = 0;

function positionGlassLight() {
  glass.style.setProperty('--light-x', `${lightPosition.x}px`);
  glass.style.setProperty('--light-y', `${lightPosition.y}px`);
}

function followGlassLight(now) {
  const dx = lightTarget.x - lightPosition.x;
  const dy = lightTarget.y - lightPosition.y;
  if (Math.hypot(dx, dy) < .5) {
    lightPosition = { ...lightTarget };
    positionGlassLight();
    lightFrame = 0;
    return;
  }

  const easing = 1 - Math.exp(-Math.max(0, now - lightUpdatedAt) / 85);
  lightPosition.x += dx * easing;
  lightPosition.y += dy * easing;
  lightUpdatedAt = now;
  positionGlassLight();
  lightFrame = requestAnimationFrame(followGlassLight);
}

function moveGlassLight(event) {
  if (event.pointerType !== 'mouse' || reducedMotion.matches) return;
  const bounds = glass.getBoundingClientRect();
  lightTarget = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  if (!lightPosition) {
    lightPosition = { ...lightTarget };
    positionGlassLight();
  }

  glass.setAttribute('data-light', '');
  if (!lightFrame) {
    lightUpdatedAt = performance.now();
    lightFrame = requestAnimationFrame(followGlassLight);
  }
}

glass.addEventListener('pointerenter', moveGlassLight);
glass.addEventListener('pointermove', moveGlassLight);
glass.addEventListener('pointerleave', () => glass.removeAttribute('data-light'));

if (renderBrushRing) {
  brushSwitch.hidden = false;
  brushSwitch.addEventListener('click', () => selectBrush(brushLayer.hidden));
  selectBrush(true);
} else {
  render();
}
