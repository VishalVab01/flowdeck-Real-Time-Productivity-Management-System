import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { fetchInsights } from '../store/insightsSlice';

const COLORS = ['#c8ff4d', '#ff6b3d', '#6bc3ff', '#ffb347', '#ff5470', '#6cf0a3', '#a78bff'];

const formatShortDate = (key) => {
  const d = new Date(key + 'T00:00:00Z');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const Insights = () => {
  const dispatch = useDispatch();
  const { data, status, error } = useSelector((s) => s.insights);
  const socketConnected = useSelector((s) => s.tasks.socketConnected);
  // Re-fetch insights whenever the user's tasks change (socket-driven realtime).
  const tasksLen = useSelector((s) => s.tasks.items.length);
  const tasksUpdatedAt = useSelector((s) =>
    s.tasks.items.map((t) => `${t.id}:${t.status}`).join('|')
  );

  useEffect(() => {
    dispatch(fetchInsights());
  }, [dispatch, tasksLen, tasksUpdatedAt]);

  if (status === 'loading' && !data) {
    return (
      <div className="container">
        <div className="empty" data-testid="insights-loading">Loading insights…</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container">
        {error && <div className="error-banner" data-testid="insights-error">{error}</div>}
      </div>
    );
  }

  const { totals, completedToday, completedThisWeek, completionRate, mostActiveCategory,
    dailyActivity, categoryDistribution, insights } = data;

  const chartData = dailyActivity.map((d) => ({ ...d, label: formatShortDate(d.date) }));

  return (
    <div className="container" data-testid="insights-page">
      <div className="dash-header">
        <div className="dash-title">
          <h1>Insights.</h1>
          <p>Live productivity stats — updates the moment a task changes.</p>
        </div>
        <div className="live-indicator" data-testid="insights-socket-status">
          <span className={`live-dot ${socketConnected ? 'on' : 'off'}`} />
          <span className="mono">
            {!socketConnected ? 'offline' : status === 'refreshing' ? 'refreshing' : 'live'}
          </span>
        </div>
      </div>

      {/* Insight strings */}
      <div className="insight-strip" data-testid="insight-strip">
        {insights.map((line, i) => (
          <div key={i} className="insight-line" data-testid={`insight-line-${i}`}>
            <span className="insight-marker" />
            {line}
          </div>
        ))}
      </div>

      {/* Stat cards */}
      <div className="stats" data-testid="insights-stats">
        <div className="stat" data-testid="ins-stat-total">
          <div className="label">Total</div>
          <div className="value">{totals.total}</div>
        </div>
        <div className="stat ok" data-testid="ins-stat-completed">
          <div className="label">Completed</div>
          <div className="value">{totals.completed}</div>
        </div>
        <div className="stat warn" data-testid="ins-stat-pending">
          <div className="label">Pending</div>
          <div className="value">{totals.pending}</div>
        </div>
        <div className="stat accent" data-testid="ins-stat-today">
          <div className="label">Done today</div>
          <div className="value">{completedToday}</div>
        </div>
        <div className="stat" data-testid="ins-stat-rate">
          <div className="label">Completion %</div>
          <div className="value">{completionRate}%</div>
        </div>
      </div>

      {/* Highlights */}
      <div className="highlight-row" data-testid="highlight-row">
        <div className="highlight">
          <div className="hl-label">This week</div>
          <div className="hl-value mono">{completedThisWeek} completed</div>
        </div>
        <div className="highlight">
          <div className="hl-label">Most active category</div>
          <div className="hl-value mono">
            {mostActiveCategory ? `#${mostActiveCategory}` : '—'}
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="charts">
        <div className="card chart-card" data-testid="daily-activity-card">
          <h3>Daily activity (last 14 days)</h3>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -16, bottom: 0 }}>
                <XAxis dataKey="label" stroke="#61616e" fontSize={11} tickLine={false} />
                <YAxis stroke="#61616e" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#18181d', border: '1px solid #2a2a35', borderRadius: 8, fontSize: 13 }}
                  itemStyle={{ color: '#ededf0' }}
                  cursor={{ fill: 'rgba(200,255,77,0.06)' }}
                />
                <Bar dataKey="count" fill="#c8ff4d" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card chart-card" data-testid="category-distribution-card">
          <h3>Category distribution</h3>
          {categoryDistribution.length === 0 ? (
            <div className="empty">No tasks yet</div>
          ) : (
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={categoryDistribution}
                    dataKey="count"
                    nameKey="category"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={2}
                    stroke="#0a0a0b"
                  >
                    {categoryDistribution.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#18181d', border: '1px solid #2a2a35', borderRadius: 8, fontSize: 13 }}
                    itemStyle={{ color: '#ededf0' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#9a9aa6' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Insights;
