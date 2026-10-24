import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Hides admin pages from everyone else. This is only a convenience: the API enforces
// the real rule, so a non-admin who reaches this page would just get 403 errors.
export default function AdminRoute() {
    const { user } = useAuth();
    return user?.role === 'admin' ? <Outlet /> : <Navigate to="/" replace />;
}