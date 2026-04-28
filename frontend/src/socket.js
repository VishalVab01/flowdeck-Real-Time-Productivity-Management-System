import { io as ioClient } from 'socket.io-client';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

let socket = null;

export function connectSocket(token, handlers = {}) {
  if (socket && socket.connected) return socket;
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socket = ioClient(BACKEND_URL, {
    path: '/api/socket.io/',
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
  });

  socket.on('connect', () => {
    if (handlers.onConnect) handlers.onConnect();
  });
  socket.on('disconnect', () => {
    if (handlers.onDisconnect) handlers.onDisconnect();
  });
  socket.on('connect_error', (err) => {
    if (handlers.onError) handlers.onError(err);
  });

  if (handlers.onTaskCreated) socket.on('task:created', handlers.onTaskCreated);
  if (handlers.onTaskUpdated) socket.on('task:updated', handlers.onTaskUpdated);
  if (handlers.onTaskDeleted) socket.on('task:deleted', handlers.onTaskDeleted);

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

export function getSocket() {
  return socket;
}
