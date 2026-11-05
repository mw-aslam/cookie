# Cookie — авторизация на сессиях + тёмная тема в cookie

Fullstack-сайт: **Node.js + Express**, фронтенд на **HTML + JavaScript**, база **MongoDB Atlas** через **Mongoose**.

- Регистрация и вход (email + пароль, пароль хэшируется **bcrypt**)
- Сессии через **express-session** + **connect-mongo** — хранятся в MongoDB, вход не пропадает после обновления страницы
- Переключатель темы **Light / Dark**, состояние в cookie `theme` — сохраняется после закрытия вкладки и выхода из аккаунта

## Запуск

```bash
npm install
cp .env.example .env   # затем вставьте свою строку MONGODB_URI и SESSION_SECRET
npm start              # http://localhost:3000
```

### Где взять MONGODB_URI

MongoDB Atlas → **Database → Connect → Drivers** → скопировать строку,
вставить `<password>` и имя базы после `.net/`:

```
MONGODB_URI=mongodb+srv://user:pass@cluster0.abcde.mongodb.net/cookieapp?retryWrites=true&w=majority
```

В **Network Access** добавьте свой IP (или `0.0.0.0/0` для теста).

## API

| Метод | Путь | Описание |
|---|---|---|
| POST | `/api/auth/register` | `{ email, password }` → создать пользователя |
| POST | `/api/auth/login` | `{ email, password }` → создать сессию |
| POST | `/api/auth/logout` | удалить сессию |
| GET | `/api/auth/me` | текущий пользователь или 401 |

## Структура

```
server.js            Express, cookie-parser, express-session, connect-mongo, Mongoose
routes/auth.js       регистрация, логин, логаут, проверка сессии
models/User.js       модель пользователя + bcrypt
middleware/auth.js   защита страниц
views/               index.html, login.html, register.html
public/js/theme.js   переключение темы и запись cookie
public/js/auth.js    fetch-запросы к серверу
public/css/style.css светлая и тёмная тема
```
