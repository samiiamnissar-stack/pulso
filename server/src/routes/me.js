const express = require('express');
const db = require('../db');
const { invalidate } = require('../redis');
const { requireAuth } = require('../auth');
const { publicUser, GENDERS, ORIENTATIONS } = require('./auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [req.userId]);
  if (!rows[0]) return res.status(404).json({ error: 'La cuenta ya no existe' });
  const { rows: ck } = await db.query(
    `SELECT c.venue_id, v.name, c.expires_at FROM checkins c JOIN venues v ON v.id = c.venue_id
     WHERE c.user_id = $1 AND c.ended_at IS NULL AND c.expires_at > now() LIMIT 1`,
    [req.userId],
  );
  return res.json({ user: publicUser(rows[0]), checkin: ck[0] || null });
});

router.patch('/', async (req, res) => {
  const b = req.body || {};
  const sets = [];
  const vals = [];
  const add = (col, val) => { vals.push(val); sets.push(`${col} = $${vals.length}`); };

  if (b.alias !== undefined) {
    const a = String(b.alias).trim();
    if (a.length < 2 || a.length > 30) return res.status(400).json({ error: 'El alias debe tener entre 2 y 30 caracteres' });
    add('alias', a);
  }
  if (b.bio !== undefined) add('bio', String(b.bio).slice(0, 160));
  if (b.gender !== undefined) {
    if (!GENDERS.includes(b.gender)) return res.status(400).json({ error: 'Género no válido' });
    add('gender', b.gender);
  }
  if (b.orientation !== undefined) {
    if (!ORIENTATIONS.includes(b.orientation)) return res.status(400).json({ error: 'Orientación no válida' });
    add('orientation', b.orientation);
  }
  if (b.visibleInVenue !== undefined) add('visible_in_venue', Boolean(b.visibleInVenue));
  if (b.showOrientation !== undefined) add('show_orientation', Boolean(b.showOrientation));
  if (!sets.length) return res.status(400).json({ error: 'No hay nada que cambiar' });

  vals.push(req.userId);
  const { rows } = await db.query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`, vals);
  await invalidate('stats:all');
  return res.json({ user: publicUser(rows[0]) });
});

// Derecho de acceso (art. 15 RGPD): todo lo que guardamos de la persona
router.get('/export', async (req, res) => {
  const id = req.userId;
  const [user, checkins, likes, matches, messages, blocks] = await Promise.all([
    db.query('SELECT id, email, alias, birthdate, gender, orientation, bio, visible_in_venue, show_orientation, consent_at, created_at FROM users WHERE id=$1', [id]),
    db.query('SELECT venue_id, created_at, expires_at, ended_at FROM checkins WHERE user_id=$1 ORDER BY created_at', [id]),
    db.query('SELECT to_user, created_at FROM likes WHERE from_user=$1', [id]),
    db.query('SELECT id, user_a, user_b, venue_id, created_at FROM matches WHERE user_a=$1 OR user_b=$1', [id]),
    db.query('SELECT match_id, body, created_at FROM messages WHERE sender_id=$1 ORDER BY created_at', [id]),
    db.query('SELECT blocked, created_at FROM blocks WHERE blocker=$1', [id]),
  ]);
  res.setHeader('Content-Disposition', 'attachment; filename="mis-datos-pulso.json"');
  return res.json({
    exportedAt: new Date().toISOString(),
    user: user.rows[0],
    checkins: checkins.rows,
    likesGiven: likes.rows,
    matches: matches.rows,
    messagesSent: messages.rows,
    blocks: blocks.rows,
  });
});

// Derecho de supresión (art. 17 RGPD): borrado real, en cascada
router.delete('/', async (req, res) => {
  await db.query('DELETE FROM users WHERE id = $1', [req.userId]);
  await invalidate('stats:all');
  return res.status(204).end();
});

module.exports = router;
