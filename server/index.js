const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const SocketHandlers = require('./socket/socketHandlers');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Setup Socket.io handlers
const socketHandlers = new SocketHandlers(io);
socketHandlers.setupHandlers();

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Mafia Web Application running on http://localhost:${PORT}`);
});
