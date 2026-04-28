import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

const ProtectedRoute = ({ children }) => {
  const { token, status } = useSelector((s) => s.auth);

  if (status === 'checking') {
    return (
      <div className="center-loading" data-testid="auth-checking">
        <div className="spinner" />
      </div>
    );
  }
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

export default ProtectedRoute;
