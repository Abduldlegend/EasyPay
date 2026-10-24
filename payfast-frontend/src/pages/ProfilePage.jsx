import { LogOut, Moon, ShieldCheck, Sun } from 'lucide-react';
import { listTransactions } from '../api/transactions.api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useFetch } from '../hooks/useFetch.js';
import { useWallets } from '../hooks/useWallets.js';
import Avatar from '../components/Avatar.jsx';
import { Badge, Button, Card, CopyButton, Tabs } from '../components/ui.jsx';
import { formatDateTime } from '../utils/format.js';

const Row = ({ label, children }) => (
  <div className="profile-row"><span className="muted">{label}</span><span>{children}</span></div>
);

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const wallets = useWallets();
  const activity = useFetch(() => listTransactions({ limit: 1 }), []);

  return (
    <div className="stack-lg">
      <Card className="profile-hero">
        <Avatar name={user.name} size={72} />
        <div>
          <h2 className="greeting">{user.name}</h2>
          <p className="muted">{user.email}</p>
          <Badge value={user.role} />
        </div>
      </Card>

      <div className="charts-grid">
        <Card title="Account">
          <Row label="Full name">{user.name}</Row>
          <Row label="Email">{user.email}</Row>
          <Row label="Role">{user.role}</Row>
          <Row label="Member since">{formatDateTime(user.createdAt)}</Row>
          <Row label="User ID"><code>{user._id}</code> <CopyButton text={user._id} label="" /></Row>
        </Card>

        <Card title="Activity">
          <Row label="Wallets">{wallets.data ? wallets.data.length : '...'}</Row>
          <Row label="Total transactions">{activity.data ? activity.data.pagination.total : '...'}</Row>
          {wallets.data?.map((wallet) => (
            <Row key={wallet._id} label={`${wallet.currency} wallet`}><code>{wallet.reference}</code> <CopyButton text={wallet.reference} label="" /></Row>
          ))}
        </Card>
      </div>

      <div className="charts-grid">
        <Card title="Appearance" subtitle="Saved on this device">
          <Tabs value={theme} onChange={setTheme}
            options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
          <p className="muted small spaced">{theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />} Using the {theme} theme.</p>
        </Card>

        <Card title="Security">
          <p className="muted small"><ShieldCheck size={14} /> You are signed in with a secure session token that expires automatically.
            Changing your name, email or password is not available yet.</p>
          <div className="spaced"><Button variant="secondary" onClick={logout}><LogOut size={16} /> Log out</Button></div>
        </Card>
      </div>
    </div>
  );
}
