const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const SocketHandlers = require('./socket/socketHandlers');

const app = express();
const server = http.createServer(app);

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Create WebSocket server
const wss = new WebSocket.Server({ 
  server,
  perMessageDeflate: false,
  clientTracking: true
});

// Setup WebSocket handlers
const socketHandlers = new SocketHandlers(wss);
socketHandlers.setupHandlers();

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Mafia Web Application running on http://localhost:${PORT}`);
  console.log(`WebSocket server initialized`);
  console.log(`WebSocket transport enabled`);
});

// Handle server errors
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Please use a different port.`);
  } else {
    console.error('❌ Server error:', error);
  }
  process.exit(1);
});
