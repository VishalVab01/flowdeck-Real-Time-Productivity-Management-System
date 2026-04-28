import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, NavLink } from 'react-router-dom';
import { logout } from '../store/authSlice';
import { clearTasks } from '../store/tasksSlice';
import { clearInsights } from '../store/insightsSlice';

const Navbar = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((s) => s.auth.user);

  const onLogout = () => {
    dispatch(logout()); // App.js's effect on token=null will disconnect the socket
    dispatch(clearTasks());
    dispatch(clearInsights());
    navigate('/login');
  };

  return (
    <nav className="navbar" data-testid="navbar">
      <div className="navbar-inner">
        <div className="brand-area">
          <div className="brand" data-testid="brand">
            <span className="brand-dot" />
            <span>flowdeck<span style={{ color: 'var(--text-muted)' }}>/</span><span className="mono" style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>tasks</span></span>
          </div>
          {user && (
            <div className="nav-tabs">
              <NavLink to="/dashboard" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`} data-testid="nav-dashboard">
                Tasks
              </NavLink>
              <NavLink to="/insights" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`} data-testid="nav-insights">
                Insights
              </NavLink>
            </div>
          )}
        </div>
        {user && (
          <div className="nav-user">
            <span data-testid="nav-user-email" className="mono">{user.email}</span>
            <button className="btn btn-ghost btn-sm" onClick={onLogout} data-testid="logout-btn">
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
