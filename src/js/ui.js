import { getTasks } from './storage.js';
import { fmt, autoResize } from './utils.js';
import { startTask, markDone, deleteTask, addTask, STATUS } from './tasks.js';

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

      const top = document.createElement('div');
      top.className = 'flex items-start gap-2';

      const iconEl = document.createElement('span');
      iconEl.className = 'text-base mt-0.5 shrink-0';
      iconEl.textContent = icon;

      const textEl = document.createElement('span');
      textEl.className = 'flex-1 min-w-0 text-sm font-semibold text-gray-700 whitespace-pre-wrap break-words';
      textEl.textContent = task.text;

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
        deleteTask(i);
        render();
      }));

      li.appendChild(top);
      if (task.startTime || task.endTime) li.appendChild(timeRow);
      li.appendChild(actions);
      list.appendChild(li);
    });
  }

  render();
}