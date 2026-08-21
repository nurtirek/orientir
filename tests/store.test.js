'use strict';
const test = require('node:test');
const assert = require('node:assert');
const Model = require('../js/model.js');
const Store = require('../js/store.js');

function fakeStorage() {
  const map = new Map();
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: k => { map.delete(k); }
  };
}

function brokenStorage() {
  return {
    getItem: () => { throw new Error('SecurityError'); },
    setItem: () => { throw new Error('SecurityError'); },
    removeItem: () => { throw new Error('SecurityError'); }
  };
}

test('на пустом хранилище отдаются стартовые данные', () => {
  const res = Store.load(fakeStorage());
  assert.strictEqual(res.data.areas.length, 5);
  assert.strictEqual(res.source, 'default');
});

test('сохранённое возвращается обратно', () => {
  const storage = fakeStorage();
  let data = Model.DEFAULT_DATA;
  data = Model.addGoal(data, { areaId: 'money', horizon: 3, title: 'Подушка' }).data;
  Store.save(storage, data);
  const res = Store.load(storage);
  assert.strictEqual(res.source, 'storage');
  assert.strictEqual(res.data.goals.length, 1);
  assert.strictEqual(res.data.goals[0].title, 'Подушка');
});

test('испорченная запись не роняет загрузку', () => {
  const storage = fakeStorage();
  storage.setItem('wishmap-v1', '{сломано');
  const res = Store.load(storage);
  assert.strictEqual(res.source, 'default');
  assert.ok(res.warning);
});

test('запись чужой версии не роняет загрузку', () => {
  const storage = fakeStorage();
  storage.setItem('wishmap-v1', JSON.stringify({ version: 99 }));
  const res = Store.load(storage);
  assert.strictEqual(res.source, 'default');
  assert.ok(res.warning);
});

test('недоступное хранилище распознаётся', () => {
  assert.strictEqual(Store.available(fakeStorage()), true);
  assert.strictEqual(Store.available(brokenStorage()), false);
});

test('загрузка из недоступного хранилища отдаёт стартовые данные с предупреждением', () => {
  const res = Store.load(brokenStorage());
  assert.strictEqual(res.source, 'default');
  assert.ok(res.warning);
});

test('save на недоступном хранилище не бросает исключение', () => {
  assert.doesNotThrow(() => Store.save(brokenStorage(), Model.DEFAULT_DATA));
  assert.strictEqual(Store.save(brokenStorage(), Model.DEFAULT_DATA), false);
});

test('имя файла копии содержит дату', () => {
  assert.match(Store.exportName(new Date('2026-08-22T10:00:00Z')), /^plans-2026-08-22\.json$/);
});
