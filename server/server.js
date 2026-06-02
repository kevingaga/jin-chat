const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

const MAX_HISTORY = 50;
const history = [];           // messages globaux et commerce
const socketMaps = {};        // socketId → mapName (pour le canal Zone)

// ── Helpers ──────────────────────────────────────────────────────────────────

function sanitize(str, max) {
  return String(str || '').trim().slice(0, max);
}

function buildMsg(data, socketId) {
  const channel = ['global', 'zone', 'trade'].includes(data.channel)
    ? data.channel
    : 'global';
  return {
    id:        `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name:      sanitize(data.name,  24) || 'Inconnu',
    text:      sanitize(data.text, 200),
    map:       sanitize(data.map,  64)  || null,
    channel,
    timestamp: new Date().toISOString()
  };
}

// ── Connexion ─────────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  const count = () => io.engine.clientsCount;

  console.log(`[+] ${socket.id} — ${count()} connecté(s)`);
  io.emit('chat:players', count());

  // Historique (messages global + commerce uniquement — la zone est contextuelle)
  socket.emit('chat:history', history);

  // Le client indique sa carte actuelle (appelé à chaque changement de map)
  socket.on('chat:location', (mapName) => {
    const prev = socketMaps[socket.id];
    if (prev) socket.leave(`map:${prev}`);
    const next = sanitize(mapName, 64);
    socketMaps[socket.id] = next;
    if (next) socket.join(`map:${next}`);
  });

  socket.on('chat:send', (data) => {
    if (!data?.text?.trim()) return;
    const msg = buildMsg(data, socket.id);

    if (msg.channel === 'zone') {
      // Broadcast uniquement aux joueurs sur la même carte
      const room = `map:${socketMaps[socket.id] || ''}`;
      io.to(room).emit('chat:message', msg);
      // Pas d'historique persisté pour la zone (contextuel)
    } else {
      // Global et Commerce → tout le monde
      history.push(msg);
      if (history.length > MAX_HISTORY) history.shift();
      io.emit('chat:message', msg);
    }

    const mapTag = msg.map ? ` [${msg.map}]` : '';
    console.log(`[${msg.channel}]${mapTag} ${msg.name}: ${msg.text}`);
  });

  socket.on('disconnect', () => {
    const prev = socketMaps[socket.id];
    if (prev) socket.leave(`map:${prev}`);
    delete socketMaps[socket.id];
    io.emit('chat:players', count());
    console.log(`[-] ${socket.id} — ${count()} connecté(s)`);
  });
});

app.get('/health', (_, res) =>
  res.json({ status: 'ok', players: io.engine.clientsCount })
);

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => console.log(`JIN Chat — port ${PORT}`));
