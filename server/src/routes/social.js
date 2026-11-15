const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');
const realtime = require('../realtime');

const router = express.Router();
router.use(requireAuth);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const pair = (x, y) => (x < y ? [x, y] : [y, x]);

async function isBlocked(a, b) {
  const { rows } = await db.query(
    'SELECT 1 FROM blocks WHERE (blocker=$1 AND blocked=$2) OR (blocker=$2 AND blocked=$1)', [a, b],
  );
  return rows.length > 0;
}

async function matchFor(matchId, userId) {
  const { rows } = await db.query(
    'SELECT * FROM matches WHERE id = $1 AND (user_a = $2 OR user_b = $2)', [matchId, userId],
  );
  return rows[0];
}

// "Me gusta". Si la otra persona ya te lo había dado, se crea el emparejamiento.
router.post('/likes/:userId', async (req, res) => {
  const me = req.userId;
  const other = req.params.userId;
  if (!UUID.test(other) || other === me) return res.status(400).json({ error: 'Usuario no válido' });
  if (await isBlocked(me, other)) return res.status(403).json({ error: 'No puedes interactuar con esta persona' });

  // Solo se puede dar like a alguien visible en el mismo local que tú
  const { rows: same } = await db.query(
    `SELECT a.venue_id FROM checkins a JOIN checkins b ON a.venue_id = b.venue_id
     JOIN users u ON u.id = b.user_id
     WHERE a.user_id = $1 AND b.user_id = $2 AND u.visible_in_venue
       AND a.ended_at IS NULL AND a.expires_at > now() AND b.ended_at IS NULL AND b.expires_at > now()`,
    [me, other],
  );
  if (!same.length) return res.status(403).json({ error: 'Esa persona ya no está visible en tu local' });
  const venueId = same[0].venue_id;

  const result = await db.tx(async (c) => {
    await c.query('INSERT INTO likes (from_user, to_user) VALUES ($1,$2) ON CONFLICT DO NOTHING', [me, other]);
    const { rows: back } = await c.query('SELECT 1 FROM likes WHERE from_user=$1 AND to_user=$2', [other, me]);
    if (!back.length) return { match: null };
    const [a, b] = pair(me, other);
    const { rows } = await c.query(
      `INSERT INTO matches (user_a, user_b, venue_id) VALUES ($1,$2,$3)
       ON CONFLICT (user_a, user_b) DO UPDATE SET user_a = EXCLUDED.user_a RETURNING id`,
      [a, b, venueId],
    );
    return { match: rows[0].id };
  });

  if (result.match) {
    realtime.toUser(other, 'match:new', { matchId: result.match });
    realtime.toUser(me, 'match:new', { matchId: result.match });
  }
  return res.status(201).json(result);
});

router.get('/matches', async (req, res) => {
  const { rows } = await db.query(
    `SELECT m.id, m.created_at, v.name AS venue,
            u.id AS other_id, u.alias AS other_alias,
            (SELECT body FROM messages WHERE match_id = m.id ORDER BY created_at DESC LIMIT 1) AS last_message,
            (SELECT created_at FROM messages WHERE match_id = m.id ORDER BY created_at DESC LIMIT 1) AS last_at
     FROM matches m
     JOIN users u ON u.id = CASE WHEN m.user_a = $1 THEN m.user_b ELSE m.user_a END
     LEFT JOIN venues v ON v.id = m.venue_id
     WHERE (m.user_a = $1 OR m.user_b = $1)
       AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker = $1 AND b.blocked = u.id) OR (b.blocker = u.id AND b.blocked = $1))
     ORDER BY COALESCE((SELECT max(created_at) FROM messages WHERE match_id = m.id), m.created_at) DESC`,
    [req.userId],
  );
  return res.json({ matches: rows });
});

router.get('/matches/:id/messages', async (req, res) => {
  const match = await matchFor(Number(req.params.id), req.userId);
  if (!match) return res.status(404).json({ error: 'Conversación no encontrada' });
  const { rows } = await db.query(
    'SELECT id, sender_id, body, created_at FROM messages WHERE match_id = $1 ORDER BY created_at ASC LIMIT 200',
    [match.id],
  );
  return res.json({ messages: rows });
});

router.post('/matches/:id/messages', async (req, res) => {
  const match = await matchFor(Number(req.params.id), req.userId);
  if (!match) return res.status(404).json({ error: 'Conversación no encontrada' });
  const other = match.user_a === req.userId ? match.user_b : match.user_a;
  if (await isBlocked(req.userId, other)) return res.status(403).json({ error: 'No puedes escribir a esta persona' });
  const body = String(req.body?.body || '').trim();
  if (!body || body.length > 1000) return res.status(400).json({ error: 'El mensaje debe tener entre 1 y 1000 caracteres' });

  const { rows } = await db.query(
    'INSERT INTO messages (match_id, sender_id, body) VALUES ($1,$2,$3) RETURNING id, sender_id, body, created_at',
    [match.id, req.userId, body],
  );
  const msg = { matchId: match.id, ...rows[0] };
  realtime.toUser(other, 'message:new', msg);
  realtime.toUser(req.userId, 'message:new', msg);
  return res.status(201).json({ message: rows[0] });
});

router.post('/blocks/:userId', async (req, res) => {
  const other = req.params.userId;
  if (!UUID.test(other) || other === req.userId) return res.status(400).json({ error: 'Usuario no válido' });
  await db.query('INSERT INTO blocks (blocker, blocked) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.userId, other]);
  return res.status(201).json({ ok: true });
});

router.post('/reports', async (req, res) => {
  const { userId, reason } = req.body || {};
  if (!UUID.test(String(userId))) return res.status(400).json({ error: 'Usuario no válido' });
  const text = String(reason || '').trim().slice(0, 500);
  if (!text) return res.status(400).json({ error: 'Cuéntanos brevemente qué ha pasado' });
  await db.query('INSERT INTO reports (reporter, reported, reason) VALUES ($1,$2,$3)', [req.userId, userId, text]);
  // Quien denuncia, además, deja de ver a esa persona
  await db.query('INSERT INTO blocks (blocker, blocked) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.userId, userId]);
  return res.status(201).json({ ok: true });
});

module.exports = router;
