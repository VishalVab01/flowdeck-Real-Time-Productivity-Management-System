require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');

const authRoutes = require('./routes/auth');
const buildTaskRoutes = require('./routes/tasks');
const insightsRoutes = require('./routes/insights');

const app = express();
const server = http.createServer(app);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));

// --- Socket.io setup ---
// Mount under /api/socket.io/ so the Kubernetes ingress (which routes /api/*
// to port 8001) forwards WebSocket traffic to this server.
const io = new Server(server, {
  path: '/api/socket.io/',
  cors: { origin: true, credentials: true },
});

// JWT auth handshake — frontend sends `auth: { token }` when connecting
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Missing token'));
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = payload.sub;
    socket.userEmail = payload.email;
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  socket.join(`user:${socket.userId}`);
  console.log(`[socket] user ${socket.userEmail} connected (${socket.id})`);
  socket.on('disconnect', () => {
    console.log(`[socket] user ${socket.userEmail} disconnected (${socket.id})`);
  });
});

// Make io available to route handlers via app.locals
app.locals.io = io;

// --- HTTP routes ---
app.get('/api/', (req, res) => res.json({ message: 'Productivity API is running' }));
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/tasks', buildTaskRoutes(io));
app.use('/api/insights', insightsRoutes);

app.use('/api', (req, res) => res.status(404).json({ message: 'Not found' }));

const PORT = parseInt(process.env.PORT || '8001', 10);
const MONGO_URL = process.env.MONGO_URL;
const DB_NAME = process.env.DB_NAME;

mongoose
  .connect(MONGO_URL, { dbName: DB_NAME })
  .then(() => {
    console.log(`[mongo] connected to ${DB_NAME}`);
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`[api] listening on 0.0.0.0:${PORT} (http + socket.io)`);
    });
  })
  .catch((err) => {
    console.error('[mongo] connection error:', err);
    process.exit(1);
  });
