export function setupPlannerDOM() {
  document.body.innerHTML = `
    <div id="dateLabel"></div>
    <textarea id="taskInput"></textarea>
    <button id="addBtn"></button>
    <div id="taskCard" class="rounded-3xl">
      <ul id="taskList"></ul>
    </div>
    <span id="taskCount"></span>
    <button id="insightsToggle" aria-expanded="false"><span>Progress &amp; history</span></button>
    <div id="insightsPanel" class="hidden">
      <div>
        <button id="historyToggle" aria-expanded="false">View history</button>
        <div id="historyPanel" class="hidden">
        <select id="historyDate"></select>
        <p id="historySummary"></p>
        <ul id="historyTaskList"></ul>
        </div>
      </div>
      <p id="weekRange"></p>
      <p id="weekProgressLabel"></p>
      <p id="weekPercent"></p>
      <div class="weekly-progress-track" role="progressbar" aria-valuenow="0">
        <div id="weekProgressBar"></div>
      </div>
      <div class="week-days-scroll"><ul id="weekDays"></ul></div>
    </div>
  `;
}

export function addTaskViaUI(text) {
  const input = document.getElementById('taskInput');
  input.value = text;
  document.getElementById('addBtn').click();
}
