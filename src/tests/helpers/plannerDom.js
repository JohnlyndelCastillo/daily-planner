export function setupPlannerDOM() {
  document.body.innerHTML = `
    <div id="dateLabel"></div>
    <textarea id="taskInput"></textarea>
    <button id="addBtn"></button>
    <div id="taskCard" class="rounded-3xl">
      <ul id="taskList"></ul>
    </div>
    <span id="taskCount"></span>
    <button id="historyToggle" aria-expanded="false"></button>
    <div id="historyPanel" class="hidden">
      <select id="historyDate"></select>
      <p id="historySummary"></p>
      <ul id="historyTaskList"></ul>
    </div>
  `;
}

export function addTaskViaUI(text) {
  const input = document.getElementById('taskInput');
  input.value = text;
  document.getElementById('addBtn').click();
}
