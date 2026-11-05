// Роуты авторизации: регистрация, логин, логаут, проверка сессии.
const express = require('express');
const User = require('../models/User');
const { requireAuthApi } = require('../middleware/auth');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;
// bcrypt учитывает только первые 72 байта пароля — длиннее не принимаем.
const MAX_PASSWORD = 72;

function validate(email, password) {
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return 'Введите корректный email';
  }
  if (typeof password !== 'string' || password.length < MIN_PASSWORD) {
    return `Пароль должен быть не короче ${MIN_PASSWORD} символов`;
  }
  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD) {
    return 'Пароль слишком длинный';
  }
  return null;
}

// Записывает пользователя в сессию. regenerate() выдаёт новый ID сессии,
// чтобы старый (полученный до входа) нельзя было использовать — защита от session fixation.
function logIn(req, user) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.userId = user._id.toString();
      req.session.email = user.email;
      // save() дожидается записи сессии в MongoDB до ответа клиенту.
      req.session.save((saveErr) => (saveErr ? reject(saveErr) : resolve()));
    });
  });
}

// POST /api/auth/register  { email, password }
router.post('/register', async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};
    const error = validate(email, password);
    if (error) return res.status(400).json({ error });

    const normalizedEmail = email.trim().toLowerCase();
    if (await User.exists({ email: normalizedEmail })) {
      return res.status(409).json({ error: 'Пользователь с таким email уже существует' });
    }

    const user = new User({ email: normalizedEmail });
    await user.setPassword(password); // ← bcrypt-хэш до сохранения в MongoDB
    await user.save();

    return res.status(201).json({ ok: true });
  } catch (err) {
    // Гонка: два одновременных запроса с одним email — сработал уникальный индекс.
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Пользователь с таким email уже существует' });
    }
    return next(err);
  }
});

// POST /api/auth/login  { email, password }
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Введите email и пароль' });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    // Одинаковое сообщение в обоих случаях, чтобы нельзя было узнать, какие email зарегистрированы.
    if (!user || !(await user.checkPassword(password))) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    await logIn(req, user); // ← здесь создаётся сессия и сохраняется в MongoDB
    return res.json({ ok: true, user: { email: user.email } });
  } catch (err) {
    return next(err);
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res, next) => {
  // Удаляем сессию из MongoDB и стираем cookie сессии.
  // Cookie темы НЕ трогаем — тема сохранится после выхода.
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('sid');
    return res.json({ ok: true });
  });
});

// GET /api/auth/me — проверка сессии. Фронтенд вызывает при загрузке страницы.
router.get('/me', requireAuthApi, (req, res) => {
  res.json({ user: { id: req.session.userId, email: req.session.email } });
});

module.exports = router;
