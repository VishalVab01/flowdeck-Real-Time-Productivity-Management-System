import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../api/client';

export const fetchTasks = createAsyncThunk('tasks/fetch', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/tasks');
    return data.tasks;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to fetch tasks');
  }
});

export const createTask = createAsyncThunk(
  'tasks/create',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/tasks', payload);
      return data.task;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to create task');
    }
  }
);

export const updateTask = createAsyncThunk(
  'tasks/update',
  async ({ id, updates }, { rejectWithValue }) => {
    try {
      const { data } = await api.put(`/tasks/${id}`, updates);
      return data.task;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update task');
    }
  }
);

export const deleteTask = createAsyncThunk(
  'tasks/delete',
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/tasks/${id}`);
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete task');
    }
  }
);

const upsert = (items, task) => {
  const idx = items.findIndex((t) => t.id === task.id);
  if (idx === -1) items.unshift(task);
  else items[idx] = task;
};

const tasksSlice = createSlice({
  name: 'tasks',
  initialState: {
    items: [],
    status: 'idle',
    error: null,
    filter: 'All',
    tick: 0,        // bumped every 30s to trigger client-side priority recalc
    socketConnected: false,
  },
  reducers: {
    setFilter(state, action) { state.filter = action.payload; },
    clearTasks(state) {
      state.items = [];
      state.status = 'idle';
      state.error = null;
      state.socketConnected = false;
    },
    bumpTick(state) { state.tick += 1; },
    setSocketConnected(state, action) { state.socketConnected = action.payload; },
    // Socket-driven mutations (idempotent — safe even if API call also returns)
    socketTaskCreated(state, action) { upsert(state.items, action.payload); },
    socketTaskUpdated(state, action) { upsert(state.items, action.payload); },
    socketTaskDeleted(state, action) {
      state.items = state.items.filter((t) => t.id !== action.payload.id);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTasks.pending, (state) => { state.status = 'loading'; })
      .addCase(fetchTasks.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload;
      })
      .addCase(fetchTasks.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(createTask.fulfilled, (state, action) => { upsert(state.items, action.payload); })
      .addCase(updateTask.fulfilled, (state, action) => { upsert(state.items, action.payload); })
      .addCase(deleteTask.fulfilled, (state, action) => {
        state.items = state.items.filter((t) => t.id !== action.payload);
      });
  },
});

export const {
  setFilter,
  clearTasks,
  bumpTick,
  setSocketConnected,
  socketTaskCreated,
  socketTaskUpdated,
  socketTaskDeleted,
} = tasksSlice.actions;
export default tasksSlice.reducer;
