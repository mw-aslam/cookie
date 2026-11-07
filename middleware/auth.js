// JWT-авторизация: access-токен (3 мин) и refresh-токен (7 дней) в httpOnly cookie.
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');

const ACCESS_TTL_SEC = 3 * 60;
const REFRESH_TTL_SEC = 7 * 24 * 60 * 60;

const accessSecret = () => process.env.JWT_SECRET;
const refreshSecret = () => process.env.JWT_REFRESH_SECRET || `${process.env.JWT_SECRET}_refresh`;
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

const cookieOpts = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
});

function issueTokens(user) {
  const accessToken = jwt.sign(
    { id: user._id.toString(), name: user.name, email: user.email },
    accessSecret(),
    { expiresIn: ACCESS_TTL_SEC }
  );
  const refreshToken = jwt.sign({ id: user._id.toString() }, refreshSecret(), {
    expiresIn: REFRESH_TTL_SEC,
  });
  return { accessToken, refreshToken };
}

function setAuthCookies(res, { accessToken, refreshToken }) {
  res.cookie('accessToken', accessToken, { ...cookieOpts(), maxAge: ACCESS_TTL_SEC * 1000 });
  res.cookie('refreshToken', refreshToken, { ...cookieOpts(), maxAge: REFRESH_TTL_SEC * 1000 });
}

function clearAuthCookies(res) {
  res.clearCookie('accessToken', cookieOpts());
  res.clearCookie('refreshToken', cookieOpts());
}

// Создаёт пару токенов, сохраняет хэш refresh в БД и ставит cookie.
async function startSession(res, user) {
  // Старые аккаунты (созданные до появления поля name): берём имя из email.
  if (!user.name) user.name = user.email.split('@')[0];
  const tokens = issueTokens(user);
  user.refreshTokenHash = sha256(tokens.refreshToken);
  await user.save();
  setAuthCookies(res, tokens);
  return tokens;
}

// Проверяет refresh-токен и возвращает пользователя (или null).
async function findUserByRefresh(req) {
  const token = req.body?.refreshToken || req.cookies?.refreshToken;
  if (!token) return null;
  let data;
  try {
    data = jwt.verify(token, refreshSecret());
  } catch {
    return null;
  }
  const user = await User.findById(data.id);
  if (!user || user.refreshTokenHash !== sha256(token)) return null;
  return user;
}

// Меняет refresh на новую пару (rotation). Возвращает user или null.
async function refreshSession(req, res) {
  const user = await findUserByRefresh(req);
  if (!user) return null;
  await startSession(res, user);
  return user;
}

// Отзывает refresh-токен (для logout).
async function revokeSession(req) {
  const user = await findUserByRefresh(req);
  if (user) {
    await User.updateOne({ _id: user._id }, { refreshTokenHash: null });
  }
}

// Валидный access → пользователь; иначе тихо обновляем по refresh.
async function authenticate(req, res) {
  const header = req.headers.authorization || '';
  const token = (header.startsWith('Bearer ') ? header.slice(7) : '') || req.cookies?.accessToken;
  if (token) {
    try {
      const p = jwt.verify(token, accessSecret());
      return { id: p.id, name: p.name, email: p.email };
    } catch {
      /* истёк или неверный — пробуем refresh */
    }
  }
  const user = await refreshSession(req, res);
  return user ? { id: user._id.toString(), name: user.name, email: user.email } : null;
}

async function requireAuthApi(req, res, next) {
  try {
    const user = await authenticate(req, res);
    if (!user) return res.status(401).json({ error: 'Требуется вход' });
    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

async function requireAuthPage(req, res, next) {
  try {
    const user = await authenticate(req, res);
    if (!user) return res.redirect('/login');
    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

async function redirectIfLoggedIn(req, res, next) {
  try {
    if (await authenticate(req, res)) return res.redirect('/');
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  requireAuthApi,
  requireAuthPage,
  redirectIfLoggedIn,
  startSession,
  refreshSession,
  revokeSession,
  clearAuthCookies,
};
