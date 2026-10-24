import { Link } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, Ban, Clock, Receipt } from 'lucide-react';
import { formatDateTime } from '../utils/format.js';
import { formatMoney } from '../utils/money.js';
import { describeTransaction } from '../utils/transactions.js';
import { Badge, EmptyState } from './ui.jsx';

function TransactionIcon({ tx }) {
  if (tx.status === 'failed') return <span className="tx-icon tx-failed"><Ban size={18} /></span>;
  if (tx.status === 'pending') return <span className="tx-icon tx-pending"><Clock size={18} /></span>;
  return tx.direction === 'credit'
    ? <span className="tx-icon tx-in"><ArrowDownLeft size={18} /></span>
    : <span className="tx-icon tx-out"><ArrowUpRight size={18} /></span>;
}

export default function TransactionTable({ transactions }) {
  if (transactions.length === 0) {
    return <EmptyState icon={Receipt} title="No transactions yet">Deposits, withdrawals and transfers will show up here.</EmptyState>;
  }

  return (
    <ul className="tx-list">
      {transactions.map((tx) => {
        const sign = tx.direction === 'credit' ? '+' : '-';
        const tone = tx.status === 'completed' ? (tx.direction === 'credit' ? 'in' : 'out') : 'muted';
        return (
          <li key={tx._id}>
            <Link to={`/transactions/${tx.reference}`} className="tx-row">
              <TransactionIcon tx={tx} />
              <span className="tx-main">
                <strong>{describeTransaction(tx)}</strong>
                <span className="muted small">{formatDateTime(tx.createdAt)} &middot; {tx.reference}</span>
              </span>
              <span className="tx-side">
                <span className={`tx-amount amount-${tone}`}>{sign} {formatMoney(tx.amount, tx.currency)}</span>
                {tx.status !== 'completed' && <Badge value={tx.status} />}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
