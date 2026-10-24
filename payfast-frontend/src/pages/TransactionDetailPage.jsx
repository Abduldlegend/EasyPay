import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { getTransaction } from '../api/transactions.api.js';
import { useFetch } from '../hooks/useFetch.js';
import { Alert, Badge, LoadState } from '../components/ui.jsx';
import { formatDateTime, titleCase } from '../utils/format.js';
import { formatMoney } from '../utils/money.js';
import { describeTransaction } from '../utils/transactions.js';

const walletLabel = (wallet) => (wallet?.type === 'system' ? 'External (settlement)' : wallet?.reference ?? '-');

export default function TransactionDetailPage() {
  const { reference } = useParams();
  const result = useFetch(() => getTransaction(reference), [reference]);

  return (
    <div className="narrow stack">
      <Link to="/transactions" className="back-link"><ArrowLeft size={16} /> All transactions</Link>
      <h1>Transaction</h1>
      <LoadState loading={result.loading} error={result.error} onRetry={result.reload} hasData={!!result.data}>
        {result.data && (() => {
          const { transaction: tx, ledgerEntries } = result.data;
          const sign = tx.direction === 'credit' ? '+' : '-';
          return (
            <>
              <div className="card stack">
                <p className="big-amount">{sign} {formatMoney(tx.amount, tx.currency)}</p>
                <p>{describeTransaction(tx)} <Badge value={tx.status} /></p>
                {tx.status === 'failed' && tx.failureReason && <Alert>{tx.failureReason}</Alert>}
                <dl className="details">
                  <dt>Reference</dt><dd>{tx.reference}</dd>
                  <dt>Type</dt><dd>{titleCase(tx.type)}</dd>
                  <dt>From</dt><dd>{walletLabel(tx.source)}</dd>
                  <dt>To</dt><dd>{walletLabel(tx.destination)}</dd>
                  <dt>Description</dt><dd>{tx.description || '-'}</dd>
                  <dt>Date</dt><dd>{formatDateTime(tx.createdAt)}</dd>
                  {tx.completedAt && (<><dt>Completed</dt><dd>{formatDateTime(tx.completedAt)}</dd></>)}
                </dl>
              </div>

              <h2>Ledger entries</h2>
              {ledgerEntries.length === 0
                ? <p className="muted">No money moved for this transaction.</p>
                : (
                  <div className="table-wrap">
                    <table className="table">
                      <thead><tr><th>Movement</th><th className="right">Amount</th><th className="right">Balance before</th><th className="right">Balance after</th></tr></thead>
                      <tbody>
                        {ledgerEntries.map((entry) => (
                          <tr key={entry._id}>
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
            </>
          );
        })()}
      </LoadState>
    </div>
  );
}
