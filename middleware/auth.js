// Мидлвары для проверки сессии.

// Для API: если не вошёл — 401.
function requireAuthApi(req, res, next) {
  if (req.session.userId) return next();
  return res.status(401).json({ error: 'Требуется вход' });
}

// Для страниц: если не вошёл — отправляем на /login.
function requireAuthPage(req, res, next) {
  if (req.session.userId) return next();
  return res.redirect('/login');
}

// Для страниц входа/регистрации: если уже вошёл — сразу на главную.
function redirectIfLoggedIn(req, res, next) {
  if (req.session.userId) return res.redirect('/');
  return next();
}

module.exports = { requireAuthApi, requireAuthPage, redirectIfLoggedIn };
