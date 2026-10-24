import { Navigate, Outlet } from 'react-router-dom';
import { ChartColumn, ShieldCheck, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import Logo from '../components/Logo.jsx';
import { SkeletonBlock } from '../components/ui.jsx';

const HIGHLIGHTS = [
  [Zap, 'Instant deposits, withdrawals and transfers'],
  [ChartColumn, 'See where your money goes with live charts'],
  [ShieldCheck, 'Every movement recorded in an immutable ledger'],
];

export default function AuthLayout() {
  const { status } = useAuth();
  if (status === 'loading') return <div className="boot"><SkeletonBlock /></div>;
  if (status === 'authenticated') return <Navigate to="/" replace />;

  return (
    <div className="auth-split">
      <aside className="auth-hero">
        <Logo />
        <div>
          <h1>Your money, clear and in control.</h1>
          <ul>
            {HIGHLIGHTS.map(([Icon, text]) => (
              <li key={text}><Icon size={18} /> {text}</li>
            ))}
          </ul>
        </div>
        <p className="small">Simulated wallet. No real money moves.</p>
      </aside>
      <main className="auth-panel">
        <div className="auth-card"><Outlet /></div>
      </main>
    </div>
  );
}
