const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

const MAX_HISTORY = 50;
const messageHistory = [];
let connectedCount = 0;

function buildMessage(data, socketId) {
  return {
    id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    name: (data.name || 'Inconnu').slice(0, 24),
    text: (data.text || '').trim().slice(0, 200),
    map: data.map || null,
    timestamp: new Date().toISOString()
  };
}

io.on('connection', (socket) => {
  connectedCount++;
  console.log(`[+] ${socket.id} — ${connectedCount} connecté(s)`);

  // Send recent history to the new client
  socket.emit('chat:history', messageHistory);

  // Broadcast current player count
  io.emit('chat:players', connectedCount);

  socket.on('chat:send', (data) => {
    if (!data || !data.text || !data.text.trim()) return;

    const msg = buildMessage(data, socket.id);
    messageHistory.push(msg);
    if (messageHistory.length > MAX_HISTORY) messageHistory.shift();

    io.emit('chat:message', msg);
    console.log(`[msg] ${msg.name}${msg.map ? ' [' + msg.map + ']' : ''}: ${msg.text}`);
  });

  socket.on('disconnect', () => {
    connectedCount = Math.max(0, connectedCount - 1);
    io.emit('chat:players', connectedCount);
    console.log(`[-] ${socket.id} — ${connectedCount} connecté(s)`);
  });
});

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok', players: connectedCount }));

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`JIN Chat server — port ${PORT}`);
});
