import { Link } from 'react-router-dom';
import { formatMoney } from '../utils/money.js';
import { Alert, Button } from './ui.jsx';

/** Shown after a money request resolves with a stored transaction. */
export default function TransactionResult({ transaction, title, onAnother }) {
  const completed = transaction.status === 'completed';
  return (
    <div className="stack">
      <Alert kind={completed ? 'success' : 'error'}>
        {completed
          ? `${title} of ${formatMoney(transaction.amount, transaction.currency)} completed.`
          : transaction.status === 'pending'
            ? 'Your request is still being processed. Check your transaction history shortly.'
            : transaction.failureReason ?? 'The transaction failed.'}
      </Alert>
      <p className="muted">Reference: <strong>{transaction.reference}</strong></p>
      <div className="row gap">
        <Link className="btn btn-primary" to={`/transactions/${transaction.reference}`}>View receipt</Link>
        <Link className="btn btn-secondary" to="/">Back to dashboard</Link>
        {onAnother && <Button variant="secondary" onClick={onAnother}>Make another</Button>}
      </div>
    </div>
  );
}
