const express = require('express');
const db = require('../db');
const config = require('../config');
const { cached, invalidate } = require('../redis');
const { requireAuth } = require('../auth');
const { venueSummary, ageFrom, distanceMeters } = require('../privacy');
const realtime = require('../realtime');

const router = express.Router();
router.use(requireAuth);

const ACTIVE = 'c.ended_at IS NULL AND c.expires_at > now()';

// Calcula el resumen de todos los locales de una vez y lo guarda en caché.
// Con 30 s de caché, aunque miles de personas abran la lista a la vez,
// la base de datos solo hace este trabajo dos veces por minuto.
async function allSummaries() {
  return cached('stats:all', config.statsCacheSeconds, async () => {
    const [venues, totals, orient, genders] = await Promise.all([
      db.read('SELECT * FROM venues ORDER BY name'),
      db.read(`SELECT c.venue_id, count(*) AS total,
                      avg(extract(year FROM age(u.birthdate))) AS avg_age
               FROM checkins c JOIN users u ON u.id = c.user_id
               WHERE ${ACTIVE} GROUP BY c.venue_id`),
      db.read(`SELECT c.venue_id, u.orientation AS key, count(*) AS n
               FROM checkins c JOIN users u ON u.id = c.user_id
               WHERE ${ACTIVE} GROUP BY 1, 2`),
      db.read(`SELECT c.venue_id, u.gender AS key, count(*) AS n
               FROM checkins c JOIN users u ON u.id = c.user_id
               WHERE ${ACTIVE} GROUP BY 1, 2`),
    ]);
    const byVenue = (rows, id) => rows.filter((r) => r.venue_id === id);
    return venues.rows.map((v) => {
      const t = totals.rows.find((r) => r.venue_id === v.id);
      return {
        id: v.id,
        slug: v.slug,
        name: v.name,
        barrio: v.barrio,
        address: v.address,
        lat: v.lat,
        lng: v.lng,
        capacity: v.capacity,
        music: v.music,
        opens: v.opens,
        closes: v.closes,
        summary: venueSummary(
          {
            total: t ? t.total : 0,
            capacity: v.capacity,
            avgAge: t ? t.avg_age : null,
            orientations: byVenue(orient.rows, v.id),
            genders: byVenue(genders.rows, v.id),
          },
          { k: config.kAnonymity, minGroup: config.minGroup },
        ),
      };
    });
  });
}

router.get('/', async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const hasPos = Number.isFinite(lat) && Number.isFinite(lng);
  let list = await allSummaries();
  if (hasPos) {
    list = list
      .map((v) => ({ ...v, distance: Math.round(distanceMeters(lat, lng, v.lat, v.lng)) }))
      .sort((a, b) => a.distance - b.distance);
  }
  if (req.query.vibe) list = list.filter((v) => v.summary.vibe === req.query.vibe);
  return res.json({ venues: list, rules: { k: config.kAnonymity } });
});

router.get('/:id', async (req, res) => {
  const venue = (await allSummaries()).find((v) => v.id === Number(req.params.id));
  if (!venue) return res.status(404).json({ error: 'Ese local no existe' });
  return res.json({ venue });
});

router.post('/:id/checkin', async (req, res) => {
  const venueId = Number(req.params.id);
  const { rows } = await db.query('SELECT * FROM venues WHERE id = $1', [venueId]);
  const venue = rows[0];
  if (!venue) return res.status(404).json({ error: 'Ese local no existe' });

  // Se comprueba que la persona está realmente en el local, pero las
  // coordenadas se descartan aquí: no se guardan en ningún sitio.
  if (!config.demoMode) {
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: 'Necesitamos tu ubicación un momento para confirmar que estás en el local' });
    }
    const d = distanceMeters(lat, lng, venue.lat, venue.lng);
    if (d > config.checkinRadiusM) {
      return res.status(403).json({ error: `Estás a ${Math.round(d)} m. Para hacer check-in tienes que estar en el local` });
    }
  }

  await db.tx(async (c) => {
    await c.query(`UPDATE checkins SET ended_at = now() WHERE user_id = $1 AND ended_at IS NULL`, [req.userId]);
    await c.query(
      `INSERT INTO checkins (user_id, venue_id, expires_at) VALUES ($1, $2, now() + make_interval(hours => $3))`,
      [req.userId, venueId, config.checkinHours],
    );
  });
  await invalidate('stats:all');
  realtime.broadcast('venue:update', { venueId });
  return res.status(201).json({ ok: true, venueId, hours: config.checkinHours });
});

router.delete('/checkin/current', async (req, res) => {
  const { rows } = await db.query(
    `UPDATE checkins SET ended_at = now() WHERE user_id = $1 AND ended_at IS NULL RETURNING venue_id`,
    [req.userId],
  );
  await invalidate('stats:all');
  if (rows[0]) realtime.broadcast('venue:update', { venueId: rows[0].venue_id });
  return res.json({ ok: true });
});

// Personas visibles en un local. Solo las ve quien también ha hecho check-in
// allí, y solo aparecen quienes han activado "visible en el local".
router.get('/:id/people', async (req, res) => {
  const venueId = Number(req.params.id);
  const { rows: mine } = await db.query(
    `SELECT 1 FROM checkins c WHERE c.user_id = $1 AND c.venue_id = $2 AND ${ACTIVE}`,
    [req.userId, venueId],
  );
  if (!mine.length) return res.status(403).json({ error: 'Haz check-in en el local para ver quién se deja ver' });

  const { rows } = await db.query(
    `SELECT u.id, u.alias, u.birthdate, u.gender, u.bio,
            CASE WHEN u.show_orientation THEN u.orientation END AS orientation,
            EXISTS (SELECT 1 FROM likes l WHERE l.from_user = $1 AND l.to_user = u.id) AS liked
     FROM checkins c JOIN users u ON u.id = c.user_id
     WHERE c.venue_id = $2 AND ${ACTIVE}
       AND u.visible_in_venue AND u.id <> $1
       AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker = $1 AND b.blocked = u.id) OR (b.blocker = u.id AND b.blocked = $1))
     ORDER BY c.created_at DESC
     LIMIT 100`,
    [req.userId, venueId],
  );
  return res.json({
    people: rows.map((p) => ({
      id: p.id, alias: p.alias, age: ageFrom(p.birthdate), gender: p.gender,
      orientation: p.orientation, bio: p.bio, liked: p.liked,
    })),
  });
});

module.exports = router;
