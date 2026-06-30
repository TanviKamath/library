import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Renders children only if the user has one of the required roles.
 * Otherwise shows a styled Restricted page (not a generic error).
 */
export function RoleGate({ roles, children }) {
  const { role } = useAuth();

  if (!roles.includes(role)) {
    return <Navigate to="/app/restricted" replace />;
  }

  return children;
}
