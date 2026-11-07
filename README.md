# Cookie — JWT-авторизация (access + refresh) + тёмная тема в cookie

Fullstack-сайт: **Node.js + Express**, фронтенд на **HTML + JavaScript**, база **MongoDB Atlas** (Mongoose).

- Регистрация: имя, email, пароль (хэш **bcrypt**)
- Вход по **JWT**: `accessToken` — 3 минуты, `refreshToken` — 7 дней, оба в httpOnly cookie
- Access обновляется автоматически по refresh; refresh-токен хранится в БД как sha256 и отзывается при выходе
- Переключатель темы Light / Dark в cookie `theme`

## Запуск

```bash
npm install
cp .env.example .env   # заполните MONGODB_URI, JWT_SECRET, JWT_REFRESH_SECRET
npm run dev            # http://localhost:3000
```

Секрет: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
В Atlas → Network Access добавьте свой IP.

## API

| Метод | Путь | Описание |
|---|---|---|
| POST | `/api/auth/register` | `{ name, email, password }` |
| POST | `/api/auth/login` | `{ email, password }` → токены в cookie и JSON |
| POST | `/api/auth/refresh` | новая пара токенов по refresh |
| POST | `/api/auth/logout` | отзывает refresh, стирает cookie |
| GET | `/api/auth/me` | текущий пользователь или 401 |
