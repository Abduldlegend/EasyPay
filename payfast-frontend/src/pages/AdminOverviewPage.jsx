import { useState } from 'react';
import { Activity, ChartColumn, Receipt, ScrollText, Users, Wallet } from 'lucide-react';
import { getAdminStats, listAuditLogs } from '../api/admin.api.js';
import { useFetch } from '../hooks/useFetch.js';
import { Badge, Card, EmptyState, LoadState, Skeleton } from '../components/ui.jsx';
import CurrencyTabs from '../components/CurrencyTabs.jsx';
import StatCard from '../components/StatCard.jsx';
import AdminVolumeChart from '../components/charts/AdminVolumeChart.jsx';
import { hasVolume, statusShares, trendForCurrency } from '../utils/adminStats.js';
import { formatDateTime } from '../utils/format.js';
import { formatMoney } from '../utils/money.js';

export default function AdminOverviewPage() {
    const stats = useFetch(getAdminStats, []);
    const activity = useFetch(() => listAuditLogs({ limit: 5 }), []);
    const [selected, setSelected] = useState(null);

    const data = stats.data;
    const codes = data?.currencies.map((item) => item.currency) ?? [];
    const currency = codes.includes(selected) ? selected : codes[0];
    const money = data?.currencies.find((item) => item.currency === currency);
    const series = trendForCurrency(data?.trend, currency);
    const shares = statusShares(data?.transactions.byStatus);

    return (
        <div className="stack-lg">
            <div className="row between">
                <div>
                    <h2 className="greeting">Admin overview</h2>
                    <p className="muted">Platform activity at a glance.</p>
                </div>
                <CurrencyTabs currencies={codes} value={currency} onChange={setSelected} />
            </div>

            <LoadState loading={stats.loading} error={stats.error} onRetry={stats.reload} hasData={!!data}
                fallback={<Skeleton height={110} radius={20} />}>
                {data && (
                    <>
                        <div className="stats-grid">
                            <StatCard icon={Users} tone="violet" label="Users" value={data.users.total}
                                hint={`${data.users.newLast7Days} new this week · ${data.users.disabled} disabled`} />
                            <StatCard icon={Wallet} tone="blue" label="Wallets" value={data.wallets.total}
                                hint={`${data.wallets.byStatus.frozen} frozen · ${data.wallets.byStatus.closed} closed`} />
                            <StatCard icon={Receipt} tone="amber" label="Transactions" value={data.transactions.total}
                                hint={`${data.transactions.byStatus.failed} failed · ${data.transactions.byStatus.pending} pending`} />
                            <StatCard icon={Activity} tone="green" label={`Held in ${currency} wallets`}
                                value={formatMoney(money?.totalBalance ?? 0, currency)} hint={`${money?.wallets ?? 0} wallets`} />
                        </div>

                        <div className="charts-grid">
                            <Card title="Completed volume" subtitle={`Last ${series.length} days, ${currency}`}>
                                {hasVolume(series) ? (
                                    <AdminVolumeChart data={series} currency={currency} />
                                ) : (
                                    <EmptyState icon={ChartColumn} title="No completed transactions yet">
                                        Volume appears here once users deposit, withdraw or transfer.
                                    </EmptyState>
                                )}
                            </Card>

                            <Card title="Transaction outcomes" subtitle="All time">
                                {shares.length === 0 ? (
                                    <EmptyState icon={Receipt} title="Nothing yet" />
                                ) : (
                                    <div className="stack">
                                        {shares.map(({ status, count, percent }) => (
                                            <div key={status} className="row between">
                                                <Badge value={status} />
                                                <span className="muted">{count} ({percent}%)</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="stack" style={{ marginTop: 16 }}>
                                    {Object.entries(money?.volumeByType ?? {}).map(([type, { count, volume }]) => (
                                        <div key={type} className="row between">
                                            <span className="muted" style={{ textTransform: 'capitalize' }}>{type}s ({count})</span>
                                            <strong>{formatMoney(volume, currency)}</strong>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        </div>
                    </>
                )}
            </LoadState>

            <Card title="Recent admin activity" subtitle="Every admin action is recorded and cannot be edited.">
                <LoadState loading={activity.loading} error={activity.error} onRetry={activity.reload} hasData={!!activity.data}>
                    {activity.data?.auditLogs.length === 0 ? (
                        <EmptyState icon={ScrollText} title="No admin activity yet">
                            Actions such as freezing a wallet or disabling a user will appear here.
                        </EmptyState>
                    ) : (
                        <div className="table-wrap">
                            <table className="table">
                                <thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Reason</th></tr></thead>
                                <tbody>
                                    {activity.data?.auditLogs.map((entry) => (
                                        <tr key={entry._id}>
                                            <td>{formatDateTime(entry.createdAt)}</td>
                                            <td>{entry.actor?.name ?? 'Unknown'}</td>
                                            <td><code>{entry.action}</code></td>
                                            <td>{entry.reason ?? '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </LoadState>
            </Card>
        </div>
    );
}