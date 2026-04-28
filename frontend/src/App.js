import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Insights from './pages/Insights';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import { fetchMe } from './store/authSlice';
import {
  setSocketConnected,
  socketTaskCreated,
  socketTaskUpdated,
  socketTaskDeleted,
} from './store/tasksSlice';
import { connectSocket, disconnectSocket } from './socket';
import './App.css';

function App() {
  const dispatch = useDispatch();
  const { token, status } = useSelector((s) => s.auth);

  // Rehydrate user from token (once at startup)
  useEffect(() => {
    if (token && !['authenticated', 'loading'].includes(status)) {
      dispatch(fetchMe());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // App-level socket lifecycle: stays connected for ALL authenticated routes.
  // Only disconnects when token disappears (logout) or app unmounts.
  useEffect(() => {
    if (!token) {
      disconnectSocket();
      return undefined;
    }
    connectSocket(token, {
      onConnect: () => dispatch(setSocketConnected(true)),
      onDisconnect: () => dispatch(setSocketConnected(false)),
      onError: () => dispatch(setSocketConnected(false)),
      onTaskCreated: (task) => dispatch(socketTaskCreated(task)),
      onTaskUpdated: (task) => dispatch(socketTaskUpdated(task)),
      onTaskDeleted: (data) => dispatch(socketTaskDeleted(data)),
    });
    return () => disconnectSocket();
  }, [token, dispatch]);

  return (
    <div className="App app-shell">
      <Navbar />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/insights"
          element={
            <ProtectedRoute>
              <Insights />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </div>
  );
}

export default App;
