import { ArrowLeft, CircleAlert, CircleCheck } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { getAdminTransaction } from '../api/admin.api.js';
import { useFetch } from '../hooks/useFetch.js';
import { Alert, Badge, Card, LoadState } from '../components/ui.jsx';
import { ledgerVerdict, partyName } from '../utils/adminTransactions.js';
import { formatDateTime, titleCase } from '../utils/format.js';
import { formatMoney } from '../utils/money.js';

const Party = ({ wallet }) => (
    <>
        {partyName(wallet)}
        {wallet?.type !== 'system' && wallet?.owner?.email && <span className="muted small"> · {wallet.owner.email}</span>}
        {wallet?.reference && <span className="muted small"> · <code>{wallet.reference}</code></span>}
    </>
);

export default function AdminTransactionDetailPage() {
    const { reference } = useParams();
    const result = useFetch(() => getAdminTransaction(reference), [reference]);

    return (
        <div className="narrow stack">
            <Link to="/admin/transactions" className="back-link"><ArrowLeft size={16} /> All transactions</Link>
            <h1>Transaction</h1>
            <LoadState loading={result.loading} error={result.error} onRetry={result.reload} hasData={!!result.data}>
                {result.data && (() => {
                    const { transaction: tx, ledgerEntries, ledgerCheck } = result.data;
                    const verdict = ledgerVerdict(ledgerCheck, tx.status);
                    return (
                        <>
                            <div className="card stack">
                                <p className="big-amount">{formatMoney(tx.amount, tx.currency)}</p>
                                <p>{titleCase(tx.type)} <Badge value={tx.status} /></p>
                                {tx.status === 'failed' && tx.failureReason && <Alert>{tx.failureReason}</Alert>}
                                <dl className="details">
                                    <dt>Reference</dt><dd><code>{tx.reference}</code></dd>
                                    <dt>Started by</dt><dd>{tx.initiatedBy?.name ?? '-'}{tx.initiatedBy?.email && <span className="muted small"> · {tx.initiatedBy.email}</span>}</dd>
                                    <dt>From</dt><dd><Party wallet={tx.source} /></dd>
                                    <dt>To</dt><dd><Party wallet={tx.destination} /></dd>
                                    <dt>Description</dt><dd>{tx.description || '-'}</dd>
                                    <dt>Created</dt><dd>{formatDateTime(tx.createdAt)}</dd>
                                    {tx.completedAt && (<><dt>Completed</dt><dd>{formatDateTime(tx.completedAt)}</dd></>)}
                                    {tx.idempotencyKey && (<><dt>Idempotency key</dt><dd><code>{tx.idempotencyKey}</code></dd></>)}
                                </dl>
                            </div>

                            <Card title="Ledger entries" subtitle="Every movement of money for this transaction">
                                {verdict && (
                                    <Alert kind={verdict.ok ? 'success' : 'error'}>
                                        {verdict.ok ? <CircleCheck size={16} /> : <CircleAlert size={16} />} {verdict.text}
                                    </Alert>
                                )}
                                {ledgerEntries.length > 0 && (
                                    <div className="table-wrap" style={{ marginTop: 12 }}>
                                        <table className="table">
                                            <thead>
                                                <tr><th>Wallet</th><th>Movement</th><th className="right">Amount</th><th className="right">Before</th><th className="right">After</th></tr>
                                            </thead>
                                            <tbody>
                                                {ledgerEntries.map((entry) => (
                                                    <tr key={entry._id}>
                                                        <td><Party wallet={entry.wallet} /></td>
                                                        <td>{entry.direction === 'credit' ? 'Money in' : 'Money out'}</td>
                                                        <td className="right nowrap">{formatMoney(entry.amount, entry.currency)}</td>
                                                        <td className="right nowrap">{formatMoney(entry.balanceBefore, entry.currency)}</td>
                                                        <td className="right nowrap">{formatMoney(entry.balanceAfter, entry.currency)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </Card>
                        </>
                    );
                })()}
            </LoadState>
        </div>
    );
}