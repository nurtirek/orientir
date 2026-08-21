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

function goalWith(tasks) {
  return { id: 'g1', title: 'Цель', areaId: 'skills', horizon: 6, start: '', startedAt: '2026-08-22', done: false, tasks: tasks };
}
function task(id, done, subs) {
  return { id: id, title: 'Задача ' + id, done: done, tasks: subs || [] };
}

test('цель без задач берёт своё состояние из done', () => {
  assert.strictEqual(Model.isDone(goalWith([])), false);
  const closed = goalWith([]);
  closed.done = true;
  assert.strictEqual(Model.isDone(closed), true);
});

test('цель с задачами закрыта, только когда закрыты все прямые дети', () => {
  const partly = goalWith([task('t1', true), task('t2', false)]);
  assert.strictEqual(Model.isDone(partly), false);
  const whole = goalWith([task('t1', true), task('t2', true)]);
  assert.strictEqual(Model.isDone(whole), true);
});

test('флаг done у цели с задачами игнорируется', () => {
  const lying = goalWith([task('t1', false)]);
  lying.done = true;
  assert.strictEqual(Model.isDone(lying), false);
});

test('задача с подзадачами считается так же', () => {
  const parent = task('t1', false, [task('s1', true), task('s2', true)]);
  assert.strictEqual(Model.isDone(parent), true);
});

test('счётчик считает прямых детей, а не листья', () => {
  const goal = goalWith([
    task('t1', false, [task('s1', true), task('s2', true)]),
    task('t2', false)
  ]);
  assert.deepStrictEqual(Model.progress(goal), { done: 1, total: 2 });
});

test('у элемента без детей счётчика нет', () => {
  assert.strictEqual(Model.progress(goalWith([])), null);
});

test('переключать можно только элемент без детей', () => {
  assert.strictEqual(Model.canToggle(goalWith([])), true);
  assert.strictEqual(Model.canToggle(goalWith([task('t1', false)])), false);
});

test('toggle меняет состояние элемента без детей', () => {
  const data = { version: 1, updatedAt: null, areas: Model.DEFAULT_DATA.areas, dreams: [], goals: [goalWith([])] };
  const next = Model.toggle(data, 'g1');
  assert.strictEqual(next.goals[0].done, true);
  assert.strictEqual(data.goals[0].done, false, 'исходные данные не меняются');
});

test('toggle не трогает элемент с детьми', () => {
  const data = { version: 1, updatedAt: null, areas: Model.DEFAULT_DATA.areas, dreams: [], goals: [goalWith([task('t1', false)])] };
  const next = Model.toggle(data, 'g1');
  assert.strictEqual(Model.isDone(next.goals[0]), false);
});

test('toggle находит вложенную подзадачу', () => {
  const data = {
    version: 1, updatedAt: null, areas: Model.DEFAULT_DATA.areas, dreams: [],
    goals: [goalWith([task('t1', false, [task('s1', false)])])]
  };
  const next = Model.toggle(data, 's1');
  assert.strictEqual(next.goals[0].tasks[0].tasks[0].done, true);
  assert.strictEqual(Model.isDone(next.goals[0]), true, 'закрытие последней подзадачи закрывает всю цепочку');
});
