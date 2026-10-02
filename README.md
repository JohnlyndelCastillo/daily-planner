# Daily Planner

A lightweight daily task planner built with vanilla JavaScript. Tasks are saved automatically in the browser, with no account or backend required.

## Features

- Add tasks with the input field or press **Enter**. Use **Shift + Enter** to add a new line.
- Move tasks through **To Do**, **Doing**, and **Done**. Start and completion times are recorded automatically.
- Edit active tasks by double-clicking their text, or remove them with confirmation.
- Carry unfinished tasks forward from previous days.
- Open **Progress & history** to see a Monday–Sunday completion summary and browse past task lists.
- Install the app on supported mobile browsers. The service worker keeps cached files available when offline.
- Use a responsive interface with locally embedded SVG icons.

## Data and privacy

Tasks are stored in `localStorage` in the current browser on the current device. They do not sync between devices or browsers. Clearing browser site data can remove saved tasks, so consider exporting or backing up important information outside the app.

## Run locally

The app uses JavaScript modules, so serve the project over HTTP rather than opening `index.html` with `file://`.

```bash
npx serve .
```

Open the local URL printed by the server, usually `http://localhost:3000`.

## Tests

Install dependencies and run the tests once:

```bash
npm install
npm test -- --run
```

Run Vitest in watch mode with `npm test`.

Tests use Vitest and jsdom. Unit tests cover storage, task operations, date utilities, and weekly summaries. Integration tests cover task interactions, carryover, history, and weekly summary rendering.

## Project structure

```text
daily-planner/
├── icons/
│   ├── app-mark.svg
│   ├── icon-192.png
│   └── icon-512.png
├── src/
│   ├── css/style.css
│   ├── js/
│   │   ├── main.js
│   │   ├── storage.js
│   │   ├── tasks.js
│   │   ├── ui.js
│   │   ├── utils.js
│   │   └── weeklySummary.js
│   └── tests/
│       ├── helpers/plannerDom.js
│       ├── integration/
│       │   ├── carryover.test.js
│       │   ├── history.test.js
│       │   ├── tasks.test.js
│       │   └── weeklySummary.test.js
│       └── unit/
│           ├── storage.test.js
│           ├── tasks.test.js
│           ├── utils.test.js
│           └── weeklySummary.test.js
├── index.html
├── manifest.json
├── package.json
├── package-lock.json
├── placeholder.json
├── service-worker.js
└── vitest.config.mjs
```

## Main modules

| Module | Responsibility |
| --- | --- |
| `storage.js` | Read and write date-keyed task lists in `localStorage`. |
| `tasks.js` | Add, edit, start, complete, remove, and carry over tasks. |
| `ui.js` | Render the planner, task history, weekly summary, and carryover banner. |
| `weeklySummary.js` | Aggregate task completion for the current Monday–Sunday week. |
| `utils.js` | Date/time formatting, textarea sizing, and carryover checks. |
| `main.js` | Initialize the UI and load rotating task prompts. |
