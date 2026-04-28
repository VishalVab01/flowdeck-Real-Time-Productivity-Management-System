import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { registerUser, clearError } from '../store/authSlice';

const Register = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { status, error, token } = useSelector((s) => s.auth);
  const [form, setForm] = useState({ name: '', email: '', password: '' });

  useEffect(() => {
    if (token && status === 'authenticated') navigate('/dashboard', { replace: true });
  }, [token, status, navigate]);

  useEffect(() => () => { dispatch(clearError()); }, [dispatch]);

  const onSubmit = (e) => {
    e.preventDefault();
    dispatch(registerUser(form));
  };

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  return (
    <div className="auth-wrap">
      <div className="auth-card" data-testid="register-card">
        <h1>Create your account</h1>
        <p className="sub">Track tasks, ship faster.</p>
        {error && <div className="error-banner" data-testid="register-error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="name">Name</label>
            <input
              id="name"
              name="name"
              value={form.name}
              onChange={onChange}
              placeholder="Ada Lovelace"
              required
              data-testid="register-name-input"
            />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={onChange}
              placeholder="you@example.com"
              required
              data-testid="register-email-input"
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={onChange}
              placeholder="At least 6 characters"
              required
              minLength={6}
              data-testid="register-password-input"
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={status === 'loading'}
            data-testid="register-submit-btn"
          >
            {status === 'loading' ? <span className="spinner" /> : 'Create account'}
          </button>
        </form>
        <p className="muted-link">
          Already have an account? <Link to="/login" data-testid="goto-login-link">Sign in</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
