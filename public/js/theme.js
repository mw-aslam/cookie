// Переключатель темы Light / Dark. Состояние хранится в cookie "theme".
(function () {
  const COOKIE_NAME = 'theme';
  const ONE_YEAR = 60 * 60 * 24 * 365;

  function readThemeCookie() {
    const match = document.cookie.match(/(?:^|;\s*)theme=(light|dark)/);
    return match ? match[1] : null;
  }

  function saveThemeCookie(theme) {
    // max-age — cookie переживёт закрытие вкладки и браузера.
    // path=/ — cookie видна на всех страницах сайта.
    // Cookie НЕ httpOnly специально: её пишет JS. Секретов в ней нет.
    document.cookie = `${COOKIE_NAME}=${theme}; max-age=${ONE_YEAR}; path=/; SameSite=Lax`;
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    const isDark = theme === 'dark';
    btn.setAttribute('aria-pressed', String(isDark));
    btn.querySelector('.theme-toggle__label').textContent = isDark ? 'Dark' : 'Light';
  }

  // Сервер уже поставил data-theme из cookie; здесь синхронизируем кнопку.
  const initial = readThemeCookie() || document.documentElement.dataset.theme || 'light';
  applyTheme(initial);

  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    saveThemeCookie(next);
    applyTheme(next);
  });
})();
