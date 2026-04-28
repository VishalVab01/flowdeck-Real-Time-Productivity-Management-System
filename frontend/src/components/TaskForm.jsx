import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { createTask } from '../store/tasksSlice';

const initialState = {
  title: '',
  description: '',
  category: 'General',
  status: 'Pending',
  deadline: '',
};

const TaskForm = () => {
  const dispatch = useDispatch();
  const [form, setForm] = useState(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const onChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('Title is required');
      return;
    }
    setSubmitting(true);
    setError(null);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category.trim() || 'General',
      status: form.status,
      deadline: form.deadline || null,
    };
    const result = await dispatch(createTask(payload));
    setSubmitting(false);
    if (result.meta.requestStatus === 'fulfilled') {
      setForm(initialState);
    } else {
      setError(result.payload || 'Failed to create task');
    }
  };

  return (
    <div className="card" data-testid="task-form-card">
      <h3>New task</h3>
      {error && <div className="error-banner" data-testid="task-form-error">{error}</div>}
      <form onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="title">Title</label>
          <input
            id="title"
            name="title"
            value={form.title}
            onChange={onChange}
            placeholder="Ship landing page"
            data-testid="task-title-input"
          />
        </div>
        <div className="field">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            value={form.description}
            onChange={onChange}
            placeholder="Optional details..."
            data-testid="task-description-input"
          />
        </div>
        <div className="row-2">
          <div className="field">
            <label htmlFor="category">Category</label>
            <input
              id="category"
              name="category"
              value={form.category}
              onChange={onChange}
              placeholder="Work / Personal / ..."
              data-testid="task-category-input"
            />
          </div>
          <div className="field">
            <label htmlFor="status">Status</label>
            <select id="status" name="status" value={form.status} onChange={onChange} data-testid="task-status-select">
              <option>Pending</option>
              <option>In Progress</option>
              <option>Completed</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="deadline">Deadline</label>
          <input
            id="deadline"
            type="date"
            name="deadline"
            value={form.deadline}
            onChange={onChange}
            data-testid="task-deadline-input"
          />
        </div>
        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={submitting}
          data-testid="task-create-submit"
        >
          {submitting ? <span className="spinner" /> : 'Create task'}
        </button>
      </form>
    </div>
  );
};

export default TaskForm;
