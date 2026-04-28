import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../api/client';

export const fetchInsights = createAsyncThunk(
  'insights/fetch',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/insights');
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load insights');
    }
  }
);

const insightsSlice = createSlice({
  name: 'insights',
  initialState: {
    data: null,
    status: 'idle',
    error: null,
  },
  reducers: {
    clearInsights(state) {
      state.data = null;
      state.status = 'idle';
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchInsights.pending, (state) => {
        state.status = state.data ? 'refreshing' : 'loading';
      })
      .addCase(fetchInsights.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.data = action.payload;
      })
      .addCase(fetchInsights.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      });
  },
});

export const { clearInsights } = insightsSlice.actions;
export default insightsSlice.reducer;
