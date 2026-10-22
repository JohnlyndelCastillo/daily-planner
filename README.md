# Daily Planner

A local-first daily planner built with vanilla JavaScript. It has no account or backend, and planner data stays in the browser unless you export a backup.

## Features

- Plan Today with progress, a Top 3 list, task statuses, estimates, tags, and time blocks.
- Review a Monday–Sunday week, focus time, carry-overs, and a saved reflection.
- Arrange scheduled and unscheduled work in Blocks. Overlaps are allowed and capacity is a planning guide.
- Run focus sessions with pause, resume, and break controls. The timer uses timestamps so background tabs do not lose time.
- Export and restore JSON backups, merge data from another device, and request persistent browser storage.
- Keep using existing localStorage tasks. On first launch, the app migrates date-keyed task lists into IndexedDB and leaves the old keys in place.
- Continue with a localStorage-backed storage adapter when IndexedDB is unavailable.
- Install the app on supported mobile browsers. The service worker caches the application for offline use after the first visit.

## Data and privacy

The app does not send planner data to a server. IndexedDB is the primary store; localStorage remains available as a fallback. Clearing browser site data can remove the plan, so export a JSON backup if you need a separate copy. DM Sans is optional; the interface uses a system-font fallback when offline.

## Run locally

The app uses JavaScript modules, so serve the project over HTTP rather than opening `index.html` with `file://`.

```bash
npx serve .
```

Open the local URL printed by the server, usually `http://localhost:3000`.

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
│   │   ├── quickAdd.js
│   │   ├── storage.js
│   │   ├── tasks.js
│   │   ├── ui.js
│   │   ├── utils.js
│   │   └── weeklySummary.js
│   └── tests/
├── index.html
├── manifest.json
├── package.json
└── service-worker.js
```

## Main modules

| Module | Responsibility |
| --- | --- |
| `storage.js` | IndexedDB, localStorage fallback, legacy migration, settings, weekly reviews, and backup import/export. |
| `tasks.js` | Task creation, status changes, carry-over, edits, scheduling, and focus-time updates. |
| `quickAdd.js` | Parses `#tag`, `~estimate`, `!priority`, and `@time` tokens. |
| `ui.js` | Today, Week, Blocks, Data, add-task and focus dialogs, and browser interactions. |
| `weeklySummary.js` | Local-date Monday–Sunday week helpers and task summaries. |
| `main.js` | Initializes storage and the planner UI. |
| `style.css` | Design tokens, responsive layouts, dialogs, and touch-sized controls. |

## Tests

The project includes Vitest unit and integration tests. Install dependencies and run them with:

```bash
npm install
npm test -- --run
```
