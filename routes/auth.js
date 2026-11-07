// Роуты авторизации: регистрация, логин, refresh, логаут, текущий пользователь.
const express = require('express');
const User = require('../models/User');
const {
  requireAuthApi,
  startSession,
  refreshSession,
  revokeSession,
  clearAuthCookies,
} = require('../middleware/auth');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 72; // bcrypt учитывает только первые 72 байта

function validate(name, email, password) {
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 60) {
    return 'Введите имя (от 2 до 60 символов)';
  }
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return 'Введите корректный email';
  }
  if (typeof password !== 'string' || password.length < MIN_PASSWORD) {
    return `Пароль должен быть не короче ${MIN_PASSWORD} символов`;
  }
  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD) return 'Пароль слишком длинный';
  return null;
}

// POST /api/auth/register  { name, email, password }
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body ?? {};
    const error = validate(name, email, password);
    if (error) return res.status(400).json({ error });

    const normalizedEmail = email.trim().toLowerCase();
    if (await User.exists({ email: normalizedEmail })) {
      return res.status(409).json({ error: 'Пользователь с таким email уже существует' });
    }

    const user = new User({ name: name.trim(), email: normalizedEmail });
    await user.setPassword(password);
    await user.save();

    return res.status(201).json({ ok: true });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Пользователь с таким email уже существует' });
    }
    return next(err);
  }
});

// POST /api/auth/login  { email, password }
// → access (3 мин) + refresh (7 дней) в httpOnly cookie и в JSON
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Введите email и пароль' });
    }
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user || !(await user.checkPassword(password))) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }
    const tokens = await startSession(res, user);
    return res.json({ ok: true, user: { name: user.name, email: user.email }, ...tokens });
  } catch (err) {
    return next(err);
  }
});

// POST /api/auth/refresh — новая пара токенов по refresh-токену (cookie или body)
router.post('/refresh', async (req, res, next) => {
  try {
    const user = await refreshSession(req, res);
    if (!user) {
      clearAuthCookies(res);
      return res.status(401).json({ error: 'Refresh-токен недействителен' });
    }
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

// POST /api/auth/logout — отзывает refresh-токен и стирает cookie (тема не трогается)
router.post('/logout', async (req, res, next) => {
  try {
    await revokeSession(req);
    clearAuthCookies(res);
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

// GET /api/auth/me
router.get('/me', requireAuthApi, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
