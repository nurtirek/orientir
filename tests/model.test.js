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

function emptyData() {
  return { version: 1, updatedAt: null, areas: Model.DEFAULT_DATA.areas.slice(), dreams: [], goals: [] };
}

test('addGoal добавляет цель и возвращает её id', () => {
  const res = Model.addGoal(emptyData(), { areaId: 'money', horizon: 3, title: 'Подушка на 3 месяца' });
  assert.strictEqual(res.data.goals.length, 1);
  assert.strictEqual(res.data.goals[0].title, 'Подушка на 3 месяца');
  assert.strictEqual(res.data.goals[0].horizon, 3);
  assert.deepStrictEqual(res.data.goals[0].tasks, []);
  assert.ok(Model.findNode(res.data, res.id));
});

test('addGoal проставляет дату старта и пустую заметку', () => {
  const res = Model.addGoal(emptyData(), { areaId: 'money', horizon: 3, title: 'Подушка' });
  assert.match(res.data.goals[0].startedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.strictEqual(res.data.goals[0].start, '');
});

test('addGoal принимает заметку о старте', () => {
  const res = Model.addGoal(emptyData(), {
    areaId: 'skills', horizon: 6, title: 'Английский', start: 'Сейчас A2'
  });
  assert.strictEqual(res.data.goals[0].start, 'Сейчас A2');
});

test('editStart меняет заметку и не трогает дату', () => {
  const g = Model.addGoal(emptyData(), { areaId: 'skills', horizon: 6, title: 'Английский', start: 'A2' });
  const was = g.data.goals[0].startedAt;
  const next = Model.editStart(g.data, g.id, 'Сейчас A2, читаю со словарём');
  assert.strictEqual(next.goals[0].start, 'Сейчас A2, читаю со словарём');
  assert.strictEqual(next.goals[0].startedAt, was, 'дата старта не сдвигается');
});

test('editStart разрешает стереть заметку в пустую', () => {
  const g = Model.addGoal(emptyData(), { areaId: 'skills', horizon: 6, title: 'X', start: 'A2' });
  const next = Model.editStart(g.data, g.id, '');
  assert.strictEqual(next.goals[0].start, '');
});

test('правка названия не трогает стартовую точку', () => {
  const g = Model.addGoal(emptyData(), { areaId: 'skills', horizon: 6, title: 'Старое', start: 'A2' });
  const next = Model.editTitle(g.data, g.id, 'Новое');
  assert.strictEqual(next.goals[0].start, 'A2');
  assert.strictEqual(next.goals[0].startedAt, g.data.goals[0].startedAt);
});

test('addGoal отклоняет пустое название', () => {
  const res = Model.addGoal(emptyData(), { areaId: 'money', horizon: 3, title: '   ' });
  assert.strictEqual(res.id, null);
  assert.strictEqual(res.data.goals.length, 0);
});

test('addGoal отклоняет недопустимый горизонт', () => {
  const res = Model.addGoal(emptyData(), { areaId: 'money', horizon: 4, title: 'Что-то' });
  assert.strictEqual(res.id, null);
});

test('addTask добавляет задачу в цель без задач', () => {
  const first = Model.addGoal(emptyData(), { areaId: 'skills', horizon: 6, title: 'Английский' });
  const res = Model.addTask(first.data, first.id, 'Найти преподавателя');
  const goal = Model.findNode(res.data, first.id);
  assert.strictEqual(goal.tasks.length, 1);
  assert.strictEqual(goal.tasks[0].title, 'Найти преподавателя');
});

test('addTask добавляет подзадачу вторым уровнем', () => {
  const g = Model.addGoal(emptyData(), { areaId: 'skills', horizon: 6, title: 'Английский' });
  const t = Model.addTask(g.data, g.id, 'Найти преподавателя');
  const s = Model.addTask(t.data, t.id, 'Написать троим');
  const goal = Model.findNode(s.data, g.id);
  assert.strictEqual(goal.tasks[0].tasks.length, 1);
});

test('addTask не создаёт третий уровень', () => {
  const g = Model.addGoal(emptyData(), { areaId: 'skills', horizon: 6, title: 'Английский' });
  const t = Model.addTask(g.data, g.id, 'Задача');
  const s = Model.addTask(t.data, t.id, 'Подзадача');
  const deeper = Model.addTask(s.data, s.id, 'Слишком глубоко');
  assert.strictEqual(deeper.id, null);
  const goal = Model.findNode(deeper.data, g.id);
  assert.strictEqual(goal.tasks[0].tasks[0].tasks.length, 0);
});

test('editTitle меняет название', () => {
  const g = Model.addGoal(emptyData(), { areaId: 'home', horizon: 12, title: 'Старое' });
  const next = Model.editTitle(g.data, g.id, 'Новое');
  assert.strictEqual(Model.findNode(next, g.id).title, 'Новое');
});

test('editTitle не стирает название пустой строкой', () => {
  const g = Model.addGoal(emptyData(), { areaId: 'home', horizon: 12, title: 'Старое' });
  const next = Model.editTitle(g.data, g.id, '  ');
  assert.strictEqual(Model.findNode(next, g.id).title, 'Старое');
});

test('removeNode удаляет цель вместе с задачами', () => {
  const g = Model.addGoal(emptyData(), { areaId: 'skills', horizon: 3, title: 'Цель' });
  const t = Model.addTask(g.data, g.id, 'Задача');
  const next = Model.removeNode(t.data, g.id);
  assert.strictEqual(next.goals.length, 0);
  assert.strictEqual(Model.findNode(next, t.id), null);
});

test('removeNode удаляет отдельную задачу, не трогая цель', () => {
  const g = Model.addGoal(emptyData(), { areaId: 'skills', horizon: 3, title: 'Цель' });
  const t = Model.addTask(g.data, g.id, 'Задача');
  const next = Model.removeNode(t.data, t.id);
  assert.strictEqual(next.goals.length, 1);
  assert.strictEqual(next.goals[0].tasks.length, 0);
});

test('goalsFor отбирает по горизонту и сфере', () => {
  let d = emptyData();
  d = Model.addGoal(d, { areaId: 'money', horizon: 3, title: 'A' }).data;
  d = Model.addGoal(d, { areaId: 'money', horizon: 6, title: 'B' }).data;
  d = Model.addGoal(d, { areaId: 'health', horizon: 3, title: 'C' }).data;
  const list = Model.goalsFor(d, 3, 'money');
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].title, 'A');
});

test('goalsFor уводит выполненные вниз', () => {
  let d = emptyData();
  const a = Model.addGoal(d, { areaId: 'money', horizon: 3, title: 'Сделано' });
  d = Model.addGoal(a.data, { areaId: 'money', horizon: 3, title: 'В работе' }).data;
  d = Model.toggle(d, a.id);
  const list = Model.goalsFor(d, 3, 'money');
  assert.strictEqual(list[0].title, 'В работе');
  assert.strictEqual(list[1].title, 'Сделано');
});

test('addArea добавляет сферу', () => {
  const res = Model.addArea(emptyData(), 'Путешествия');
  assert.strictEqual(res.data.areas.length, 6);
  assert.ok(res.id);
});

test('renameArea меняет название во всех горизонтах сразу', () => {
  const next = Model.renameArea(emptyData(), 'money', 'Финансы');
  assert.strictEqual(next.areas.find(a => a.id === 'money').name, 'Финансы');
});

test('removeArea удаляет пустую сферу', () => {
  const next = Model.removeArea(emptyData(), 'home');
  assert.strictEqual(next.areas.some(a => a.id === 'home'), false);
});

test('removeArea отказывается удалять сферу с целями', () => {
  const g = Model.addGoal(emptyData(), { areaId: 'home', horizon: 3, title: 'Ремонт' });
  const next = Model.removeArea(g.data, 'home');
  assert.strictEqual(next.areas.some(a => a.id === 'home'), true, 'сфера с целями остаётся');
  assert.strictEqual(next.goals.length, 1);
});

test('addDream добавляет мечту без фото', () => {
  const res = Model.addDream(emptyData(), 'Своя мастерская');
  assert.strictEqual(res.data.dreams.length, 1);
  assert.strictEqual(res.data.dreams[0].image, null);
  assert.strictEqual(res.data.dreams[0].note, '');
});

test('editDream проставляет имя файла картинки', () => {
  const d = Model.addDream(emptyData(), 'Мастерская');
  const next = Model.editDream(d.data, d.id, { image: 'workshop.jpg' });
  assert.strictEqual(next.dreams[0].image, 'workshop.jpg');
  assert.strictEqual(next.dreams[0].title, 'Мастерская', 'остальные поля не тронуты');
});

test('editDream не стирает название пустой строкой', () => {
  const d = Model.addDream(emptyData(), 'Мастерская');
  const next = Model.editDream(d.data, d.id, { title: '  ' });
  assert.strictEqual(next.dreams[0].title, 'Мастерская');
});

test('removeDream удаляет мечту', () => {
  const d = Model.addDream(emptyData(), 'Мастерская');
  const next = Model.removeDream(d.data, d.id);
  assert.strictEqual(next.dreams.length, 0);
});
