import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Sidebar from '../components/Sidebar.jsx';
import Topbar from '../components/Topbar.jsx';
import { SkeletonBlock } from '../components/ui.jsx';

export default function AppLayout() {
  const { status } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  if (status === 'loading') return <div className="boot"><SkeletonBlock /></div>;
  if (status !== 'authenticated') return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  return (
    <div className="shell">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}
      <div className="main">
        <Topbar onMenu={() => setMenuOpen(true)} />
        <main className="content"><Outlet /></main>
      </div>
    </div>
  );
}
