import { getTasks, getAllDates, getTasksByDate } from './storage.js';
import { fmt, autoResize, checkCarryOver } from './utils.js';
import { startTask, markDone, deleteTask, addTask, STATUS, carryOverTask, editTask } from './tasks.js';

export function initUI() {
  const input = document.getElementById('taskInput');
  const addBtn = document.getElementById('addBtn');
  const list = document.getElementById('taskList');
  const countEl = document.getElementById('taskCount');
  const dateEl = document.getElementById('dateLabel');
  const guideToggle = document.getElementById('guideToggle');
  const guideBox = document.getElementById('tooltipBox');
  const historyToggle = document.getElementById('historyToggle');
  const historyPanel = document.getElementById('historyPanel');
  const historyDate = document.getElementById('historyDate');
  const historySummary = document.getElementById('historySummary');
  const historyTaskList = document.getElementById('historyTaskList');

  if (guideToggle && guideBox) {
    guideToggle.addEventListener('click', () => {
      const expanded = guideToggle.getAttribute('aria-expanded') === 'true';
      guideToggle.setAttribute('aria-expanded', String(!expanded));
      guideBox.classList.toggle('hidden', expanded);
    });
  }

  if (historyToggle && historyPanel && historyDate && historySummary && historyTaskList) {
    historyToggle.addEventListener('click', () => {
      const expanded = historyToggle.getAttribute('aria-expanded') === 'true';
      historyToggle.setAttribute('aria-expanded', String(!expanded));
      historyPanel.classList.toggle('hidden', expanded);
      historyToggle.textContent = expanded ? 'View history' : 'Hide history';
    });
    historyDate.addEventListener('change', renderHistory);
    renderHistory();
  }

  dateEl.textContent = new Date().toLocaleDateString([], {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  input.addEventListener('input', () => autoResize(input));

  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAdd();
    } else if (e.key === 'Enter' && e.shiftKey) {
      // Let the browser insert the newline before measuring the new height.
      requestAnimationFrame(() => autoResize(input));
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
    b.type = 'button';
    b.className = `action-button ${cls}`;
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  function renderHistory() {
    const todayKey = new Date().toISOString().split('T')[0];
    const dates = getAllDates()
      .filter(date => date < todayKey && getTasksByDate(date).length > 0)
      .sort((a, b) => b.localeCompare(a));
    const previousSelection = historyDate.value;
    historyDate.innerHTML = '';

    if (dates.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No saved days yet';
      historyDate.appendChild(option);
      historyDate.disabled = true;
      historySummary.textContent = 'Past tasks will appear here as you use the planner.';
      historyTaskList.replaceChildren();
      return;
    }

    historyDate.disabled = false;
    dates.forEach(date => {
      const option = document.createElement('option');
      option.value = date;
      option.textContent = formatDateKey(date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      historyDate.appendChild(option);
    });
    historyDate.value = dates.includes(previousSelection) ? previousSelection : dates[0];

    const tasks = getTasksByDate(historyDate.value);
    const completeCount = tasks.filter(task => task.status === 'done').length;
    historySummary.textContent = `${completeCount} of ${tasks.length} tasks completed`;
    historyTaskList.replaceChildren();

    tasks.forEach(task => {
      const item = document.createElement('li');
      item.className = 'history-task';

      const text = document.createElement('span');
      text.className = `history-task-text${task.status === 'done' ? ' completed' : ''}`;
      text.textContent = task.text;

      const badge = document.createElement('span');
      badge.className = `status-pill status-${STATUS[task.status] ? task.status : 'todo'}`;
      badge.textContent = STATUS[task.status]?.label || STATUS.todo.label;

      item.append(text, badge);
      historyTaskList.appendChild(item);
    });
  }

  function formatDateKey(dateKey, options) {
    const [year, month, day] = dateKey.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString([], options);
  }

  function render() {
    const tasks = getTasks();
    list.innerHTML = '';

    const doneCount = tasks.filter(t => t.status === 'done').length;
    countEl.textContent = tasks.length === 0 ? 'Empty' : `${doneCount} / ${tasks.length} done`;

    if (tasks.length === 0) {
      const li = document.createElement('li');
      li.className = 'empty-state';
      li.innerHTML = '<svg class="empty-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Nothing yet. Add a task above to get started.';
      list.appendChild(li);
      return;
    }

    tasks.forEach((task, i) => {
      const { icon, label } = STATUS[task.status];

      const li = document.createElement('li');
      li.className = 'task-enter';

      // Carried over indicator
      if (task.carriedOver) {
        const tag = document.createElement('div');
        tag.className = 'carry-tag';

        const [year, month, day] = task.carriedFrom.split('-');
        const fromDate = new Date(year, month - 1, day).toLocaleDateString([], {
          month: 'short', day: 'numeric', year: 'numeric'
        });

        tag.textContent = `Carried over from ${fromDate}`;
        li.appendChild(tag);
      }

      const top = document.createElement('div');
      top.className = 'task-top';

      const iconEl = document.createElement('span');
      iconEl.className = 'task-icon';
      iconEl.setAttribute('aria-hidden', 'true');
      iconEl.innerHTML = `<svg viewBox="0 0 24 24">${icon}</svg>`;

      const textEl = document.createElement('span');
      textEl.className = `task-text${task.status === 'done' ? ' completed' : ''}`;
      textEl.textContent = task.text;

      if (task.status === 'todo' || task.status === 'doing') {
        textEl.title = 'Double click to edit';
        textEl.classList.add('editable');

        textEl.addEventListener('dblclick', () => {
          // Replace span with textarea
          const editor = document.createElement('textarea');
          editor.className = 'task-text';
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
      pillEl.className = `status-pill status-${task.status}`;
      pillEl.textContent = label;

      top.append(iconEl, textEl, pillEl);

      // Time chips
      const timeRow = document.createElement('div');
      timeRow.className = 'task-meta';

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
      actions.className = 'task-actions';

      if (task.status === 'todo') {
        actions.appendChild(mkBtn('▶ Start', 'action-primary', () => {
          startTask(i);
          render();
        }));
      }

      if (task.status === 'doing') {
        actions.appendChild(mkBtn('✓ Done', 'action-primary', () => {
          markDone(i);
          render();
        }));
      }

      actions.appendChild(mkBtn('Remove', 'action-danger', () => {
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
  banner.className = 'carry-banner';

  const top = document.createElement('div');
  top.className = 'flex items-center justify-between mb-3';

  const title = document.createElement('p');
  title.className = 'carry-title';
  title.textContent = `${unfinished.length} unfinished task${unfinished.length > 1 ? 's' : ''} from previous days`;

  const dismiss = document.createElement('button');
  dismiss.className = 'action-button';
  dismiss.textContent = 'Dismiss';
  dismiss.addEventListener('click', () => {
    localStorage.setItem(seenKey, 'true'); // mark as seen so banner doesn't show again
    banner.remove();
  });

  top.append(title, dismiss);

  const taskList = document.createElement('ul');
  taskList.className = 'carry-list';

  unfinished.forEach(task => {
    const li = document.createElement('li');
    li.textContent = task.text;
    taskList.appendChild(li);
  });

  const actions = document.createElement('div');
  actions.className = 'carry-actions';

  const carryAllBtn = document.createElement('button');
  carryAllBtn.className = 'carry-button';
  carryAllBtn.textContent = 'Carry All Over';
  carryAllBtn.addEventListener('click', () => {
    unfinished.forEach(task => carryOverTask(task));
    localStorage.setItem(seenKey, 'true'); // mark as seen so banner doesn't show again
    banner.remove();
    window.__renderTasks?.();
  });

  const dismissAllBtn = document.createElement('button');
  dismissAllBtn.className = 'carry-button carry-dismiss';
  dismissAllBtn.textContent = 'Dismiss';
  dismissAllBtn.addEventListener('click', () => {
    localStorage.setItem(seenKey, 'true'); // mark as seen so banner doesn't show again
    banner.remove();
  });

  actions.append(carryAllBtn, dismissAllBtn);
  banner.append(top, taskList, actions);

  // Insert banner above the task list card
  const renderedTaskList = document.querySelector('#taskList');
  const taskCard = renderedTaskList.closest('.task-card') || document.getElementById('taskCard') || renderedTaskList.parentElement;
  taskCard.parentElement.insertBefore(banner, taskCard);
}
