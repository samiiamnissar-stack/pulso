const jwt = require('jsonwebtoken');
const config = require('./config');

function sign(user) {
  return jwt.sign({ sub: user.id }, config.jwtSecret, { expiresIn: config.jwtExpires });
}

function verify(token) {
  return jwt.verify(token, config.jwtSecret);
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Necesitas iniciar sesión' });
  try {
    req.userId = verify(token).sub;
    return next();
  } catch {
    return res.status(401).json({ error: 'La sesión ha caducado, vuelve a entrar' });
  }
}

module.exports = { sign, verify, requireAuth };
