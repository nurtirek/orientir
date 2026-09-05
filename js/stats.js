(function (root) {
  'use strict';

  const isNode = typeof module !== 'undefined' && module.exports;
  const Model = isNode ? require('./model.js') : root.Model;
  const Money = isNode ? require('./money.js') : root.Money;

  const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

  const MONEY_FLOORS = 20;
  const MONEY_STEP = 10000;

  function plural(n, forms) {
    const десятки = Math.abs(n) % 100;
    const единицы = Math.abs(n) % 10;
    if (десятки > 10 && десятки < 20) return forms[2];
    if (единицы > 1 && единицы < 5) return forms[1];
    if (единицы === 1) return forms[0];
    return forms[2];
  }

  function fill(data, sphereId) {
    const s = Model.sphere(sphereId);
    if (!s) return { filled: 0, total: 0 };

    if (s.kind === 'tasks') {
      const мои = data.tasks.filter(t => t.sphereId === sphereId);
      return { filled: мои.filter(t => t.done).length, total: мои.length };
    }

    if (s.kind === 'gym') {
      const n = data.workouts.length;
      return { filled: n, total: n };
    }

    const прогресс = Money.progress(data);
    if (прогресс.goal > 0) {
      const этажи = Math.min(MONEY_FLOORS, Math.round(прогресс.percent / 100 * MONEY_FLOORS));
      return { filled: этажи, total: MONEY_FLOORS };
    }
    const n = Math.floor(прогресс.saved / MONEY_STEP);
    return { filled: n, total: n };
  }

  function label(data, sphereId) {
    const s = Model.sphere(sphereId);
    if (!s) return '';

    if (s.kind === 'gym') {
      const n = data.workouts.length;
      if (n === 0) return 'пусто';
      return n + ' ' + plural(n, ['тренировка', 'тренировки', 'тренировок']);
    }

    if (s.kind === 'money') {
      const прогресс = Money.progress(data);
      if (прогресс.goal > 0) return прогресс.percent + '\u00A0%\u00A0к цели';
      if (прогресс.saved > 0) return Money.format(прогресс.saved);
      return 'пусто';
    }

    const счёт = fill(data, sphereId);
    if (счёт.total === 0) return 'пусто';
    return счёт.filled + ' из ' + счёт.total;
  }

  function tasksOn(data, date) {
    return data.tasks.filter(t => t.due === date);
  }

  function overdue(data, today) {
    return data.tasks.filter(t => !t.done && t.due && t.due < today);
  }

  function upcoming(data, today, limit) {
    const list = data.tasks
      .filter(t => !t.done && t.due)
      .slice()
      .sort((a, b) => (a.due < b.due ? -1 : (a.due > b.due ? 1 : 0)));
    return limit ? list.slice(0, limit) : list;
  }

  function monthMarks(data, month) {
    const marks = {};
    for (const task of data.tasks) {
      if (!task.due || task.due.slice(0, 7) !== month) continue;
      if (!marks[task.due]) marks[task.due] = [];
      if (marks[task.due].indexOf(task.sphereId) === -1) marks[task.due].push(task.sphereId);
    }
    return marks;
  }

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function monthGrid(month) {
    const year = Number(month.slice(0, 4));
    const index = Number(month.slice(5, 7)) - 1;
    const первое = new Date(year, index, 1);
    /* getDay(): воскресенье это 0, а неделя у нас начинается с понедельника */
    const сдвиг = (первое.getDay() + 6) % 7;
    const дней = new Date(year, index + 1, 0).getDate();

    const клетки = [];
    for (let i = 0; i < сдвиг; i += 1) клетки.push(null);
    for (let d = 1; d <= дней; d += 1) клетки.push(year + '-' + pad(index + 1) + '-' + pad(d));
    while (клетки.length % 7 !== 0) клетки.push(null);

    const недели = [];
    for (let i = 0; i < клетки.length; i += 7) недели.push(клетки.slice(i, i + 7));
    return недели;
  }

  function monthTitle(month) {
    return MONTHS[Number(month.slice(5, 7)) - 1] + ' ' + month.slice(0, 4);
  }

  function shiftMonth(month, delta) {
    const year = Number(month.slice(0, 4));
    const index = Number(month.slice(5, 7)) - 1 + delta;
    const d = new Date(year, index, 1);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1);
  }

  const Stats = {
    plural, fill, label, tasksOn, overdue, upcoming,
    monthMarks, monthGrid, monthTitle, shiftMonth, MONTHS
  };

  if (isNode) module.exports = Stats;
  else root.Stats = Stats;
})(typeof globalThis !== 'undefined' ? globalThis : this);
