const express = require('express');
const mongoose = require('mongoose');
const Task = require('../models/Task');
const auth = require('../middleware/auth');
const { decorate } = require('../utils/priority');

const router = express.Router();
router.use(auth);

// Format a Date as YYYY-MM-DD in UTC (consistent across server timezones)
const dayKey = (d) => new Date(d).toISOString().slice(0, 10);

// GET /api/insights - dynamically computed productivity stats for current user
router.get('/', async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);
    const now = new Date();

    // Aggregate counts by status
    const statusAgg = await Task.aggregate([
      { $match: { user: userId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const counts = statusAgg.reduce((m, x) => ({ ...m, [x._id]: x.count }), {});
    const total = (counts['Pending'] || 0) + (counts['In Progress'] || 0) + (counts['Completed'] || 0);

    // Compute overdue (deadline passed, not Completed) using priority decorator
    const allTasks = await Task.find({ user: userId });
    const decorated = allTasks.map((d) => decorate(d.toJSON(), now));
    const overdue = decorated.filter((t) => t.priorityLevel === 'Overdue').length;

    // Daily activity for last 14 days: tasks completed per day (by updatedAt when status=Completed)
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const dailyAgg = await Task.aggregate([
      { $match: { user: userId, status: 'Completed', updatedAt: { $gte: fourteenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$updatedAt' } },
          count: { $sum: 1 },
        },
      },
    ]);
    const dailyMap = Object.fromEntries(dailyAgg.map((d) => [d._id, d.count]));

    // Build a contiguous 14-day series (oldest -> newest), filling zeros
    const dailyActivity = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - i);
      const key = dayKey(d);
      dailyActivity.push({ date: key, count: dailyMap[key] || 0 });
    }

    // Today / this week completed counts
    const todayKey = dayKey(now);
    const completedToday = dailyMap[todayKey] || 0;
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const completedThisWeek = await Task.countDocuments({
      user: userId,
      status: 'Completed',
      updatedAt: { $gte: sevenDaysAgo },
    });

    // Category-wise distribution (for ALL tasks)
    const categoryAgg = await Task.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: { $ifNull: ['$category', 'General'] },
          count: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } },
        },
      },
      { $sort: { count: -1 } },
    ]);
    const categoryDistribution = categoryAgg.map((c) => ({
      category: c._id || 'General',
      count: c.count,
      completed: c.completed,
    }));
    const mostActiveCategory = categoryDistribution[0]?.category || null;

    // Completion rate
    const completionRate =
      total > 0 ? Math.round(((counts['Completed'] || 0) / total) * 100) : 0;

    // Human-friendly insight strings
    const insights = [];
    insights.push(
      completedToday === 0
        ? "You haven't completed any tasks today yet. Let's change that."
        : `You completed ${completedToday} task${completedToday === 1 ? '' : 's'} today.`
    );
    if (mostActiveCategory) {
      insights.push(`Most active category: ${mostActiveCategory}.`);
    }
    if (overdue > 0) {
      insights.push(`You have ${overdue} overdue task${overdue === 1 ? '' : 's'} — knock these out first.`);
    }
    insights.push(`Completion rate: ${completionRate}% across ${total} task${total === 1 ? '' : 's'}.`);

    return res.json({
      generatedAt: now.toISOString(),
      totals: {
        total,
        pending: counts['Pending'] || 0,
        inProgress: counts['In Progress'] || 0,
        completed: counts['Completed'] || 0,
        overdue,
      },
      completedToday,
      completedThisWeek,
      completionRate,
      mostActiveCategory,
      dailyActivity,
      categoryDistribution,
      insights,
    });
  } catch (err) {
    console.error('insights error:', err);
    return res.status(500).json({ message: 'Failed to compute insights' });
  }
});

module.exports = router;
