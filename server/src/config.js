// Configuración centralizada. Todo sale de variables de entorno para que
// el mismo código funcione en local, en Docker y en la nube.
const os = require('os');

const env = (name, fallback) => process.env[name] ?? fallback;

module.exports = {
  port: Number(env('PORT', 3000)),
  nodeName: env('NODE_NAME', os.hostname()),

  // Escrituras al primario, lecturas a la réplica (si no hay réplica, se usa el primario)
  databaseUrl: env('DATABASE_URL', 'postgres://pulso:pulso@127.0.0.1:5432/pulso'),
  databaseReadUrl: env('DATABASE_READ_URL', ''),

  redisUrl: env('REDIS_URL', 'redis://127.0.0.1:6379'),

  jwtSecret: env('JWT_SECRET', 'cambia-esto-en-produccion'),
  jwtExpires: env('JWT_EXPIRES', '7d'),

  // Reglas de privacidad
  minAge: Number(env('MIN_AGE', 18)),
  kAnonymity: Number(env('K_ANONYMITY', 10)),       // mínimo de personas para enseñar el desglose
  minGroup: Number(env('MIN_GROUP', 3)),            // grupos más pequeños se agrupan en "otras"
  checkinHours: Number(env('CHECKIN_HOURS', 4)),    // el check-in caduca solo
  checkinRadiusM: Number(env('CHECKIN_RADIUS_M', 300)),
  statsCacheSeconds: Number(env('STATS_CACHE_SECONDS', 30)),

  // En modo demo no se exige estar físicamente en el local para hacer check-in
  demoMode: env('DEMO_MODE', 'false') === 'true',
};
