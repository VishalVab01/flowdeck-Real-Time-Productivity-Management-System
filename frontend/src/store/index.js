import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import tasksReducer from './tasksSlice';
import insightsReducer from './insightsSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    tasks: tasksReducer,
    insights: insightsReducer,
  },
});

export default store;
