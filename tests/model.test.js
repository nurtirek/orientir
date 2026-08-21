'use strict';
const test = require('node:test');
const assert = require('node:assert');
const Model = require('../js/model.js');

test('стартовые данные проходят валидацию', () => {
  const res = Model.validate(Model.DEFAULT_DATA);
  assert.strictEqual(res.ok, true);
});

test('стартовые данные содержат пять сфер и ни одной цели', () => {
  assert.strictEqual(Model.DEFAULT_DATA.areas.length, 5);
  assert.strictEqual(Model.DEFAULT_DATA.goals.length, 0);
  assert.strictEqual(Model.DEFAULT_DATA.dreams.length, 0);
});

test('горизонты — только 3, 6 и 12', () => {
  assert.deepStrictEqual(Model.HORIZONS, [3, 6, 12]);
});

test('createId выдаёт разные значения с нужным префиксом', () => {
  const a = Model.createId('g');
  const b = Model.createId('g');
  assert.notStrictEqual(a, b);
  assert.ok(a.startsWith('g'));
});

test('данные без version отклоняются', () => {
  const res = Model.validate({ areas: [], dreams: [], goals: [] });
  assert.strictEqual(res.ok, false);
  assert.match(res.error, /версия/i);
});

test('данные с чужой version отклоняются', () => {
  const res = Model.validate({ version: 99, areas: [], dreams: [], goals: [] });
  assert.strictEqual(res.ok, false);
  assert.match(res.error, /версия/i);
});

test('цель с недопустимым горизонтом отклоняется', () => {
  const data = {
    version: 1, areas: [{ id: 'a', name: 'A' }], dreams: [],
    goals: [{ id: 'g1', title: 'X', areaId: 'a', horizon: 9, start: '', startedAt: '2026-08-22', done: false, tasks: [] }]
  };
  const res = Model.validate(data);
  assert.strictEqual(res.ok, false);
  assert.match(res.error, /горизонт/i);
});

test('цель со ссылкой на несуществующую сферу отклоняется', () => {
  const data = {
    version: 1, areas: [{ id: 'a', name: 'A' }], dreams: [],
    goals: [{ id: 'g1', title: 'X', areaId: 'нет', horizon: 3, start: '', startedAt: '2026-08-22', done: false, tasks: [] }]
  };
  const res = Model.validate(data);
  assert.strictEqual(res.ok, false);
  assert.match(res.error, /сфер/i);
});

test('serialize и parse дают исходные данные', () => {
  const json = Model.serialize(Model.DEFAULT_DATA);
  const res = Model.parse(json);
  assert.strictEqual(res.ok, true);
  assert.deepStrictEqual(res.data.areas, Model.DEFAULT_DATA.areas);
});

test('parse на битой строке не бросает исключение', () => {
  const res = Model.parse('{это не json');
  assert.strictEqual(res.ok, false);
  assert.match(res.error, /разобрать/i);
});
