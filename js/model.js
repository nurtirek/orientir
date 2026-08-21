(function (root) {
  'use strict';

  const HORIZONS = [3, 6, 12];
  const VERSION = 1;

  const DEFAULT_DATA = {
    version: VERSION,
    updatedAt: null,
    areas: [
      { id: 'money', name: 'Деньги' },
      { id: 'health', name: 'Здоровье' },
      { id: 'skills', name: 'Навыки' },
      { id: 'people', name: 'Отношения' },
      { id: 'home', name: 'Дом' }
    ],
    dreams: [
      { id: 'd1', title: 'Резиденция в горах',      note: 'Камень, свет и тишина',            image: 'rezidenciya-v-gorah.jpg' },
      { id: 'd2', title: 'Квартира с панорамой',    note: 'Город во всю стену',               image: 'kvartira-s-panoramoy.jpg' },
      { id: 'd3', title: 'Дом в тихом квартале',    note: 'Зелень под окнами, свои дворы',    image: 'dom-v-tihom-kvartale.jpg' },
      { id: 'd4', title: 'Forbes 30 под 30',        note: 'Попасть в список до тридцати',     image: 'forbes.jpg' },
      { id: 'd5', title: 'Капитал',                 note: 'Деньги, которые работают сами',    image: 'kapital.jpg' },
      { id: 'd6', title: 'Genesis G80',             note: 'Первая своя машина',               image: 'genesis-g80.jpg' },
      { id: 'd7', title: 'Гелендваген',             note: 'Чёрный, без компромиссов',         image: 'gelendvagen.jpg' },
      { id: 'd8', title: 'Электроседан',            note: 'Тихий и быстрый',                  image: 'elektrosedan.jpg' },
      { id: 'd9', title: 'Форма',                   note: 'Сухой вес и выносливость',         image: 'forma.jpg' }
    ],
    goals: []
  };

  let counter = 0;
  function createId(prefix) {
    counter += 1;
    return prefix + Date.now().toString(36) + counter.toString(36);
  }

  function validate(data) {
    if (!data || typeof data !== 'object') return { ok: false, error: 'Данные не объект' };
    if (data.version !== VERSION) return { ok: false, error: 'Другая версия данных' };
    if (!Array.isArray(data.areas)) return { ok: false, error: 'Нет списка сфер' };
    if (!Array.isArray(data.dreams)) return { ok: false, error: 'Нет списка мечт' };
    if (!Array.isArray(data.goals)) return { ok: false, error: 'Нет списка целей' };

    const areaIds = new Set(data.areas.map(a => a.id));
    for (const goal of data.goals) {
      if (!HORIZONS.includes(goal.horizon)) {
        return { ok: false, error: 'Недопустимый горизонт у цели: ' + goal.title };
      }
      if (!areaIds.has(goal.areaId)) {
        return { ok: false, error: 'Цель ссылается на несуществующую сферу: ' + goal.title };
      }
      if (typeof goal.startedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(goal.startedAt)) {
        return { ok: false, error: 'У цели нет даты старта: ' + goal.title };
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

  function children(node) {
    return Array.isArray(node.tasks) ? node.tasks : [];
  }

  function isDone(node) {
    const kids = children(node);
    if (kids.length === 0) return node.done === true;
    return kids.every(isDone);
  }

  function progress(node) {
    const kids = children(node);
    if (kids.length === 0) return null;
    return { done: kids.filter(isDone).length, total: kids.length };
  }

  function canToggle(node) {
    return children(node).length === 0;
  }

  function findNode(data, id) {
    function walk(nodes) {
      for (const node of nodes) {
        if (node.id === id) return node;
        const found = walk(children(node));
        if (found) return found;
      }
      return null;
    }
    return walk(data.goals);
  }

  function clone(data) {
    return JSON.parse(JSON.stringify(data));
  }

  function toggle(data, id) {
    const next = clone(data);
    const node = findNode(next, id);
    if (!node || !canToggle(node)) return next;
    node.done = !node.done;
    return next;
  }

  const MAX_DEPTH = 2;

  function today(now) {
    /* по местному времени, не по UTC: иначе всё, что заведено ночью,
       помечается вчерашним днём в часовых поясах восточнее Гринвича */
    var d = now || new Date();
    var m = String(d.getMonth() + 1);
    var day = String(d.getDate());
    return d.getFullYear() + '-' + (m.length < 2 ? '0' + m : m) + '-' + (day.length < 2 ? '0' + day : day);
  }

  function depthOf(data, id) {
    function walk(nodes, level) {
      for (const node of nodes) {
        if (node.id === id) return level;
        const found = walk(children(node), level + 1);
        if (found !== -1) return found;
      }
      return -1;
    }
    return walk(data.goals, 0);
  }

  function addGoal(data, opts) {
    const next = clone(data);
    const title = String(opts.title || '').trim();
    const areaExists = next.areas.some(a => a.id === opts.areaId);
    if (!title || !HORIZONS.includes(opts.horizon) || !areaExists) {
      return { data: next, id: null };
    }
    const goal = {
      id: createId('g'), title: title, areaId: opts.areaId,
      horizon: opts.horizon,
      start: String(opts.start || '').trim(),
      startedAt: today(),
      done: false, tasks: []
    };
    next.goals.push(goal);
    return { data: next, id: goal.id };
  }

  function addTask(data, parentId, title) {
    const next = clone(data);
    const clean = String(title || '').trim();
    const parent = findNode(next, parentId);
    if (!clean || !parent) return { data: next, id: null };
    if (depthOf(next, parentId) >= MAX_DEPTH) return { data: next, id: null };
    const node = { id: createId('t'), title: clean, done: false, tasks: [] };
    parent.tasks.push(node);
    return { data: next, id: node.id };
  }

  function editStart(data, goalId, start) {
    const next = clone(data);
    const goal = next.goals.find(g => g.id === goalId);
    if (goal) goal.start = String(start == null ? '' : start).trim();
    return next;
  }

  function editTitle(data, id, title) {
    const next = clone(data);
    const clean = String(title || '').trim();
    const node = findNode(next, id);
    if (node && clean) node.title = clean;
    return next;
  }

  function removeNode(data, id) {
    const next = clone(data);
    function strip(list) {
      const index = list.findIndex(n => n.id === id);
      if (index !== -1) { list.splice(index, 1); return true; }
      return list.some(n => strip(children(n)));
    }
    strip(next.goals);
    return next;
  }

  function goalsFor(data, horizon, areaId) {
    return data.goals
      .filter(g => g.horizon === horizon && g.areaId === areaId)
      .slice()
      .sort((a, b) => Number(isDone(a)) - Number(isDone(b)));
  }

  function addArea(data, name) {
    const next = clone(data);
    const clean = String(name || '').trim();
    if (!clean) return { data: next, id: null };
    const area = { id: createId('a'), name: clean };
    next.areas.push(area);
    return { data: next, id: area.id };
  }

  function renameArea(data, id, name) {
    const next = clone(data);
    const clean = String(name || '').trim();
    const area = next.areas.find(a => a.id === id);
    if (area && clean) area.name = clean;
    return next;
  }

  function removeArea(data, id) {
    const next = clone(data);
    const used = next.goals.some(g => g.areaId === id);
    if (used) return next;
    next.areas = next.areas.filter(a => a.id !== id);
    return next;
  }

  function addDream(data, title) {
    const next = clone(data);
    const clean = String(title || '').trim();
    if (!clean) return { data: next, id: null };
    const dream = { id: createId('d'), title: clean, note: '', image: null };
    next.dreams.push(dream);
    return { data: next, id: dream.id };
  }

  function editDream(data, id, patch) {
    const next = clone(data);
    const dream = next.dreams.find(d => d.id === id);
    if (!dream) return next;
    if (typeof patch.title === 'string' && patch.title.trim()) dream.title = patch.title.trim();
    if (typeof patch.note === 'string') dream.note = patch.note;
    if (patch.image === null || typeof patch.image === 'string') dream.image = patch.image;
    return next;
  }

  function removeDream(data, id) {
    const next = clone(data);
    next.dreams = next.dreams.filter(d => d.id !== id);
    return next;
  }

  const Model = {
    HORIZONS, VERSION, DEFAULT_DATA, createId, validate, parse, serialize,
    isDone, progress, canToggle, findNode, clone, toggle,
    addGoal, addTask, editTitle, editStart, today, removeNode, goalsFor, depthOf,
    addArea, renameArea, removeArea, addDream, editDream, removeDream
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Model;
  else root.Model = Model;
})(typeof globalThis !== 'undefined' ? globalThis : this);
