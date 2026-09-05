(function (root) {
  'use strict';

  const el = () => root.Dom.el;

  const WORDS = {
    work:   { placeholder: 'Что сделать по работе', empty: 'Пока ничего. Напишите первое дело — башня начнёт расти.' },
    social: { placeholder: 'Идея для Threads или TikTok', empty: 'Пусто. Пишите мысль сразу, как пришла: срок можно поставить потом.' },
    study:  { placeholder: 'Что задали', empty: 'Домашки нет. Добавьте задание и поставьте дату сдачи.' }
  };

  function render(host, ctx) {
    const e = el();
    const words = WORDS[ctx.sphereId] || { placeholder: 'Новая задача', empty: 'Пока пусто.' };

    const title = e('input', { type: 'text', placeholder: words.placeholder });
    const due = e('input', { type: 'date', 'aria-label': 'Срок' });

    function submit() {
      const res = root.Model.addTask(ctx.data, ctx.sphereId, title.value, due.value);
      if (!res.id) { title.focus(); return; }
      ctx.update(res.data, 'new');
    }

    title.addEventListener('keydown', ev => { if (ev.key === 'Enter') submit(); });
    due.addEventListener('keydown', ev => { if (ev.key === 'Enter') submit(); });

    host.appendChild(e('div', { class: 'field' }, [
      title, due,
      e('button', { class: 'go', type: 'button', title: 'Добавить', text: '+', onclick: submit })
    ]));

    if (ctx.focus === 'new') title.focus();

    const list = root.Model.tasksOf(ctx.data, ctx.sphereId);
    if (list.length === 0) {
      host.appendChild(e('p', { class: 'empty', text: words.empty }));
      return;
    }

    const rows = e('ul', { class: 'rows' });
    for (const task of list) rows.appendChild(row(task, ctx));
    host.appendChild(rows);
  }

  function row(task, ctx) {
    const e = el();

    const tick = e('button', {
      class: 'tick', type: 'button',
      'aria-label': task.done ? 'Вернуть в работу' : 'Сделано',
      onclick: () => ctx.update(root.Model.toggleTask(ctx.data, task.id))
    });

    const name = e('input', {
      class: 'row-title', type: 'text', value: task.title,
      onchange: ev => ctx.update(root.Model.editTaskTitle(ctx.data, task.id, ev.target.value))
    });
    name.addEventListener('keydown', ev => { if (ev.key === 'Enter') ev.target.blur(); });

    const main = e('div', { class: 'row-main' }, [name, dueControl(task, ctx)]);

    const kill = e('button', {
      class: 'kill', type: 'button', text: '✕', 'aria-label': 'Удалить',
      onclick: () => ctx.update(root.Model.removeTask(ctx.data, task.id))
    });

    return e('li', { class: 'row' + (task.done ? ' done' : '') }, [tick, main, kill]);
  }

  function dueControl(task, ctx) {
    const e = el();

    function editor(value) {
      const input = e('input', { type: 'date', class: 'row-due', value: value || '' });
      input.addEventListener('change', () => {
        ctx.update(root.Model.editTaskDue(ctx.data, task.id, input.value));
      });
      return input;
    }

    if (task.due) {
      const said = root.UI.humanDue(task.due, root.Model.today());
      const chip = e('button', {
        class: 'row-due' + (said.late ? ' late' : (said.soon ? ' soon' : '')),
        type: 'button', text: said.text,
        onclick: () => {
          const input = editor(task.due);
          chip.replaceWith(input);
          input.focus();
          if (input.showPicker) { try { input.showPicker(); } catch (err) { /* браузер не даёт */ } }
        }
      });
      return chip;
    }

    const add = e('button', {
      class: 'row-due', type: 'button', text: 'поставить срок',
      onclick: () => {
        const input = editor('');
        add.replaceWith(input);
        input.focus();
        if (input.showPicker) { try { input.showPicker(); } catch (err) { /* браузер не даёт */ } }
      }
    });
    return add;
  }

  root.PanelTasks = { render };
})(typeof globalThis !== 'undefined' ? globalThis : this);
