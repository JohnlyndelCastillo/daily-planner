import { initStorage } from './storage.js';
import { initUI } from './ui.js';

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await initStorage();
    await initUI();
  } catch (error) {
    console.error('Could not start Daily Planner:', error);
    const message = document.getElementById('statusMessage');
    if (message) {
      message.textContent = error?.message || 'The planner could not start.';
      message.classList.add('visible');
    }
  }
});
