// Tiempo real con Socket.IO. El adaptador de Redis hace que un mensaje
// emitido en el nodo 1 llegue a un usuario conectado al nodo 3, así que
// se pueden añadir nodos detrás del balanceador sin romper el chat.
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { verify } = require('./auth');
const { newClient } = require('./redis');
const config = require('./config');

let io = null;

function attach(httpServer) {
  io = new Server(httpServer, { path: '/socket.io', cors: { origin: false } });

  const pub = newClient();
  const sub = newClient();
  io.adapter(createAdapter(pub, sub));

  io.use((socket, next) => {
    try {
      socket.userId = verify(socket.handshake.auth?.token).sub;
      next();
    } catch {
      next(new Error('no autorizado'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.userId}`);
    socket.emit('hello', { node: config.nodeName });
  });

  return io;
}

function toUser(userId, event, payload) {
  if (io) io.to(`user:${userId}`).emit(event, payload);
}

function broadcast(event, payload) {
  if (io) io.emit(event, payload);
}

async function close() {
  if (io) await new Promise((r) => io.close(() => r()));
}

module.exports = { attach, toUser, broadcast, close };
