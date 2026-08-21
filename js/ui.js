(function () {
  'use strict';

  var HORIZON_TITLES = { 3: '3 месяца', 6: '6 месяцев', 12: '12 месяцев' };
  var MONTHS = ['января','февраля','марта','апреля','мая','июня',
                'июля','августа','сентября','октября','ноября','декабря'];
  /* цвет и иконка на сферу; для добавленных владельцем — по кругу */
  var PALETTE = ['sky','lemon','mint','rose','lilac','peach'];
  var AREA_LOOK = {
    money:  { c: 'lemon', icon: 'i-coin' },
    health: { c: 'mint',  icon: 'i-heart' },
    skills: { c: 'sky',   icon: 'i-skill' },
    people: { c: 'rose',  icon: 'i-people' },
    home:   { c: 'lilac', icon: 'i-home' }
  };

  var state = { data: null, storage: null, open: {} };
  var saveTimer = null;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function look(area, index) {
    var known = AREA_LOOK[area.id];
    if (known) return known;
    return { c: PALETTE[index % PALETTE.length], icon: 'i-skill' };
  }

  function tint(node, name) {
    node.style.setProperty('--n', 'var(--n-' + name + ')');
    node.style.setProperty('--k', 'var(--k-' + name + ')');
  }

  function tilt(seed) {
    /* устойчивый наклон: один и тот же элемент всегда лежит одинаково */
    var h = 0;
    for (var i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
    return (((h % 40) + 40) % 40) / 10 - 2;
  }

  function icon(id) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#' + id);
    svg.appendChild(use);
    return svg;
  }

  function formatDate(iso) {
    if (!iso) return 'неизвестно когда';
    var p = iso.split('-');
    return Number(p[2]) + ' ' + MONTHS[Number(p[1]) - 1];
  }

  function notice(message) {
    var wrap = document.getElementById('noticeWrap');
    if (!message) { wrap.hidden = true; return; }
    document.getElementById('notice').textContent = message;
    wrap.hidden = false;
  }

  /* ---------- правка по месту ---------- */
  function editInPlace(node, current, onDone) {
    var input = el('input', 'inline');
    input.type = 'text';
    input.value = current || '';
    node.replaceWith(input);
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    var settled = false;
    function finish(save) {
      if (settled) return;
      settled = true;
      var value = input.value;
      input.replaceWith(node);
      if (save) onDone(value); else render();
    }
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    });
    input.addEventListener('blur', function () { finish(true); });
  }

  function addInPlace(host, placeholder, onDone) {
    var input = el('input', 'inline');
    input.type = 'text';
    input.placeholder = placeholder;
    host.appendChild(input);
    input.focus();
    var settled = false;
    function finish(save) {
      if (settled) return;
      settled = true;
      var value = input.value.trim();
      input.remove();
      if (save && value) onDone(value); else render();
    }
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    });
    input.addEventListener('blur', function () { finish(true); });
  }

  /* ---------- мечты ---------- */
  function renderDreams() {
    var host = document.getElementById('dreams');
    host.textContent = '';
    state.data.dreams.forEach(function (dream) {
      var card = el('article', 'pola');
      card.style.setProperty('--r', tilt(dream.id) + 'deg');

      var art = el('div', 'pola__art');
      if (dream.image) {
        var img = document.createElement('img');
        img.src = 'images/' + dream.image;
        img.alt = dream.title;
        img.loading = 'lazy';
        img.addEventListener('error', function () {
          img.remove();
          art.appendChild(el('div', 'pola__miss', 'Файл ' + dream.image + ' не найден в папке images'));
        });
        art.appendChild(img);
      }
      card.appendChild(art);

      var cap = el('div', 'pola__cap');
      var h = el('h2', 'serif', dream.title);
      h.addEventListener('click', function () {
        editInPlace(h, dream.title, function (v) {
          commit(Model.editDream(state.data, dream.id, { title: v }));
        });
      });
      cap.appendChild(h);

      var note = el('span', null, dream.note || 'добавить заметку');
      note.addEventListener('click', function () {
        editInPlace(note, dream.note, function (v) {
          commit(Model.editDream(state.data, dream.id, { note: v }));
        });
      });
      cap.appendChild(note);
      card.appendChild(cap);

      var x = el('button', 'x', '×');
      x.type = 'button';
      x.title = 'Убрать мечту';
      x.addEventListener('click', function (e) {
        e.stopPropagation();
        if (window.confirm('Убрать «' + dream.title + '» с карты?')) {
          commit(Model.removeDream(state.data, dream.id));
        }
      });
      card.appendChild(x);
      host.appendChild(card);
    });
  }

  /* ---------- дерево целей ---------- */
  function renderNode(node, depth, colour) {
    var wrap = el('div', 'branch');
    var isGoal = depth === 0;
    var box = isGoal ? el('div', 'note') : el('div', 'kid');
    if (isGoal) {
      box.style.setProperty('--r', tilt(node.id) + 'deg');
      if (Model.isDone(node)) box.classList.add('note--done');
      if (node.colour) tint(box, node.colour);
    } else if (Model.isDone(node)) {
      box.classList.add('kid--done');
    }

    var top = isGoal ? el('div', 'top') : box;
    var prog = Model.progress(node);
    if (prog) {
      top.appendChild(el('span', 'cnt', prog.done + '/' + prog.total));
    } else {
      var check = el('span', 'box' + (Model.isDone(node) ? ' box--on' : ''));
      check.setAttribute('role', 'button');
      check.setAttribute('tabindex', '0');
      check.addEventListener('click', function (e) {
        e.stopPropagation();
        commit(Model.toggle(state.data, node.id));
      });
      top.appendChild(check);
    }

    var title = isGoal ? el('h3', null, node.title) : el('span', 't', node.title);
    title.addEventListener('click', function (e) {
      e.stopPropagation();
      editInPlace(title, node.title, function (v) {
        commit(Model.editTitle(state.data, node.id, v));
      });
    });
    top.appendChild(title);

    var x = el('button', 'x', '×');
    x.type = 'button';
    x.addEventListener('click', function (e) {
      e.stopPropagation();
      var kids = (node.tasks || []).length;
      if (kids && !window.confirm('Удалить вместе с задачами внутри?')) return;
      commit(Model.removeNode(state.data, node.id));
    });
    if (isGoal) box.appendChild(top);
    box.appendChild(x);

    if (isGoal) {
      var start = el('div', 'start');
      start.textContent = node.start
        ? 'Старт ' + formatDate(node.startedAt) + ' · ' + node.start
        : 'Старт ' + formatDate(node.startedAt);
      start.addEventListener('click', function (e) {
        e.stopPropagation();
        editInPlace(start, node.start, function (v) {
          commit(Model.editStart(state.data, node.id, v));
        });
      });
      box.appendChild(start);

      var kidsBox = el('div', 'kids');
      if (!state.open[node.id]) kidsBox.style.display = 'none';
      (node.tasks || []).forEach(function (kid) {
        kidsBox.appendChild(renderNode(kid, depth + 1, colour));
      });
      var addKid = el('button', 'add add--kid', '+ задача');
      addKid.type = 'button';
      addKid.addEventListener('click', function (e) {
        e.stopPropagation();
        addInPlace(kidsBox, 'Что нужно сделать?', function (v) {
          state.open[node.id] = true;
          commit(Model.addTask(state.data, node.id, v).data);
        });
      });
      kidsBox.appendChild(addKid);
      box.appendChild(kidsBox);

      box.addEventListener('click', function () {
        state.open[node.id] = !state.open[node.id];
        render();
      });
    } else if ((node.tasks || []).length) {
      var subs = el('div', 'kids');
      node.tasks.forEach(function (sub) { subs.appendChild(renderNode(sub, depth + 1, colour)); });
      wrap.appendChild(box);
      wrap.appendChild(subs);
      return wrap;
    }

    wrap.appendChild(box);
    return wrap;
  }

  function renderHorizons() {
    var host = document.getElementById('horizons');
    host.textContent = '';

    Model.HORIZONS.forEach(function (horizon) {
      var section = el('section', 'horizon');
      section.id = 'h' + horizon;
      var inner = el('div', 'wrap');

      var total = 0, done = 0;
      state.data.goals.forEach(function (g) {
        if (g.horizon !== horizon) return;
        total += 1;
        if (Model.isDone(g)) done += 1;
      });

      var head = el('div', 'hhead');
      head.appendChild(el('h2', 'serif', HORIZON_TITLES[horizon]));
      head.appendChild(el('em', null, total ? done + ' из ' + total + ' закрыто' : 'пока ничего'));
      inner.appendChild(head);

      var grid = el('div', 'areas');
      state.data.areas.forEach(function (area, index) {
        var view = look(area, index);
        var column = el('div');
        tint(column, view.c);

        var ahead = el('div', 'ahead');
        var ico = el('span', 'ico');
        ico.appendChild(icon(view.icon));
        ahead.appendChild(ico);
        var name = el('b', null, area.name);
        name.addEventListener('click', function () {
          editInPlace(name, area.name, function (v) {
            commit(Model.renameArea(state.data, area.id, v));
          });
        });
        ahead.appendChild(name);
        column.appendChild(ahead);

        var stack = el('div', 'stack');
        var goals = Model.goalsFor(state.data, horizon, area.id);
        goals.forEach(function (goal) {
          goal.colour = goal.colour || view.c;
          stack.appendChild(renderNode(goal, 0, view.c));
        });
        if (!goals.length) stack.appendChild(el('div', 'empty', 'пока пусто'));

        var add = el('button', 'add', '+ цель');
        add.type = 'button';
        add.addEventListener('click', function () {
          addInPlace(stack, 'Какая цель?', function (title) {
            var made = Model.addGoal(state.data, {
              areaId: area.id, horizon: horizon, title: title
            });
            commit(made.data);
          });
        });
        stack.appendChild(add);
        column.appendChild(stack);
        grid.appendChild(column);
      });

      inner.appendChild(grid);
      section.appendChild(inner);
      host.appendChild(section);
    });
  }

  function render() {
    renderDreams();
    renderHorizons();
  }

  function commit(next) {
    state.data = next;
    render();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      if (!Store.save(state.storage, state.data)) {
        notice('Браузер не даёт сохранять на этой странице. Правки не переживут перезагрузку — нажмите «Сохранить копию».');
      }
    }, 300);
  }

  /* ---------- копия на диск ---------- */
  function download(name, text) {
    var blob = new Blob([text], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function init() {
    state.storage = window.localStorage;
    var loaded = Store.load(state.storage);
    state.data = loaded.data;
    if (loaded.warning) notice(loaded.warning);
    render();

    document.getElementById('addDream').addEventListener('click', function () {
      var host = document.getElementById('dreams');
      addInPlace(host, 'О чём мечтаешь?', function (v) {
        commit(Model.addDream(state.data, v).data);
      });
    });

    document.getElementById('exportBtn').addEventListener('click', function () {
      download(Store.exportName(), Model.serialize(state.data));
    });
    var input = document.getElementById('importInput');
    document.getElementById('importBtn').addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        var res = Model.parse(String(reader.result));
        if (!res.ok) { notice('Файл не подошёл: ' + res.error); return; }
        commit(res.data);
        notice('Загружено из файла');
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    var tt = document.getElementById('tt');
    tt.addEventListener('click', function () {
      var dark = document.documentElement.dataset.t === 'dark';
      document.documentElement.dataset.t = dark ? '' : 'dark';
      tt.querySelector('use').setAttribute('href', dark ? '#i-moon' : '#i-sun');
      try { state.storage.setItem('wishmap-theme', dark ? 'light' : 'dark'); } catch (err) {}
    });
    try {
      if (state.storage.getItem('wishmap-theme') === 'light') {
        document.documentElement.dataset.t = '';
        tt.querySelector('use').setAttribute('href', '#i-moon');
      }
    } catch (err) {}
  }

  document.addEventListener('DOMContentLoaded', init);
})();
