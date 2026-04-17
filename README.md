# 🌸 QA Daily Task Monitor

A cute, lightweight daily task tracker built for QA productivity. No frameworks, no build step — just a single HTML file you can deploy to Vercel in seconds.

---

## ✨ Features

- **Add tasks** with the input box or hit `Enter` to submit
- **Track status** across three stages: 🌿 To Do → ⚡ Doing → 🌸 Done
- **Timestamps** — start and end times are recorded automatically
- **Auto-resets daily** — tasks are stored by date, so you start fresh every morning
- **Keyboard friendly** — `Enter` to add, `Shift+Enter` for a new line in the task
- **No backend needed** — data lives in `localStorage`

---

## 🗂 Project Structure

```
└── 📁daily-planner
    └── 📁src
        └── 📁css
            ├── style.css
        └── 📁js
            ├── main.js
            ├── storage.js
            ├── tasks.js
            ├── ui.js
            ├── utils.js
    ├── index.html
    └── README.md
```

---

## 🧠 How It Works

The app is split into three logical sections inside the `<script>` tag:

| Section     | Responsibility                                                           |
| ----------- | ------------------------------------------------------------------------ |
| **Storage** | Read/write tasks to `localStorage`, keyed by today's date (`YYYY-MM-DD`) |
| **Tasks**   | Pure functions — `addTask`, `startTask`, `markDone`, `deleteTask`        |
| **UI**      | DOM rendering, event listeners, `render()` loop                          |

---

## 🎨 Tech Stack

- [Tailwind CSS CDN](https://tailwindcss.com/docs/installation/play-cdn) — utility styling
- [Nunito](https://fonts.google.com/specimen/Nunito) via Google Fonts — the cute rounded font
- Vanilla JS — no dependencies, no bundler
- `localStorage` — client-side persistence, zero backend

---

## 📝 Notes

- Tasks are stored **per device** in the browser's `localStorage`. They won't sync across devices.
- Clearing browser data will erase your tasks.
- The app is intentionally simple — it's a daily scratch pad, not a full project manager.
