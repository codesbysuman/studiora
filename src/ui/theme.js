import { THEME_KEY } from '../config.js';
import { show } from './dom.js';

export function initTheme(dom) {
  const saved = localStorage.getItem(THEME_KEY);
  const preferred = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  applyTheme(dom, saved || preferred);
  dom['btn-theme-toggle'].addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(dom, current === 'dark' ? 'light' : 'dark');
  });
}

export function applyTheme(dom, theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
  dom['theme-icon'].textContent = theme === 'dark' ? 'light_mode' : 'dark_mode';
}
