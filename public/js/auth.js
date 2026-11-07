// Запросы fetch к серверу: регистрация, логин, логаут, проверка сессии.

// Общая обёртка: отправляет JSON, возвращает { ok, status, data }.
async function api(url, options = {}) {
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: options.body ? JSON.stringify(options.body) : undefined,
    credentials: 'same-origin', // браузер отправит cookie accessToken / refreshToken
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function showMessage(el, text, type = 'error') {
  el.textContent = text;
  el.dataset.type = type;
  el.hidden = !text;
}

// ── Формы входа и регистрации ──
const form = document.querySelector('form[data-auth]');
if (form) {
  const message = form.querySelector('.form__message');
  const submit = form.querySelector('button[type="submit"]');
  const mode = form.dataset.auth; // "login" или "register"

  // После регистрации переходим на /login?registered=1 — показываем подсказку.
  if (mode === 'login' && new URLSearchParams(location.search).has('registered')) {
    showMessage(message, 'Аккаунт создан. Теперь войдите.', 'success');
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    showMessage(message, '');

    const name = mode === 'register' ? form.name.value.trim() : undefined;
    const email = form.email.value.trim();
    const password = form.password.value;

    if (mode === 'register' && password !== form.confirm.value) {
      showMessage(message, 'Пароли не совпадают');
      form.confirm.focus();
      return;
    }

    submit.disabled = true;
    submit.dataset.loading = 'true';
    try {
      const { ok, data } = await api(`/api/auth/${mode}`, {
        method: 'POST',
        body: { name, email, password },
      });
      if (!ok) {
        showMessage(message, data.error || 'Что-то пошло не так');
        return;
      }
      location.href = mode === 'register' ? '/login?registered=1' : '/';
    } catch {
      showMessage(message, 'Нет связи с сервером');
    } finally {
      submit.disabled = false;
      delete submit.dataset.loading;
    }
  });
}

// ── Главная страница: показываем, кто вошёл ──
const userEmail = document.getElementById('user-email');
if (userEmail) {
  api('/api/auth/me').then(({ ok, data }) => {
    if (!ok) {
      location.href = '/login'; // токены недействительны
      return;
    }
    userEmail.textContent = `${data.user.name} (${data.user.email})`;
  });
}

// ── Кнопка выхода ──
document.getElementById('logout')?.addEventListener('click', async () => {
  await api('/api/auth/logout', { method: 'POST' });
  location.href = '/login';
});
