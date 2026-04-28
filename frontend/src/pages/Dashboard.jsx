import { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchTasks,
  setFilter,
  bumpTick,
} from '../store/tasksSlice';
import { decorate, sortByPriority } from '../utils/priority';
import TaskForm from '../components/TaskForm';
import TaskItem from '../components/TaskItem';

const FILTERS = ['All', 'Pending', 'In Progress', 'Completed'];

const Dashboard = () => {
  const dispatch = useDispatch();
  const { items, status, filter, error, tick, socketConnected } = useSelector((s) => s.tasks);
  const user = useSelector((s) => s.auth.user);

  // Initial fetch (socket lifecycle is owned by App.js so it survives route changes)
  useEffect(() => {
    dispatch(fetchTasks());
  }, [dispatch]);

  // Dynamic priority recalculation — bumps tick every 30s, no manual refresh
  useEffect(() => {
    const id = setInterval(() => dispatch(bumpTick()), 30000);
    return () => clearInterval(id);
  }, [dispatch]);

  // Recompute priority client-side every render (cheap) and re-sort.
  // `tick` is included as a dep so the memo re-runs every 30s automatically.
  const prioritized = useMemo(() => {
    const now = new Date();
    const decorated = items.map((t) => decorate(t, now));
    return sortByPriority(decorated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, tick]);

  const filtered = useMemo(() => {
    if (filter === 'All') return prioritized;
    return prioritized.filter((t) => t.status === filter);
  }, [prioritized, filter]);

  const stats = useMemo(() => {
    const total = items.length;
    const pending = items.filter((t) => t.status === 'Pending').length;
    const progress = items.filter((t) => t.status === 'In Progress').length;
    const completed = items.filter((t) => t.status === 'Completed').length;
    const overdue = prioritized.filter((t) => t.priorityLevel === 'Overdue').length;
    return { total, pending, progress, completed, overdue };
  }, [items, prioritized]);

  return (
    <div className="container" data-testid="dashboard-container">
      <div className="dash-header">
        <div className="dash-title">
          <h1 data-testid="dashboard-greeting">
            Hi, {user?.name?.split(' ')[0] || 'there'}.
          </h1>
          <p>Your tasks, sorted by what's most urgent.</p>
        </div>
        <div className="live-indicator" data-testid="socket-status">
          <span className={`live-dot ${socketConnected ? 'on' : 'off'}`} />
          <span className="mono">{socketConnected ? 'live' : 'offline'}</span>
        </div>
      </div>

      <div className="stats" data-testid="stats-grid">
        <div className="stat" data-testid="stat-total">
          <div className="label">Total</div>
          <div className="value">{stats.total}</div>
        </div>
        <div className="stat danger" data-testid="stat-overdue">
          <div className="label">Overdue</div>
          <div className="value">{stats.overdue}</div>
        </div>
        <div className="stat warn" data-testid="stat-pending">
          <div className="label">Pending</div>
          <div className="value">{stats.pending}</div>
        </div>
        <div className="stat accent" data-testid="stat-in-progress">
          <div className="label">In Progress</div>
          <div className="value">{stats.progress}</div>
        </div>
        <div className="stat ok" data-testid="stat-completed">
          <div className="label">Completed</div>
          <div className="value">{stats.completed}</div>
        </div>
      </div>

      <div className="grid-2">
        <TaskForm />

        <div>
          <div className="filters" data-testid="task-filters">
            {FILTERS.map((f) => (
              <button
                key={f}
                className={`chip ${filter === f ? 'active' : ''}`}
                onClick={() => dispatch(setFilter(f))}
                data-testid={`filter-${f.replace(' ', '-')}`}
              >
                {f}
              </button>
            ))}
          </div>

          {error && <div className="error-banner" data-testid="tasks-error">{error}</div>}

          {status === 'loading' && items.length === 0 ? (
            <div className="empty" data-testid="tasks-loading">Loading tasks...</div>
          ) : filtered.length === 0 ? (
            <div className="empty" data-testid="tasks-empty">
              {items.length === 0
                ? 'No tasks yet. Create your first one →'
                : `No "${filter}" tasks.`}
            </div>
          ) : (
            <div className="task-list" data-testid="task-list">
              {filtered.map((t) => (
                <TaskItem key={t.id} task={t} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
