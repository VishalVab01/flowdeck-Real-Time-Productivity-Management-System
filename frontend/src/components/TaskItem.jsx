import { useDispatch } from 'react-redux';
import { updateTask, deleteTask } from '../store/tasksSlice';

const STATUS_OPTIONS = ['Pending', 'In Progress', 'Completed'];

const formatDate = (d) => {
  if (!d) return null;
  try {
    return new Date(d).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch { return null; }
};

const statusClass = (s) => `pill status-${s.replace(' ', '-')}`;
const priorityClass = (level) => `pill priority-${level}`;

// Friendly time-to-deadline string
const formatRelative = (deadline) => {
  if (!deadline) return null;
  const ms = new Date(deadline).getTime() - Date.now();
  const min = Math.round(ms / 60000);
  const abs = Math.abs(min);
  if (abs < 60) return min < 0 ? `${abs}m overdue` : `in ${abs}m`;
  const h = Math.round(abs / 60);
  if (h < 48) return min < 0 ? `${h}h overdue` : `in ${h}h`;
  const d = Math.round(h / 24);
  return min < 0 ? `${d}d overdue` : `in ${d}d`;
};

const TaskItem = ({ task }) => {
  const dispatch = useDispatch();

  const onStatusChange = (e) => {
    dispatch(updateTask({ id: task.id, updates: { status: e.target.value } }));
  };

  const onDelete = () => {
    if (window.confirm(`Delete "${task.title}"?`)) {
      dispatch(deleteTask(task.id));
    }
  };

  const created = formatDate(task.createdAt);
  const deadline = formatDate(task.deadline);
  const relative = formatRelative(task.deadline);
  const wrapperClass = `task task-${task.priorityLevel || 'Low'}`;

  return (
    <article className={wrapperClass} data-testid={`task-item-${task.id}`}>
      <div>
        <div className="task-head">
          <h4 className="title" data-testid="task-title">{task.title}</h4>
          <span
            className={priorityClass(task.priorityLevel)}
            data-testid="task-priority-pill"
            title={`Priority score: ${task.priorityScore}`}
          >
            {task.priorityLevel} · {task.priorityScore}
          </span>
        </div>
        {task.description && <p className="desc" data-testid="task-description">{task.description}</p>}
        <div className="meta">
          <span className={statusClass(task.status)} data-testid="task-status-pill">{task.status}</span>
          {task.category && <span className="pill" data-testid="task-category-pill">#{task.category}</span>}
          {created && <span className="mono" data-testid="task-created">created {created}</span>}
          {deadline && (
            <span
              className={`mono ${task.priorityLevel === 'Overdue' ? 'text-danger' : ''}`}
              data-testid="task-deadline"
            >
              due {deadline}{relative ? ` (${relative})` : ''}
            </span>
          )}
        </div>
      </div>
      <div className="task-actions">
        <select
          value={task.status}
          onChange={onStatusChange}
          data-testid={`task-status-update-${task.id}`}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button
          className="btn btn-danger btn-sm"
          onClick={onDelete}
          data-testid={`task-delete-${task.id}`}
        >
          Delete
        </button>
      </div>
    </article>
  );
};

export default TaskItem;
