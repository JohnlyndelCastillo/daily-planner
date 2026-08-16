import { initUI } from './ui.js';
import { rotatePlaceholder } from './utils.js';

document.addEventListener('DOMContentLoaded', async () => {
  initUI();

  try {
    const res = await fetch('/public/placeholder.json');
    const phrases = await res.json();
    const input = document.getElementById('taskInput');
    rotatePlaceholder(input, phrases);
  } catch (err) {
    console.warn('Could not load placeholders:', err);
  }
});