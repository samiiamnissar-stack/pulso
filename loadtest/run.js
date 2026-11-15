// Prueba de carga con autocannon.
// Simula el uso real de la app en hora punta: la mayoría de peticiones son
// consultas de la lista de locales y del detalle de un local, y una parte
// menor son consultas del perfil y de los matches.
//
// Uso:
//   API_URL=http://localhost:8080 DURATION=30 CONNECTIONS=100 node loadtest/run.js
//
// Antes hay que haber cargado los datos de ejemplo (npm run seed) y arrancar
// los nodos con RATE_LIMIT alto, porque si no el límite por IP corta la prueba.
const path = require('path');

const autocannon = require(require.resolve('autocannon', { paths: [path.join(__dirname, '..', 'server')] }));

const API = process.env.API_URL || 'http://localhost:8080';
const DURATION = Number(process.env.DURATION || 30);
const CONNECTIONS = Number(process.env.CONNECTIONS || 100);

async function login() {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'demo@pulso.app', password: 'pulso1234' }),
  });
  if (!res.ok) throw new Error(`No se pudo iniciar sesión: ${res.status}`);
  return (await res.json()).token;
}

async function main() {
  const token = await login();
  const headers = { authorization: `Bearer ${token}` };

  // Reparto de peticiones (en 10 "turnos"): 6 lista, 2 detalle, 1 perfil, 1 matches
  const requests = [
    { method: 'GET', path: '/api/venues?lat=40.4234&lng=-3.6979', headers },
    { method: 'GET', path: '/api/venues?vibe=lgtbi', headers },
    { method: 'GET', path: '/api/venues?lat=40.4100&lng=-3.7000', headers },
    { method: 'GET', path: '/api/venues/2', headers },
    { method: 'GET', path: '/api/venues', headers },
    { method: 'GET', path: '/api/venues/5', headers },
    { method: 'GET', path: '/api/me', headers },
    { method: 'GET', path: '/api/venues?vibe=mixto', headers },
    { method: 'GET', path: '/api/matches', headers },
    { method: 'GET', path: '/api/venues?lat=40.4300&lng=-3.7160', headers },
  ];

  console.log(`Prueba de carga contra ${API}: ${CONNECTIONS} conexiones durante ${DURATION} s\n`);
  const result = await autocannon({ url: API, connections: CONNECTIONS, duration: DURATION, requests });

  const non2xx = result.non2xx || 0;
  const summary = {
    'peticiones/s (media)': Math.round(result.requests.average),
    'peticiones/s (máx.)': result.requests.max,
    'latencia media (ms)': result.latency.average,
    'latencia p50 (ms)': result.latency.p50,
    'latencia p99 (ms)': result.latency.p99,
    'peticiones totales': result.requests.total,
    'respuestas no 2xx': non2xx,
    'errores de conexión': result.errors,
    'KB/s recibidos (media)': Math.round(result.throughput.average / 1024),
    'tamaño medio respuesta (KB)': +(result.throughput.total / Math.max(result.requests.total, 1) / 1024).toFixed(1),
  };
  console.table(summary);
  if (process.env.JSON_OUT) {
    require('fs').writeFileSync(process.env.JSON_OUT, JSON.stringify({ api: API, connections: CONNECTIONS, duration: DURATION, ...summary }, null, 2));
  }
}

main().catch((err) => { console.error(err.message); process.exit(1); });
