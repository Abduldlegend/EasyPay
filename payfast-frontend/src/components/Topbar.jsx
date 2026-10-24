import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, Moon, Sun } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import Avatar from './Avatar.jsx';

const TITLES = [
  ['/wallets/', 'Wallet'], ['/wallets', 'Wallets'], ['/transfer', 'Transfer'],
  ['/transactions/', 'Transaction'], ['/transactions', 'Transactions'],
  ['/analytics', 'Analytics'], ['/admin/transactions/', 'Transaction'], ['/admin/transactions', 'All transactions'], ['/admin', 'Admin'], ['/profile', 'Profile'],
];

const pageTitle = (pathname) => TITLES.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? 'Dashboard';

export default function Topbar({ onMenu }) {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  return (
    <header className="topbar">
      <div className="row gap">
        <button className="icon-btn show-mobile" onClick={onMenu} aria-label="Open menu"><Menu size={22} /></button>
        <h1 className="page-title">{pageTitle(pathname)}</h1>
      </div>
      <div className="row gap">
        <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle dark mode" title="Toggle dark mode">
          {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
        </button>
        <button className="icon-btn avatar-btn" onClick={() => navigate('/profile')} aria-label="Profile">
          <Avatar name={user.name} size={34} />
        </button>
      </div>
    </header>
  );
}
