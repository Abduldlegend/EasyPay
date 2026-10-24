import { NavLink, useNavigate } from 'react-router-dom';
import { ArrowLeftRight, ChartColumn, LayoutDashboard, LogOut, Receipt, Shield, Wallet, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import Avatar from './Avatar.jsx';
import Logo from './Logo.jsx';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/wallets', label: 'Wallets', icon: Wallet },
  { to: '/transfer', label: 'Transfer', icon: ArrowLeftRight },
  { to: '/transactions', label: 'Transactions', icon: Receipt },
  { to: '/analytics', label: 'Analytics', icon: ChartColumn },
];

const ADMIN_ITEMS = [
  { to: '/admin', label: 'Admin overview', icon: Shield, end: true },
  { to: '/admin/transactions', label: 'All transactions', icon: Receipt },
];

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <aside className={`sidebar${open ? ' sidebar-open' : ''}`}>
      <div className="sidebar-head">
        <Logo />
        <button className="icon-btn show-mobile" onClick={onClose} aria-label="Close menu"><X size={20} /></button>
      </div>

      <nav className="sidebar-nav">
        {(user.role === 'admin' ? [...NAV_ITEMS, ...ADMIN_ITEMS] : NAV_ITEMS).map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="nav-item">
            <Icon size={19} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-foot">
        <button className="profile-chip" onClick={() => navigate('/profile')}>
          <Avatar name={user.name} />
          <span className="profile-chip-text">
            <strong>{user.name}</strong>
            <span className="muted small">{user.email}</span>
          </span>
        </button>
        <button className="nav-item nav-logout" onClick={logout}>
          <LogOut size={19} />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  );
}
