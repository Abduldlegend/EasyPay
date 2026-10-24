import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getWallet, getWalletLedger } from '../api/wallets.api.js';
import { listTransactions } from '../api/transactions.api.js';
import { useFetch } from '../hooks/useFetch.js';
import { useWalletLedger } from '../hooks/useAnalytics.js';
import { Card, EmptyState, LoadState, Pagination, Skeleton, Tabs } from '../components/ui.jsx';
import BalanceTrendChart from '../components/charts/BalanceTrendChart.jsx';
import TransactionTable from '../components/TransactionTable.jsx';
import WalletCard from '../components/WalletCard.jsx';
import { buildBalanceTrend } from '../utils/analytics.js';
import { formatDateTime } from '../utils/format.js';
import { formatMoney } from '../utils/money.js';

function LedgerTable({ entries, currency }) {
  if (entries.length === 0) return <EmptyState title="No ledger entries yet" />;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr><th>Date</th><th>Movement</th><th className="right">Amount</th><th className="right">Balance after</th></tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry._id}>
              <td className="nowrap">{formatDateTime(entry.createdAt)}</td>
              <td>{entry.direction === 'credit' ? 'Money in' : 'Money out'}</td>
              <td className={`right nowrap amount-${entry.direction === 'credit' ? 'in' : 'out'}`}>
                {entry.direction === 'credit' ? '+' : '-'} {formatMoney(entry.amount, currency)}
              </td>
              <td className="right nowrap">{formatMoney(entry.balanceAfter, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function WalletDetailPage() {
  const { walletId } = useParams();
  const [tab, setTab] = useState('transactions');
  const [page, setPage] = useState(1);

  const wallet = useFetch(() => getWallet(walletId), [walletId]);
  const history = useFetch(
    () => (tab === 'ledger' ? getWalletLedger(walletId, { page, limit: 10 }) : listTransactions({ walletId, page, limit: 10 })),
    [walletId, tab, page]
  );
  const trendLedger = useWalletLedger(walletId);
  const trend = useMemo(() => buildBalanceTrend(trendLedger.data?.entries), [trendLedger.data]);

  const switchTab = (next) => {
    setTab(next);
    setPage(1);
  };

  return (
    <div className="stack-lg">
      <Link to="/wallets" className="back-link"><ArrowLeft size={16} /> All wallets</Link>

      <LoadState loading={wallet.loading} error={wallet.error} onRetry={wallet.reload} hasData={!!wallet.data}
        fallback={<Skeleton height={190} radius={20} />}>
        {wallet.data && <WalletCard wallet={wallet.data} detailsLink={false} />}
      </LoadState>

      {trendLedger.loading && !trendLedger.data && <Skeleton height={200} radius={14} />}
      {trend.length > 1 && wallet.data && (
        <Card title="Balance over time" subtitle="Latest wallet movements">
          <BalanceTrendChart data={trend} currency={wallet.data.currency} />
        </Card>
      )}

      <Card
        title="Activity"
        action={
          <Tabs
            value={tab}
            onChange={switchTab}
            options={[{ value: 'transactions', label: 'Transactions' }, { value: 'ledger', label: 'Ledger' }]}
          />
        }
      >
        <LoadState loading={history.loading} error={history.error} onRetry={history.reload} hasData={!!history.data}>
          {history.data && (tab === 'ledger'
            ? <LedgerTable entries={history.data.entries} currency={wallet.data?.currency} />
            : <TransactionTable transactions={history.data.transactions} />)}
          <Pagination pagination={history.data?.pagination} onChange={setPage} />
        </LoadState>
      </Card>
    </div>
  );
}
