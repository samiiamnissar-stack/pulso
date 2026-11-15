// Balanceador de laboratorio, sin dependencias.
// Reparte las peticiones en round-robin entre varios nodos de la API,
// comprueba /health cada 2 segundos y, si un nodo no responde, deja de
// enviarle tráfico. En producción este papel lo hace nginx (ver infra/).
//
// Uso: UPSTREAMS=http://127.0.0.1:3001,http://127.0.0.1:3002 PORT=8080 node tools/balancer.js
const http = require('http');
const net = require('net');

const PORT = Number(process.env.PORT || 8080);
const upstreams = (process.env.UPSTREAMS || 'http://127.0.0.1:3001,http://127.0.0.1:3002,http://127.0.0.1:3003')
  .split(',')
  .map((u) => {
    const url = new URL(u.trim());
    return { url: u.trim(), host: url.hostname, port: Number(url.port || 80), healthy: true, served: 0 };
  });

let cursor = 0;
function next(exclude = new Set()) {
  for (let i = 0; i < upstreams.length; i += 1) {
    const u = upstreams[(cursor + i) % upstreams.length];
    if (u.healthy && !exclude.has(u)) {
      cursor = (cursor + i + 1) % upstreams.length;
      return u;
    }
  }
  return null;
}

function setHealth(u, ok, why = '') {
  if (ok !== u.healthy) console.log(`[lb] ${new Date().toLocaleTimeString('es-ES')} ${u.url} → ${ok ? 'SANO' : `CAÍDO ${why}`}`);
  u.healthy = ok;
}

function check(u) {
  let done = false;
  const finish = (ok, why) => { if (!done) { done = true; setHealth(u, ok, why); } };
  const req = http.get({ host: u.host, port: u.port, path: '/health', agent: false }, (res) => {
    res.resume();
    finish(res.statusCode === 200, `(HTTP ${res.statusCode})`);
  });
  req.setTimeout(1500, () => req.destroy(new Error('timeout')));
  req.on('error', (err) => finish(false, `(${err.code || err.message})`));
}
setInterval(() => upstreams.forEach(check), 2000).unref();
upstreams.forEach(check);

function forward(req, res, body, tried = new Set()) {
  const u = next(tried);
  if (!u) {
    res.writeHead(503, { 'content-type': 'application/json' });
    res.end('{"error":"Ningún nodo disponible"}');
    return;
  }
  tried.add(u);
  const proxied = http.request({
    host: u.host, port: u.port, method: req.method, path: req.url,
    headers: { ...req.headers, 'x-forwarded-for': req.socket.remoteAddress },
  }, (up) => {
    u.served += 1;
    res.writeHead(up.statusCode, up.headers);
    up.pipe(res);
  });
  proxied.on('error', (err) => {
    // Si el nodo no acepta la conexión, se marca como caído y la petición
    // se reintenta en otro nodo sin que el usuario note nada.
    if (err.code === 'ECONNREFUSED' || err.code === 'EHOSTUNREACH') setHealth(u, false, `(${err.code})`);
    if (!res.headersSent) forward(req, res, body, tried);
  });
  proxied.end(body);
}

const server = http.createServer((req, res) => {
  if (req.url === '/lb-status') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(upstreams.map(({ url, healthy, served }) => ({ url, healthy, served })), null, 2));
    return;
  }
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => forward(req, res, Buffer.concat(chunks)));
});

// WebSockets (chat en tiempo real): se pasa la conexión tal cual a un nodo sano
server.on('upgrade', (req, socket, head) => {
  const u = next();
  if (!u) { socket.destroy(); return; }
  const up = net.connect(u.port, u.host, () => {
    const headers = Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n');
    up.write(`${req.method} ${req.url} HTTP/1.1\r\n${headers}\r\n\r\n`);
    if (head?.length) up.write(head);
    up.pipe(socket);
    socket.pipe(up);
  });
  up.on('error', () => socket.destroy());
  socket.on('error', () => up.destroy());
});

server.keepAliveTimeout = 65000;
server.listen(PORT, () => console.log(`[lb] escuchando en :${PORT} → ${upstreams.map((u) => u.url).join(', ')}`));
