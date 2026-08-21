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
    dreams: [],
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

  function today() {
    return new Date().toISOString().slice(0, 10);
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

  const Model = {
    HORIZONS, VERSION, DEFAULT_DATA, createId, validate, parse, serialize,
    isDone, progress, canToggle, findNode, clone, toggle,
    addGoal, addTask, editTitle, editStart, today, removeNode, goalsFor, depthOf
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Model;
  else root.Model = Model;
})(typeof globalThis !== 'undefined' ? globalThis : this);
