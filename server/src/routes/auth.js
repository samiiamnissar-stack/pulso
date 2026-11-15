const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const config = require('../config');
const { sign } = require('../auth');
const { ageFrom } = require('../privacy');

const router = express.Router();

// Frena los intentos de adivinar contraseñas
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false });

const GENDERS = ['mujer', 'hombre', 'no_binario', 'otro'];
const ORIENTATIONS = ['hetero', 'gay', 'lesbiana', 'bisexual', 'otra', 'prefiero_no_decir'];

function publicUser(u) {
  return {
    id: u.id,
    email: u.email,
    alias: u.alias,
    age: ageFrom(u.birthdate),
    gender: u.gender,
    orientation: u.orientation,
    bio: u.bio,
    visibleInVenue: u.visible_in_venue,
    showOrientation: u.show_orientation,
  };
}

router.post('/register', limiter, async (req, res) => {
  const { email, password, alias, birthdate, gender, orientation, consent } = req.body || {};
  const mail = String(email || '').trim().toLowerCase();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return res.status(400).json({ error: 'El correo no es válido' });
  if (String(password || '').length < 8) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
  const name = String(alias || '').trim();
  if (name.length < 2 || name.length > 30) return res.status(400).json({ error: 'El alias debe tener entre 2 y 30 caracteres' });
  if (!birthdate || Number.isNaN(Date.parse(birthdate))) return res.status(400).json({ error: 'Indica tu fecha de nacimiento' });
  if (ageFrom(birthdate) < config.minAge) return res.status(403).json({ error: `Pulso es solo para mayores de ${config.minAge} años` });
  if (!GENDERS.includes(gender)) return res.status(400).json({ error: 'Elige un género de la lista' });
  if (!ORIENTATIONS.includes(orientation)) return res.status(400).json({ error: 'Elige una orientación de la lista' });
  if (consent !== true) return res.status(400).json({ error: 'Necesitamos tu consentimiento expreso para tratar la orientación sexual' });

  const hash = await bcrypt.hash(password, 10);
  try {
    const { rows } = await db.query(
      `INSERT INTO users (email, password_hash, alias, birthdate, gender, orientation, consent_at)
       VALUES ($1,$2,$3,$4,$5,$6, now()) RETURNING *`,
      [mail, hash, name, birthdate, gender, orientation],
    );
    return res.status(201).json({ token: sign(rows[0]), user: publicUser(rows[0]) });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe una cuenta con ese correo' });
    throw err;
  }
});

router.post('/login', limiter, async (req, res) => {
  const mail = String(req.body?.email || '').trim().toLowerCase();
  const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [mail]);
  const user = rows[0];
  const ok = user && (await bcrypt.compare(String(req.body?.password || ''), user.password_hash));
  if (!ok) return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
  return res.json({ token: sign(user), user: publicUser(user) });
});

module.exports = { router, publicUser, GENDERS, ORIENTATIONS };
