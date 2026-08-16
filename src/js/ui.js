import { getTasks } from './storage.js';
import { fmt, autoResize, checkCarryOver } from './utils.js';
import { startTask, markDone, deleteTask, addTask, STATUS, carryOverTask, editTask } from './tasks.js';

export function initUI() {
  const input = document.getElementById('taskInput');
  const addBtn = document.getElementById('addBtn');
  const list = document.getElementById('taskList');
  const countEl = document.getElementById('taskCount');
  const dateEl = document.getElementById('dateLabel');

  dateEl.textContent = new Date().toLocaleDateString([], {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  input.addEventListener('input', () => autoResize(input));

  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAdd();
    }
  });

  addBtn.addEventListener('click', handleAdd);

  function handleAdd() {
    const text = input.value.trim();
    if (!text) return;

    addTask(text);

    input.value = '';
    autoResize(input);
    render();
  }

  function mkBtn(label, cls, onClick) {
    const b = document.createElement('button');
    b.className = `btn-pill text-xs font-extrabold px-3 py-1.5 rounded-full ${cls}`;
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  function render() {
    const tasks = getTasks();
    list.innerHTML = '';

    const doneCount = tasks.filter(t => t.status === 'done').length;
    countEl.textContent =
      tasks.length === 0 ? 'Empty' : `${doneCount} / ${tasks.length} done`;

    if (tasks.length === 0) {
      const li = document.createElement('li');
      li.className = 'py-12 text-center text-violet-300 font-bold text-sm';
      li.innerHTML = `
        <div class="text-4xl mb-3">🌱</div>
        Nothing yet — add your first task!
      `;
      list.appendChild(li);
      return;
    }

    tasks.forEach((task, i) => {
      const { icon, label, pill } = STATUS[task.status];

      const li = document.createElement('li');
      li.className = 'task-enter px-5 py-4';

      // Carried over indicator
      if (task.carriedOver) {
        const tag = document.createElement('div');
        tag.className = 'text-xs font-bold text-amber-400 mb-1 pl-7';

        const [year, month, day] = task.carriedFrom.split('-');
        const fromDate = new Date(year, month - 1, day).toLocaleDateString([], {
          month: 'short', day: 'numeric', year: 'numeric'
        });

        tag.textContent = `Carried over from ${fromDate}`;
        li.appendChild(tag);
      }

      const top = document.createElement('div');
      top.className = 'flex items-start gap-2';

      const iconEl = document.createElement('span');
      iconEl.className = 'text-base mt-0.5 shrink-0';
      iconEl.textContent = icon;

      const textEl = document.createElement('span');
      textEl.className = 'flex-1 min-w-0 text-sm font-semibold text-gray-700 whitespace-pre-wrap break-words';
      textEl.textContent = task.text;

      if (task.status === 'todo' || task.status === 'doing') {
        textEl.title = 'Double click to edit';
        textEl.classList.add('cursor-pointer');

        textEl.addEventListener('dblclick', () => {
          // Replace span with textarea
          const editor = document.createElement('textarea');
          editor.className = 'flex-1 min-w-0 text-sm font-semibold text-gray-700 bg-pink-50 rounded-xl px-2 py-1 border border-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-300 resize-none';
          editor.value = task.text;
          autoResize(editor);
          textEl.replaceWith(editor);
          editor.focus();

          // Wait for browser to paint before resizing
          requestAnimationFrame(() => {
            autoResize(editor);
            editor.setSelectionRange(editor.value.length, editor.value.length);
          });

          // Move cursor to end
          editor.setSelectionRange(editor.value.length, editor.value.length);

          editor.addEventListener('input', () => autoResize(editor));

          // Save on Enter
          editor.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              editTask(i, editor.value);
              render();
            }
            // Cancel on Escape
            if (e.key === 'Escape') {
              render();
            }
          });

          // Save on blur
          editor.addEventListener('blur', () => {
            editTask(i, editor.value);
            render();
          });
        });
      }

      const pillEl = document.createElement('span');
      pillEl.className = `text-xs font-extrabold px-2.5 py-0.5 rounded-full ${pill} shrink-0`;
      pillEl.textContent = label;

      top.append(iconEl, textEl, pillEl);

      // Time chips
      const timeRow = document.createElement('div');
      timeRow.className = 'flex gap-4 mt-1 pl-7 text-xs text-gray-400 font-semibold';

      if (task.startTime) {
        const c = document.createElement('span');
        c.textContent = `Started: ${fmt(task.startTime)}`;
        timeRow.appendChild(c);
      }
      if (task.endTime) {
        const c = document.createElement('span');
        c.textContent = `Completed: ${fmt(task.endTime)}`;
        timeRow.appendChild(c);
      }

      // Action buttons

      const actions = document.createElement('div');
      actions.className = 'flex gap-2 mt-3 pl-7';

      if (task.status === 'todo') {
        actions.appendChild(mkBtn('▶ Start', 'bg-sky-100 text-sky-600 hover:bg-sky-200', () => {
          startTask(i);
          render();
        }));
      }

      if (task.status === 'doing') {
        actions.appendChild(mkBtn('✓ Done', 'bg-pink-100 text-pink-600 hover:bg-pink-200', () => {
          markDone(i);
          render();
        }));
      }

      actions.appendChild(mkBtn('✕ Remove', 'bg-gray-100 text-gray-400 hover:bg-red-100 hover:text-red-400', () => {
        if (confirm('Remove this task?')) {
          deleteTask(i);
          render();
        }
      }));

      li.appendChild(top);
      if (task.startTime || task.endTime) li.appendChild(timeRow);
      li.appendChild(actions);
      list.appendChild(li);
    });
  }

  window.__renderTasks = render; // for debugging

  checkCarryOver();
  render();
}

export function showCarryOverBanner(unfinished) {
  // Don't show banner if it's already there
  if (document.getElementById('carryOverBanner')) return;

  const todayKey = new Date().toISOString().split('T')[0];
  const seenKey = `carryover-seen-${todayKey}`;

  const banner = document.createElement('div');
  banner.id = 'carryOverBanner';
  banner.className = 'bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 mb-4';

  const top = document.createElement('div');
  top.className = 'flex items-center justify-between mb-3';

  const title = document.createElement('p');
  title.className = 'text-sm font-extrabold text-amber-600';
  title.textContent = `↩ ${unfinished.length} Unfinished Task${unfinished.length > 1 ? 's' : ''} from Yesterday`;

  const dismiss = document.createElement('button');
  dismiss.className = 'text-xs font-bold text-amber-400 hover:text-amber-600';
  dismiss.textContent = '✕ Dismiss';
  dismiss.addEventListener('click', () => {
    localStorage.setItem(seenKey, 'true'); // mark as seen so banner doesn't show again
    banner.remove();
  });

  top.append(title, dismiss);

  const taskList = document.createElement('ul');
  taskList.className = 'space-y-1 mb-3';

  unfinished.forEach(task => {
    const li = document.createElement('li');
    li.className = 'text-xs font-semibold text-amber-700 truncate';
    li.textContent = `• ${task.text}`;
    taskList.appendChild(li);
  });

  const actions = document.createElement('div');
  actions.className = 'flex gap-2';

  const carryAllBtn = document.createElement('button');
  carryAllBtn.className = 'btn-pill text-xs font-extrabold px-3 py-1.5 rounded-full bg-amber-400 text-white hover:bg-amber-500';
  carryAllBtn.textContent = '↩ Carry All Over';
  carryAllBtn.addEventListener('click', () => {
    unfinished.forEach(task => carryOverTask(task));
    localStorage.setItem(seenKey, 'true'); // mark as seen so banner doesn't show again
    banner.remove();
    window.__renderTasks?.();
  });

  const dismissAllBtn = document.createElement('button');
  dismissAllBtn.className = 'btn-pill text-xs font-extrabold px-3 py-1.5 rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200';
  dismissAllBtn.textContent = 'Dismiss';
  dismissAllBtn.addEventListener('click', () => {
    localStorage.setItem(seenKey, 'true'); // mark as seen so banner doesn't show again
    banner.remove();
  });

  actions.append(carryAllBtn, dismissAllBtn);
  banner.append(top, taskList, actions);

  // Insert banner above the task list card
  const taskCard = document.querySelector('#taskList').closest('.rounded-3xl');
  taskCard.parentElement.insertBefore(banner, taskCard);
}