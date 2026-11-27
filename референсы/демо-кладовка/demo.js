const seedTasks = [
  { id: 'top-shelf', name: 'Верхняя полка', minutes: 45 },
  { id: 'give-away', name: 'Вещи на отдачу', minutes: 40 },
  { id: 'boxes', name: 'Нижние коробки', minutes: 120 },
];
const storageKey = 'balance-closet-demo-v1';
const byId = (id) => document.getElementById(id);
const wideLayout = matchMedia('(min-width: 880px)');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const controlSelector = 'button, a[href], summary, .editor-input';
const controlInkTemplate = byId('control-ink-template');
const taskStates = {
  done: { label: 'Готово', icon: '#check' },
  running: { label: 'В работе', icon: '#clock' },
  paused: { label: 'На паузе', icon: '#pause' },
  next: { label: 'Дальше', icon: '#next' },
  later: { label: '', icon: '#task-dot' },
};

const workspace = byId('workspace');
const list = byId('subtasks');
const saveButton = byId('save-tasks');
const saveLabel = byId('save-label');
const editor = byId('task-editor');
const nameInput = byId('task-name');
const minutesInput = byId('task-minutes');
const remaining = byId('remaining');
const timerTitle = byId('timer-title');
const timerStatus = byId('timer-status');
const statusLabel = byId('status-label');
const pauseLabel = byId('pause-label');
const finishLabel = byId('finish-label');

let tasks = loadTasks();
let activeTaskId = tasks.find((task) => !minutesError(task.minutes))?.id;
let editedTaskId;
let clockInterval;
const clocks = new Map();

function loadTasks() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (Array.isArray(saved) && saved.every((task) => task && typeof task.id === 'string' && typeof task.name === 'string' && !minutesError(task.minutes))) {
      return saved;
    }
  } catch {
    // The draft is still usable when the browser restricts file storage.
  }
  return seedTasks.map((task) => ({ ...task }));
}

function minutesError(minutes) {
  if (!Number.isInteger(minutes) || minutes < 1) return 'Укажи целое число от 1 до 119';
  if (minutes >= 120) return 'Нужно меньше 2 ч';
  return '';
}

function minutesLabel(minutes) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} мин`;
  return rest === 0 ? `${hours} ч` : `${hours} ч ${rest} мин`;
}

function updateText(node, value) {
  if (node.textContent !== value) node.textContent = value;
}

function fadeControlInk(ink) {
  ink.dataset.retiring = '';
  const fade = ink.animate([{ opacity: getComputedStyle(ink).opacity }, { opacity: 0 }], {
    duration: 110,
    easing: 'ease-out',
    fill: 'forwards',
  });
  const removeInk = () => ink.remove();
  fade.finished.then(removeInk, removeInk);
}

function playControlInk(control) {
  if (reducedMotion.matches || !control?.isConnected || control.matches(':disabled')) return;
  if (control.querySelector('input:disabled')) return;
  const surface = control.closest('.task-row') ?? control;
  const previous = surface.querySelector(':scope > .control-ink:not([data-retiring])');

  const ink = controlInkTemplate.content.firstElementChild.cloneNode(true);
  surface.append(ink);
  const [fade] = ink.getAnimations();
  if (!fade) {
    ink.remove();
    return;
  }
  if (previous) fadeControlInk(previous);
  const removeInk = () => ink.remove();
  fade.finished.then(removeInk, removeInk);
}

function updateTaskStates() {
  const activeIndex = tasks.findIndex((task) => task.id === activeTaskId);
  const activeState = clocks.get(activeTaskId)?.state;
  const inProgress = activeState === 'running' || activeState === 'paused';
  const nextStart = inProgress || activeState === 'done' ? activeIndex + 1 : 0;
  const next = tasks.slice(nextStart).find((task) => !minutesError(task.minutes) && clocks.get(task.id)?.state !== 'done');

  for (const [index, task] of tasks.entries()) {
    const row = list.children[index];
    const surface = row.firstElementChild;
    if (surface.hasAttribute('data-invalid')) continue;

    let state = 'later';
    if (clocks.get(task.id)?.state === 'done') state = 'done';
    else if (index === activeIndex && inProgress) state = activeState;
    else if (task === next) state = 'next';
    if (surface.dataset.taskState === state) continue;

    surface.dataset.taskState = state;
    const { label, icon } = taskStates[state];
    const status = row.querySelector('.task-status');
    status.textContent = label;
    status.hidden = !label;
    row.querySelector('.task-state-icon use').setAttribute('href', icon);
    if (state === 'running' || state === 'paused') row.setAttribute('aria-current', 'step');
    else row.removeAttribute('aria-current');
  }
}

function renderTasks() {
  const rows = tasks.map((task) => {
    const row = byId('task-row-template').content.firstElementChild.cloneNode(true);
    const open = row.querySelector('.task-open');
    const edit = row.querySelector('.task-edit');
    const error = row.querySelector('.task-error');
    const message = minutesError(task.minutes);
    const surface = row.querySelector('.task-row');
    row.dataset.taskId = task.id;
    row.querySelector('.task-name').textContent = task.name;
    const duration = row.querySelector('.minutes');
    duration.dateTime = `PT${task.minutes}M`;
    duration.querySelector('.minutes-value').textContent = minutesLabel(task.minutes);
    edit.setAttribute('aria-label', `Редактировать «${task.name}»`);
    surface.toggleAttribute('data-invalid', Boolean(message));
    if (message) {
      row.querySelector('.task-state-icon use').setAttribute('href', '#alert');
      error.id = `duration-error-${task.id}`;
      error.hidden = false;
      error.lastElementChild.textContent = message;
      open.setAttribute('aria-describedby', error.id);
    } else {
      surface.dataset.hoverEffect = 'hatch';
    }
    open.addEventListener('click', () => openTask(task));
    edit.addEventListener('click', () => openEditor(task));
    return row;
  });
  unobserveDrawnOutlines(list);
  list.replaceChildren(...rows);
  updateTaskStates();
  observeDrawnOutlines(list);
  saveButton.disabled = tasks.some((task) => Boolean(minutesError(task.minutes)));
  byId('overview-count').textContent = `Подзадач: ${tasks.length}`;
  byId('open-timer').hidden = tasks.every((task) => minutesError(task.minutes));
}

function openEditor(task) {
  editedTaskId = task?.id;
  byId('editor-title').textContent = task ? 'Редактировать подзадачу' : 'Новая подзадача';
  nameInput.value = task?.name ?? '';
  nameInput.setCustomValidity('');
  minutesInput.value = task?.minutes ?? '';
  byId('delete-task').hidden = !task;
  showMinutesError(task ? minutesError(task.minutes) : '');
  editor.showModal();
  if (task && minutesError(task.minutes)) {
    minutesInput.focus();
    minutesInput.select();
  } else {
    nameInput.select();
  }
}

function showMinutesError(message) {
  byId('minutes-error').textContent = message;
  minutesInput.setAttribute('aria-invalid', String(Boolean(message)));
}

function markDraftChanged() {
  saveLabel.textContent = 'Сохранить';
  byId('save-status').textContent = '';
  renderTasks();
}

function getActiveTask() {
  return tasks.find((task) => task.id === activeTaskId);
}

function getClock(task) {
  let clock = clocks.get(task.id);
  if (!clock) {
    const elapsed = task.id === 'top-shelf' && task.minutes === 45 ? (45 * 60 - 32 * 60 - 10) * 1000 : 0;
    clock = { state: 'ready', elapsed, startedAt: 0 };
    clocks.set(task.id, clock);
  }
  return clock;
}

function usedTime(clock) {
  return clock.elapsed + (clock.state === 'running' ? performance.now() - clock.startedAt : 0);
}

function stopClock(clock, state, limit) {
  clock.elapsed = Math.min(usedTime(clock), limit);
  clock.state = state;
  clearInterval(clockInterval);
}

function startClock(clock) {
  clock.state = 'running';
  clock.startedAt = performance.now();
  clearInterval(clockInterval);
  clockInterval = setInterval(renderTimer, 200);
  renderTimer();
  updateTaskStates();
}

function finishClock(clock, limit) {
  stopClock(clock, 'done', limit);
  updateTaskStates();
}

function showTimerState(state) {
  const labels = {
    ready: ['Готово к запуску', 'Начать', '#play'],
    running: ['В работе', 'Пауза', '#pause'],
    paused: ['На паузе', 'Продолжить', '#play'],
    done: ['Завершено', 'Заново', '#play'],
  };
  const [status, pause, icon] = labels[state];
  timerStatus.dataset.state = state;
  updateText(statusLabel, status);
  updateText(pauseLabel, pause);
  updateText(finishLabel, state === 'done' ? 'К списку' : 'Завершить');
  const statusIcon = { ready: '#play', running: '#play', paused: '#pause', done: '#check' };
  byId('status-icon').setAttribute('href', statusIcon[state]);
  byId('pause-icon').setAttribute('href', icon);
  byId('finish-icon').setAttribute('href', state === 'done' ? '#arrow' : '#check');
}

function renderTimer() {
  const task = getActiveTask();
  const vacant = !task;
  for (const id of ['timer-field', 'timer-actions', 'timer-status', 'restart-timer']) byId(id).hidden = vacant;
  byId('timer-empty').hidden = !vacant;
  if (!task) {
    updateText(timerTitle, 'Таймер');
    return;
  }

  const clock = getClock(task);
  const limit = task.minutes * 60_000;
  const secondsLeft = Math.max(0, Math.ceil((limit - usedTime(clock)) / 1000));
  if (secondsLeft === 0 && clock.state !== 'done') finishClock(clock, limit);
  updateText(timerTitle, task.name);
  remaining.toggleAttribute('data-three-minute-digits', secondsLeft >= 100 * 60);
  updateText(remaining, `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`);
  updateText(byId('timer-total'), `Из ${minutesLabel(task.minutes)}`);
  if (timerStatus.dataset.state !== clock.state) showTimerState(clock.state);
}

function openTask(task) {
  if (minutesError(task.minutes)) {
    openEditor(task);
    return;
  }
  const current = getActiveTask();
  if (current && current.id !== task.id) {
    const currentClock = getClock(current);
    if (currentClock.state === 'running') stopClock(currentClock, 'paused', current.minutes * 60_000);
  }
  activeTaskId = task.id;
  const clock = getClock(task);
  if (clock.state === 'ready') startClock(clock);
  else {
    renderTimer();
    updateTaskStates();
  }
  navigate('timer');
}

function resetTimer() {
  const task = getActiveTask();
  if (!task) return;
  const clock = getClock(task);
  clock.elapsed = 0;
  startClock(clock);
}

function navigate(view) {
  if (location.hash === `#${view}`) {
    renderRoute(true);
  } else {
    location.hash = view;
  }
}

function renderRoute(focusHeading) {
  const fragment = location.hash.slice(1);
  const view = fragment === 'timer' || fragment === 'today' ? fragment : 'tasks';
  workspace.dataset.view = view;
  byId('overview').hidden = view !== 'today';
  byId('task-details').hidden = view === 'today';
  byId('overview-link').hidden = view === 'today';
  byId('overview-link').parentNode.querySelector('.options').hidden = view === 'today';
  document.querySelectorAll('.options[open]').forEach((menu) => { menu.open = false; });
  if (view === 'timer' || wideLayout.matches) {
    const task = getActiveTask();
    const clock = task && getClock(task);
    if (clock?.state === 'ready') startClock(clock);
  }
  if (focusHeading) {
    const titleId = view === 'timer' ? 'timer-title' : `${view}-title`;
    byId(titleId).focus({ preventScroll: true });
    if (!wideLayout.matches) window.scrollTo(0, 0);
  }
}

window.addEventListener('hashchange', () => renderRoute(true));
wideLayout.addEventListener('change', () => renderRoute(false));
document.addEventListener('pointerdown', (event) => {
  if (event.isPrimary && event.button === 0) playControlInk(event.target.closest(controlSelector));
});
document.addEventListener('click', (event) => {
  document.querySelectorAll('.options[open]').forEach((menu) => {
    if (!menu.contains(event.target) || event.target.closest('.menu a, .menu button')) menu.open = false;
  });
  if (event.detail === 0) playControlInk(event.target.closest(controlSelector));
});

for (const id of ['add-task', 'menu-add']) byId(id).addEventListener('click', () => openEditor());
byId('cancel-edit').addEventListener('click', () => editor.close());
nameInput.addEventListener('input', () => nameInput.setCustomValidity(''));
minutesInput.addEventListener('input', () => showMinutesError(minutesError(minutesInput.valueAsNumber)));
byId('edit-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const name = nameInput.value.trim();
  const minutes = minutesInput.valueAsNumber;
  const message = minutesError(minutes);
  showMinutesError(message);
  nameInput.setCustomValidity(name ? '' : 'Введи название подзадачи');
  if (!nameInput.reportValidity()) return;
  if (message) {
    minutesInput.focus();
    return;
  }
  const task = tasks.find((item) => item.id === editedTaskId);
  if (task) {
    Object.assign(task, { name, minutes });
  } else {
    tasks.push({ id: crypto.randomUUID(), name, minutes });
  }
  activeTaskId ??= tasks.find((item) => !minutesError(item.minutes))?.id;
  editor.close();
  markDraftChanged();
  renderTimer();
  (task ? list.querySelector(`[data-task-id="${task.id}"] .task-edit`) : byId('add-task'))?.focus();
});
byId('delete-task').addEventListener('click', () => {
  tasks = tasks.filter((task) => task.id !== editedTaskId);
  clocks.delete(editedTaskId);
  if (editedTaskId === activeTaskId) {
    clearInterval(clockInterval);
    activeTaskId = tasks.find((task) => !minutesError(task.minutes))?.id;
  }
  editor.close();
  markDraftChanged();
  renderTimer();
  byId('add-task').focus();
});
saveButton.addEventListener('click', () => {
  try {
    localStorage.setItem(storageKey, JSON.stringify(tasks));
    saveLabel.textContent = 'Сохранено';
    byId('save-status').textContent = 'Подзадачи сохранены';
  } catch {
    saveLabel.textContent = 'Повторить сохранение';
    byId('save-status').textContent = 'Браузер не смог сохранить подзадачи';
  }
});
byId('pause-timer').addEventListener('click', () => {
  const task = getActiveTask();
  const clock = getClock(task);
  if (clock.state === 'running') {
    stopClock(clock, 'paused', task.minutes * 60_000);
    renderTimer();
    updateTaskStates();
  } else if (clock.state === 'done') {
    resetTimer();
  } else {
    startClock(clock);
  }
});
byId('finish-timer').addEventListener('click', () => {
  const task = getActiveTask();
  const clock = getClock(task);
  if (clock.state === 'done') {
    navigate('tasks');
  } else {
    finishClock(clock, task.minutes * 60_000);
    renderTimer();
  }
});
byId('restart-timer').addEventListener('click', resetTimer);

renderTasks();
renderTimer();
renderRoute(false);
observeDrawnOutlines(document);
