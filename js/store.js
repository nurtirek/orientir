(function (root) {
  'use strict';

  const KEY = 'wishmap-v1';
  const Model = (typeof module !== 'undefined' && module.exports)
    ? require('./model.js')
    : root.Model;

  function available(storage) {
    try {
      storage.setItem(KEY + '-probe', '1');
      storage.removeItem(KEY + '-probe');
      return true;
    } catch (e) {
      return false;
    }
  }

  function load(storage) {
    let raw = null;
    try {
      raw = storage.getItem(KEY);
    } catch (e) {
      return {
        data: Model.clone(Model.DEFAULT_DATA),
        source: 'default',
        warning: 'Браузер не даёт сохранять на этой странице. Правки не переживут перезагрузку — пользуйтесь кнопкой «Сохранить копию».'
      };
    }
    if (!raw) {
      return { data: Model.clone(Model.DEFAULT_DATA), source: 'default', warning: null };
    }
    const res = Model.parse(raw);
    if (!res.ok) {
      return {
        data: Model.clone(Model.DEFAULT_DATA),
        source: 'default',
        warning: 'Сохранённые данные повреждены: ' + res.error + '. Открыт стартовый набор.'
      };
    }
    return { data: res.data, source: 'storage', warning: null };
  }

  function save(storage, data) {
    try {
      storage.setItem(KEY, Model.serialize(data));
      return true;
    } catch (e) {
      return false;
    }
  }

  function exportName(date) {
    const d = date || new Date();
    const iso = d.toISOString().slice(0, 10);
    return 'plans-' + iso + '.json';
  }

  const Store = { KEY, available, load, save, exportName };

  if (typeof module !== 'undefined' && module.exports) module.exports = Store;
  else root.Store = Store;
})(typeof globalThis !== 'undefined' ? globalThis : this);
