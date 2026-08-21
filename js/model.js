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

  const Model = { HORIZONS, VERSION, DEFAULT_DATA, createId, validate, parse, serialize };

  if (typeof module !== 'undefined' && module.exports) module.exports = Model;
  else root.Model = Model;
})(typeof globalThis !== 'undefined' ? globalThis : this);
