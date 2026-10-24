import { useMemo, useState } from 'react';
import { ChartPie, CircleCheck, Scale, TrendingDown, TrendingUp } from 'lucide-react';
import { ANALYTICS_LIMIT, usePeriodTransactions, useWalletLedger } from '../hooks/useAnalytics.js';
import { useWallets } from '../hooks/useWallets.js';
import { Alert, Card, EmptyState, LoadState, Skeleton, Tabs } from '../components/ui.jsx';
import CurrencyTabs from '../components/CurrencyTabs.jsx';
import StatCard from '../components/StatCard.jsx';
import BalanceTrendChart from '../components/charts/BalanceTrendChart.jsx';
import BreakdownChart from '../components/charts/BreakdownChart.jsx';
import CashFlowChart from '../components/charts/CashFlowChart.jsx';
import { buildBalanceTrend, buildBreakdown, buildCashFlow, summarize } from '../utils/analytics.js';
import { formatMoney } from '../utils/money.js';

const PERIODS = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
];

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const [selected, setSelected] = useState(null);
  const wallets = useWallets();
  const period = usePeriodTransactions(days);

  const currencies = (wallets.data ?? []).map((wallet) => wallet.currency);
  const currency = currencies.includes(selected) ? selected : currencies[0];
  const wallet = wallets.data?.find((item) => item.currency === currency);
  const ledger = useWalletLedger(wallet?._id);

  const transactions = period.data?.transactions;
  const stats = useMemo(() => (currency && transactions ? summarize(transactions, { days, currency }) : null), [transactions, currency, days]);
  const cashFlow = useMemo(() => (currency && transactions ? buildCashFlow(transactions, { days, currency }) : []), [transactions, currency, days]);
  const breakdown = useMemo(() => (currency && transactions ? buildBreakdown(transactions, { days, currency }) : []), [transactions, currency, days]);
  const trend = useMemo(() => buildBalanceTrend(ledger.data?.entries), [ledger.data]);

  const truncated = (period.data?.pagination?.total ?? 0) > ANALYTICS_LIMIT;
  const hasFlow = cashFlow.some((day) => day.moneyIn || day.moneyOut);

  if (wallets.data?.length === 0) {
    return <Card><EmptyState icon={ChartPie} title="No wallet yet">Create a wallet and make a transaction to see analytics.</EmptyState></Card>;
  }

  return (
    <div className="stack-lg">
      <div className="row between">
        <div>
          <h2 className="greeting">Analytics</h2>
          <p className="muted">Understand how money moves through your wallet.</p>
        </div>
        <div className="row gap">
          <CurrencyTabs currencies={currencies} value={currency} onChange={setSelected} />
          <Tabs options={PERIODS} value={days} onChange={setDays} />
        </div>
      </div>

      {truncated && <Alert kind="success">Charts are based on your latest {ANALYTICS_LIMIT} transactions in this period.</Alert>}

      <div className="stats-grid">
        <StatCard icon={TrendingUp} tone="green" label="Money in" value={stats ? formatMoney(stats.moneyIn, currency) : '...'} />
        <StatCard icon={TrendingDown} tone="violet" label="Money out" value={stats ? formatMoney(stats.moneyOut, currency) : '...'} />
        <StatCard icon={Scale} tone="amber" label="Net flow" value={stats ? `${stats.net >= 0 ? '+' : '-'} ${formatMoney(Math.abs(stats.net), currency)}` : '...'} />
        <StatCard icon={CircleCheck} tone="blue" label="Success rate" value={stats ? (stats.successRate === null ? 'n/a' : `${stats.successRate}%`) : '...'}
          hint={stats ? `${stats.count} transactions` : undefined} />
      </div>

      <Card title="Cash flow" subtitle={`Money in vs out, last ${days} days`}>
        <LoadState loading={period.loading} error={period.error} onRetry={period.reload} hasData={!!period.data} fallback={<Skeleton height={260} radius={14} />}>
          {hasFlow ? <CashFlowChart data={cashFlow} currency={currency} /> : <EmptyState icon={ChartPie} title="No completed transactions in this period" />}
        </LoadState>
      </Card>

      <div className="charts-grid">
        <Card title="Balance over time" subtitle="Latest wallet movements">
          <LoadState loading={ledger.loading} error={ledger.error} onRetry={ledger.reload} hasData={!!ledger.data} fallback={<Skeleton height={260} radius={14} />}>
            {trend.length > 1 ? <BalanceTrendChart data={trend} currency={currency} /> : <EmptyState icon={ChartPie} title="No movements yet" />}
          </LoadState>
        </Card>
        <Card title="Breakdown" subtitle={`Last ${days} days`}>
          <LoadState loading={period.loading} error={period.error} hasData={!!period.data} fallback={<Skeleton height={260} radius={14} />}>
            {breakdown.length > 0 ? <BreakdownChart data={breakdown} currency={currency} /> : <EmptyState icon={ChartPie} title="Nothing to show yet" />}
          </LoadState>
        </Card>
      </div>
    </div>
  );
}
