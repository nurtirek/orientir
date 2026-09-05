(function (root) {
  'use strict';

  const VERSION = 2;

  const SPHERES = [
    { id: 'work',   name: 'Работа',  color: '#4f7cff', kind: 'tasks' },
    { id: 'gym',    name: 'Зал',     color: '#ff6b4a', kind: 'gym'   },
    { id: 'social', name: 'Соцсети', color: '#c463ff', kind: 'tasks' },
    { id: 'study',  name: 'Учёба',   color: '#25c2a0', kind: 'tasks' },
    { id: 'money',  name: 'Деньги',  color: '#f2b134', kind: 'money' }
  ];

  const TASK_SPHERES = SPHERES.filter(s => s.kind === 'tasks').map(s => s.id);

  const DEFAULT_DATA = {
    version: VERSION,
    updatedAt: null,
    tasks: [],
    workouts: [],
    money: { goal: 0, entries: [] }
  };

  let counter = 0;
  function createId(prefix) {
    counter += 1;
    return prefix + Date.now().toString(36) + counter.toString(36);
  }

  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  function isDate(value) {
    return typeof value === 'string' && DATE_RE.test(value);
  }

  function today(now) {
    /* по местному времени, не по UTC: иначе всё, что заведено ночью,
       помечается вчерашним днём в часовых поясах восточнее Гринвича */
    const d = now || new Date();
    const m = String(d.getMonth() + 1);
    const day = String(d.getDate());
    return d.getFullYear() + '-' + (m.length < 2 ? '0' + m : m) + '-' + (day.length < 2 ? '0' + day : day);
  }

  function sphere(id) {
    return SPHERES.find(s => s.id === id) || null;
  }

  function clone(data) {
    return JSON.parse(JSON.stringify(data));
  }

  function validate(data) {
    if (!data || typeof data !== 'object') return { ok: false, error: 'Данные не объект' };
    if (data.version !== VERSION) return { ok: false, error: 'Другая версия данных' };
    if (!Array.isArray(data.tasks)) return { ok: false, error: 'Нет списка задач' };
    if (!Array.isArray(data.workouts)) return { ok: false, error: 'Нет списка тренировок' };
    if (!data.money || typeof data.money !== 'object') return { ok: false, error: 'Нет раздела денег' };
    if (!Array.isArray(data.money.entries)) return { ok: false, error: 'Нет списка операций' };
    if (typeof data.money.goal !== 'number' || data.money.goal < 0) {
      return { ok: false, error: 'Неверная цель накопления' };
    }

    for (const task of data.tasks) {
      if (!task || typeof task.title !== 'string' || !task.title.trim()) {
        return { ok: false, error: 'У задачи нет названия' };
      }
      if (TASK_SPHERES.indexOf(task.sphereId) === -1) {
        return { ok: false, error: 'Задача в чужой сфере: ' + task.title };
      }
      if (task.due !== null && !isDate(task.due)) {
        return { ok: false, error: 'Неверный срок у задачи: ' + task.title };
      }
      /* start появился позже due, поэтому у старых записей его может не быть */
      if (task.start !== undefined && task.start !== null) {
        if (!isDate(task.start)) return { ok: false, error: 'Неверное начало у задачи: ' + task.title };
        if (!task.due || task.start > task.due) {
          return { ok: false, error: 'Период задачи кончается раньше, чем начинается: ' + task.title };
        }
      }
      if (typeof task.done !== 'boolean') {
        return { ok: false, error: 'У задачи нет отметки о выполнении: ' + task.title };
      }
    }

    for (const workout of data.workouts) {
      if (!workout || !isDate(workout.date)) return { ok: false, error: 'У тренировки нет даты' };
      if (typeof workout.exercise !== 'string' || !workout.exercise.trim()) {
        return { ok: false, error: 'У тренировки нет упражнения' };
      }
      if (!Array.isArray(workout.sets) || workout.sets.length === 0) {
        return { ok: false, error: 'У тренировки нет подходов: ' + workout.exercise };
      }
      for (const set of workout.sets) {
        if (!set || !(set.weight > 0) || !(set.reps > 0)) {
          return { ok: false, error: 'Неверный подход: ' + workout.exercise };
        }
      }
    }

    for (const entry of data.money.entries) {
      if (!entry || !isDate(entry.date)) return { ok: false, error: 'У операции нет даты' };
      if (['spend', 'income', 'save'].indexOf(entry.kind) === -1) {
        return { ok: false, error: 'Неизвестный вид операции' };
      }
      if (!Number.isFinite(entry.amount) || entry.amount <= 0) {
        return { ok: false, error: 'Неверная сумма операции' };
      }
    }

    return { ok: true, data: data };
  }

  function parse(json) {
    let raw;
    try {
      raw = JSON.parse(json);
    } catch (e) {
      return { ok: false, error: 'Не удалось разобрать файл' };
    }
    return validate(raw);
  }

  function serialize(data) {
    const copy = Object.assign({}, data, { updatedAt: new Date().toISOString() });
    return JSON.stringify(copy, null, 2);
  }

  function cleanDue(due) {
    const value = String(due == null ? '' : due).trim();
    return isDate(value) ? value : null;
  }

  /* период живёт только вместе со сроком и не может кончиться раньше начала */
  function cleanStart(start, due) {
    const value = cleanDue(start);
    if (!value || !due || value > due) return null;
    return value;
  }

  function addTask(data, sphereId, title, due, start) {
    const next = clone(data);
    const clean = String(title || '').trim();
    if (!clean || TASK_SPHERES.indexOf(sphereId) === -1) return { data: next, id: null };
    const deadline = cleanDue(due);
    const task = {
      id: createId('t'),
      sphereId: sphereId,
      title: clean,
      due: deadline,
      start: cleanStart(start, deadline),
      done: false,
      createdAt: today(),
      doneAt: null
    };
    next.tasks.push(task);
    return { data: next, id: task.id };
  }

  function findTask(data, id) {
    return data.tasks.find(t => t.id === id) || null;
  }

  function toggleTask(data, id) {
    const next = clone(data);
    const task = findTask(next, id);
    if (!task) return next;
    task.done = !task.done;
    task.doneAt = task.done ? today() : null;
    return next;
  }

  function editTaskTitle(data, id, title) {
    const next = clone(data);
    const task = findTask(next, id);
    const clean = String(title || '').trim();
    if (task && clean) task.title = clean;
    return next;
  }

  function editTaskDue(data, id, due) {
    const next = clone(data);
    const task = findTask(next, id);
    if (!task) return next;
    task.due = cleanDue(due);
    task.start = cleanStart(task.start, task.due);
    return next;
  }

  function editTaskStart(data, id, start) {
    const next = clone(data);
    const task = findTask(next, id);
    if (task) task.start = cleanStart(start, task.due);
    return next;
  }

  /* задача занимает день, если это её срок или день внутри периода */
  function coversDay(task, date) {
    if (!task.due) return false;
    if (task.due === date) return true;
    return !!task.start && task.start <= date && date <= task.due;
  }

  function removeTask(data, id) {
    const next = clone(data);
    next.tasks = next.tasks.filter(t => t.id !== id);
    return next;
  }

  function tasksOf(data, sphereId) {
    /* сначала несделанные: со сроком по возрастанию, без срока в конце;
       сделанные всегда внизу */
    return data.tasks
      .filter(t => t.sphereId === sphereId)
      .slice()
      .sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        if (a.due && b.due) return a.due < b.due ? -1 : (a.due > b.due ? 1 : 0);
        if (a.due) return -1;
        if (b.due) return 1;
        return 0;
      });
  }

  const Model = {
    VERSION, SPHERES, TASK_SPHERES, DEFAULT_DATA,
    createId, isDate, today, sphere, clone,
    validate, parse, serialize,
    addTask, findTask, toggleTask, editTaskTitle, editTaskDue, editTaskStart, removeTask, tasksOf, coversDay
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Model;
  else root.Model = Model;
})(typeof globalThis !== 'undefined' ? globalThis : this);
