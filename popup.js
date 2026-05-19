const STORAGE_KEY = 'standardDailyHours';
const DEFAULT_HOURS = 8;

const input = document.getElementById('daily-hours');
const saved = document.getElementById('saved');

chrome.storage.sync.get({ [STORAGE_KEY]: DEFAULT_HOURS }, (data) => {
  input.value = data[STORAGE_KEY];
});

let hideTimer;
input.addEventListener('input', () => {
  const v = parseFloat(input.value);
  if (isNaN(v) || v < 0.5 || v > 24) return;
  chrome.storage.sync.set({ [STORAGE_KEY]: v }, () => {
    saved.classList.add('show');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => saved.classList.remove('show'), 1200);
  });
});
