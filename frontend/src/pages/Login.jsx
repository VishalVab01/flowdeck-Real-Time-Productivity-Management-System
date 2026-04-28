import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { loginUser, clearError } from '../store/authSlice';

const Login = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { status, error, token } = useSelector((s) => s.auth);
  const [form, setForm] = useState({ email: '', password: '' });

  useEffect(() => {
    if (token && status === 'authenticated') navigate('/dashboard', { replace: true });
  }, [token, status, navigate]);

  useEffect(() => () => { dispatch(clearError()); }, [dispatch]);

  const onSubmit = (e) => {
    e.preventDefault();
    dispatch(loginUser(form));
  };

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  return (
    <div className="auth-wrap">
      <div className="auth-card" data-testid="login-card">
        <h1>Welcome back</h1>
        <p className="sub">Sign in to manage your work.</p>
        {error && <div className="error-banner" data-testid="login-error">{error}</div>}
        <form onSubmit={onSubmit}>
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
              data-testid="login-email-input"
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={onChange}
              placeholder="••••••••"
              required
              data-testid="login-password-input"
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={status === 'loading'}
            data-testid="login-submit-btn"
          >
            {status === 'loading' ? <span className="spinner" /> : 'Sign in'}
          </button>
        </form>
        <p className="muted-link">
          New here? <Link to="/register" data-testid="goto-register-link">Create an account</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
