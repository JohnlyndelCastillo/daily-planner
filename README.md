# 🌸 Daily Task Monitor

A cute, lightweight daily task tracker built for QA productivity. No frameworks, no build step — just a single HTML file you can deploy to Vercel in seconds.

---

## ✨ Features

- **Add tasks** with the input box or hit `Enter` to submit
- **Track status** across three stages: 🌿 To Do → ⚡ Doing → 🌸 Done
- **Timestamps** — start and end times are recorded automatically
- **Auto-resets daily** — tasks are stored by date, so you start fresh every morning
- **Carry over** — unfinished tasks from past dates are surfaced in a banner on app load
- **Keyboard friendly** — `Enter` to add, `Shift+Enter` for a new line in the task
- **No backend needed** — data lives in `localStorage`

---

## 🗂 Project Structure

```
daily-planner/
├── src/
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── main.js
│   │   ├── storage.js
│   │   ├── tasks.js
│   │   ├── ui.js
│   │   └── utils.js
│   └── tests/
│       ├── storage.test.js
│       ├── tasks.test.js
│       └── utils.test.js
├── index.html
├── package.json
├── vitest.config.js
└── README.md
```

---

## 🧠 How It Works

The app is split into modules under `src/js/`:

| Module       | Responsibility                                                                     |
| ------------ | ---------------------------------------------------------------------------------- |
| `storage.js` | Read/write tasks to `localStorage`, keyed by today's date (`YYYY-MM-DD`)           |
| `tasks.js`   | Pure functions — `addTask`, `startTask`, `markDone`, `deleteTask`, `carryOverTask` |
| `ui.js`      | DOM rendering, event listeners, `render()` loop, carry over banner                 |
| `utils.js`   | Helpers — `fmt`, `autoResize`, `checkCarryOver`                                    |
| `main.js`    | Entry point — initializes the UI on `DOMContentLoaded`                             |

### Task data shape

```js
{
  text: "Write test cases for login flow",
  status: "todo" | "doing" | "done",
  startTime: "2026-04-17T09:30:00.000Z" | null,
  endTime:   "2026-04-17T10:15:00.000Z" | null,
  carriedOver: true | false,
  carriedFrom: "2026-04-17" | null
}
```

### Carry over

On app load, `checkCarryOver` scans all past dates in `localStorage` and surfaces any unfinished (`todo` or `doing`) tasks in a banner. The banner appears once per day — dismissing or carrying over sets a `carryover-seen-{date}` flag so it doesn't reappear on refresh.

---

## 🛠 Running Locally

Since the app uses ES modules (`type="module"`), you need a local server — opening `index.html` directly via `file://` won't work.

```bash
cd daily-planner
npx serve .
```

Then open `http://localhost:3000`.

---

## 🧪 Testing

Tests are written with [Vitest](https://vitest.dev/) and run in a `jsdom` environment to simulate `localStorage`.

**Install dependencies**

```bash
npm install
```

**Run tests**

```bash
npm test
```

**Coverage**

```bash
npm test -- --coverage
```

### Test files

| File              | What it tests                                                     |
| ----------------- | ----------------------------------------------------------------- |
| `storage.test.js` | `getTasks`, `saveTasks`, `getTasksByDate`, `getAllDates`          |
| `tasks.test.js`   | `addTask`, `startTask`, `markDone`, `deleteTask`, `carryOverTask` |
| `utils.test.js`   | `fmt`, `autoResize`                                               |

> `ui.js` is intentionally excluded from unit tests — DOM interaction is better covered by integration tests.

---

## 🎨 Tech Stack

- [Tailwind CSS CDN](https://tailwindcss.com/docs/installation/play-cdn) — utility styling
- [Nunito](https://fonts.google.com/specimen/Nunito) via Google Fonts — the cute rounded font
- Vanilla JS with ES modules — no bundler needed
- `localStorage` — client-side persistence, zero backend
- [Vitest](https://vitest.dev/) + [jsdom](https://github.com/jsdom/jsdom) — unit testing

---

## 📝 Notes

- Tasks are stored **per device** in the browser's `localStorage` and won't sync across devices.
- Clearing browser data will erase your tasks.
- The app is intentionally simple — it's a daily scratch pad, not a full project manager.
