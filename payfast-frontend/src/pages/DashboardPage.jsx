import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ChartPie, CircleCheck, Receipt, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { listTransactions } from '../api/transactions.api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useFetch } from '../hooks/useFetch.js';
import { usePeriodTransactions } from '../hooks/useAnalytics.js';
import { useWallets } from '../hooks/useWallets.js';
import { Card, EmptyState, LoadState, Skeleton } from '../components/ui.jsx';
import CreateWalletButtons from '../components/CreateWalletButtons.jsx';
import CurrencyTabs from '../components/CurrencyTabs.jsx';
import StatCard from '../components/StatCard.jsx';
import TransactionTable from '../components/TransactionTable.jsx';
import WalletCard from '../components/WalletCard.jsx';
import BreakdownChart from '../components/charts/BreakdownChart.jsx';
import CashFlowChart from '../components/charts/CashFlowChart.jsx';
import { buildBreakdown, buildCashFlow, summarize } from '../utils/analytics.js';
import { formatMoney } from '../utils/money.js';

const greeting = () => {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
};

export default function DashboardPage() {
  const { user } = useAuth();
  const wallets = useWallets();
  const period = usePeriodTransactions(30);
  const recent = useFetch(() => listTransactions({ limit: 6 }), []);
  const [selected, setSelected] = useState(null);

  const currencies = (wallets.data ?? []).map((wallet) => wallet.currency);
  const currency = currencies.includes(selected) ? selected : currencies[0];
  const wallet = wallets.data?.find((item) => item.currency === currency);

  const transactions = period.data?.transactions;
  const stats = useMemo(() => (currency && transactions ? summarize(transactions, { days: 30, currency }) : null), [transactions, currency]);
  const cashFlow = useMemo(() => (currency && transactions ? buildCashFlow(transactions, { days: 7, currency }) : []), [transactions, currency]);
  const breakdown = useMemo(() => (currency && transactions ? buildBreakdown(transactions, { days: 30, currency }) : []), [transactions, currency]);

  const hasFlow = cashFlow.some((day) => day.moneyIn || day.moneyOut);

  return (
    <div className="stack-lg">
      <div className="row between">
        <div>
          <h2 className="greeting">{greeting()}, {user.name.split(' ')[0]}</h2>
          <p className="muted">Here is what is happening with your money.</p>
        </div>
        <CurrencyTabs currencies={currencies} value={currency} onChange={setSelected} />
      </div>

      <LoadState loading={wallets.loading} error={wallets.error} onRetry={wallets.reload} hasData={!!wallets.data}
        fallback={<Skeleton height={190} radius={20} />}>
        {wallets.data?.length === 0 ? (
          <Card>
            <EmptyState icon={Wallet} title="Create your first wallet">
              A wallet holds your balance in one currency. Pick one to get started.
            </EmptyState>
            <div className="center-row"><CreateWalletButtons existingCurrencies={[]} onCreated={wallets.reload} /></div>
          </Card>
        ) : wallet && (
          <div className="dash-top">
            <WalletCard wallet={wallet} />
            <Card title="Quick actions">
              <div className="quick-grid">
                <Link to={`/wallets/${wallet._id}/deposit`} className="quick"><ArrowDownLeft size={20} />Deposit</Link>
                <Link to={`/wallets/${wallet._id}/withdraw`} className="quick"><ArrowUpRight size={20} />Withdraw</Link>
                <Link to={`/transfer?from=${wallet._id}`} className="quick"><ArrowLeftRight size={20} />Transfer</Link>
                <Link to="/transactions" className="quick"><Receipt size={20} />History</Link>
              </div>
            </Card>
          </div>
        )}
      </LoadState>

      {wallet && (
        <>
          <div className="stats-grid">
            <StatCard icon={TrendingUp} tone="green" label="Money in (30 days)" value={stats ? formatMoney(stats.moneyIn, currency) : '...'} />
            <StatCard icon={TrendingDown} tone="violet" label="Money out (30 days)" value={stats ? formatMoney(stats.moneyOut, currency) : '...'} />
            <StatCard icon={Activity} tone="amber" label="Transactions (30 days)" value={stats ? stats.count : '...'} />
            <StatCard icon={CircleCheck} tone="blue" label="Success rate" value={stats ? (stats.successRate === null ? 'n/a' : `${stats.successRate}%`) : '...'} />
          </div>

          <div className="charts-grid">
            <Card title="Cash flow" subtitle="Last 7 days">
              <LoadState loading={period.loading} error={period.error} onRetry={period.reload} hasData={!!period.data} fallback={<Skeleton height={260} radius={14} />}>
                {hasFlow ? <CashFlowChart data={cashFlow} currency={currency} /> : <EmptyState icon={ChartPie} title="No activity this week">Make a deposit or transfer to see your cash flow.</EmptyState>}
              </LoadState>
            </Card>
            <Card title="Where it went" subtitle="Last 30 days">
              <LoadState loading={period.loading} error={period.error} hasData={!!period.data} fallback={<Skeleton height={260} radius={14} />}>
                {breakdown.length > 0 ? <BreakdownChart data={breakdown} currency={currency} /> : <EmptyState icon={ChartPie} title="Nothing to show yet" />}
              </LoadState>
            </Card>
          </div>
        </>
      )}

      <Card title="Recent activity" action={<Link to="/transactions">View all</Link>}>
        <LoadState loading={recent.loading} error={recent.error} onRetry={recent.reload} hasData={!!recent.data}>
          {recent.data && <TransactionTable transactions={recent.data.transactions} />}
        </LoadState>
      </Card>
    </div>
  );
}
