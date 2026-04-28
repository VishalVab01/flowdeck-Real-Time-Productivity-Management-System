const express = require('express');
const Task = require('../models/Task');
const auth = require('../middleware/auth');
const { decorate, sortByPriority } = require('../utils/priority');

const ALLOWED_STATUSES = ['Pending', 'In Progress', 'Completed'];

// Factory that injects the Socket.io instance so routes can broadcast events
// to the owner's room (`user:<userId>`) on every mutation.
module.exports = function buildTaskRoutes(io) {
  const router = express.Router();
  router.use(auth);

  const emit = (userId, event, payload) => {
    if (io && userId) io.to(`user:${userId.toString()}`).emit(event, payload);
  };

  // GET /api/tasks  -> sorted by priority desc, then createdAt asc
  router.get('/', async (req, res) => {
    try {
      const docs = await Task.find({ user: req.user._id });
      const decorated = docs.map((d) => decorate(d.toJSON()));
      const sorted = sortByPriority(decorated);
      return res.json({ tasks: sorted });
    } catch (err) {
      return res.status(500).json({ message: 'Failed to fetch tasks' });
    }
  });

  // POST /api/tasks
  router.post('/', async (req, res) => {
    try {
      const { title, description, category, status, deadline } = req.body || {};
      if (!title || !title.trim()) {
        return res.status(400).json({ message: 'Title is required' });
      }
      if (status && !ALLOWED_STATUSES.includes(status)) {
        return res.status(400).json({ message: 'Invalid status value' });
      }
      const task = await Task.create({
        user: req.user._id,
        title: title.trim(),
        description: (description || '').trim(),
        category: (category || 'General').trim(),
        status: status || 'Pending',
        deadline: deadline ? new Date(deadline) : null,
      });
      const payload = decorate(task.toJSON());
      emit(req.user._id, 'task:created', payload);
      return res.status(201).json({ task: payload });
    } catch (err) {
      console.error('create task error:', err);
      return res.status(500).json({ message: 'Failed to create task' });
    }
  });

  // PUT /api/tasks/:id
  router.put('/:id', async (req, res) => {
    try {
      const { title, description, category, status, deadline } = req.body || {};
      const update = {};
      if (title !== undefined) update.title = String(title).trim();
      if (description !== undefined) update.description = String(description).trim();
      if (category !== undefined) update.category = String(category).trim();
      if (status !== undefined) {
        if (!ALLOWED_STATUSES.includes(status)) {
          return res.status(400).json({ message: 'Invalid status value' });
        }
        update.status = status;
      }
      if (deadline !== undefined) update.deadline = deadline ? new Date(deadline) : null;

      const task = await Task.findOneAndUpdate(
        { _id: req.params.id, user: req.user._id },
        { $set: update },
        { new: true }
      );
      if (!task) return res.status(404).json({ message: 'Task not found' });
      const payload = decorate(task.toJSON());
      emit(req.user._id, 'task:updated', payload);
      return res.json({ task: payload });
    } catch (err) {
      if (err.name === 'CastError') return res.status(400).json({ message: 'Invalid task id' });
      return res.status(500).json({ message: 'Failed to update task' });
    }
  });

  // DELETE /api/tasks/:id
  router.delete('/:id', async (req, res) => {
    try {
      const task = await Task.findOneAndDelete({ _id: req.params.id, user: req.user._id });
      if (!task) return res.status(404).json({ message: 'Task not found' });
      const id = task._id.toString();
      emit(req.user._id, 'task:deleted', { id });
      return res.json({ ok: true, id });
    } catch (err) {
      if (err.name === 'CastError') return res.status(400).json({ message: 'Invalid task id' });
      return res.status(500).json({ message: 'Failed to delete task' });
    }
  });

  return router;
};
