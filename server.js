// Точка входа сервера.
require('dotenv').config();

const path = require('path');
const fs = require('fs');
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/auth');
const { requireAuthPage, redirectIfLoggedIn } = require('./middleware/auth');

// ─────────────────────────────────────────────────────────────
// СТРОКА ПОДКЛЮЧЕНИЯ MONGODB ATLAS
// Не вписывайте её прямо в код. Откройте файл .env и вставьте в MONGODB_URI
// строку из Atlas (Database → Connect → Drivers). Пример — в .env.example.
// ─────────────────────────────────────────────────────────────
const { MONGODB_URI, SESSION_SECRET, PORT = 3000, NODE_ENV } = process.env;

if (!MONGODB_URI || !SESSION_SECRET) {
  console.error('Не заданы MONGODB_URI или SESSION_SECRET. Скопируйте .env.example в .env и заполните.');
  process.exit(1);
}

const isProd = NODE_ENV === 'production';
const app = express();

if (isProd) app.set('trust proxy', 1); // нужно для secure-cookie за прокси (Render, Railway, Nginx)

// ── Базовые мидлвары ──
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser()); // разбирает cookie в req.cookies (оттуда читаем тему)

// ── Сессии, которые хранятся в MongoDB ──
app.use(
  session({
    name: 'sid', // имя cookie сессии в браузере
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false, // не создавать пустые сессии для гостей
    rolling: true, // продлевать срок при каждом запросе
    store: MongoStore.create({
      mongoUrl: MONGODB_URI,
      collectionName: 'sessions', // коллекция, куда connect-mongo пишет сессии
      ttl: 60 * 60 * 24 * 7, // 7 дней, потом MongoDB сама удалит запись
    }),
    cookie: {
      httpOnly: true, // JS на странице не может прочитать cookie сессии
      sameSite: 'lax',
      secure: isProd, // в продакшене только по HTTPS
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 дней: после обновления страницы и перезапуска браузера вход сохраняется
    },
  })
);

// ── Отдача HTML с темой из cookie ──
// Сервер подставляет тему в <html data-theme="..."> ещё до отправки страницы,
// поэтому тёмная тема появляется сразу, без «вспышки» светлой.
const VIEWS = path.join(__dirname, 'views');
const pageCache = new Map();

function renderPage(name) {
  return (req, res) => {
    if (!pageCache.has(name) || !isProd) {
      pageCache.set(name, fs.readFileSync(path.join(VIEWS, `${name}.html`), 'utf8'));
    }
    const theme = req.cookies.theme === 'dark' ? 'dark' : 'light';
    res.type('html').send(pageCache.get(name).replaceAll('__THEME__', theme));
  };
}

// ── Страницы ──
app.get('/', requireAuthPage, renderPage('index'));
app.get('/login', redirectIfLoggedIn, renderPage('login'));
app.get('/register', redirectIfLoggedIn, renderPage('register'));

// ── API ──
app.use('/api/auth', authRoutes);

// ── Статика (CSS, JS) ──
app.use(express.static(path.join(__dirname, 'public')));

// ── 404 и обработчик ошибок ──
app.use('/api', (req, res) => res.status(404).json({ error: 'Не найдено' }));
app.use((req, res) => res.redirect('/'));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Ошибка сервера' });
});

// ── Подключаемся к MongoDB и запускаем сервер ──
mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log('MongoDB подключена');
    app.listen(PORT, () => console.log(`Сайт работает: http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('Не удалось подключиться к MongoDB:', err.message);
    process.exit(1);
  });
