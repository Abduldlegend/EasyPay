import { useSearchParams } from 'react-router-dom';
import { listTransactions } from '../api/transactions.api.js';
import { useFetch } from '../hooks/useFetch.js';
import { useWallets } from '../hooks/useWallets.js';
import { Button, Field, LoadState, Pagination } from '../components/ui.jsx';
import TransactionTable from '../components/TransactionTable.jsx';
import { TRANSACTION_STATUSES, TRANSACTION_TYPES } from '../utils/transactions.js';
import { titleCase } from '../utils/format.js';

const FILTER_KEYS = ['walletId', 'type', 'status', 'from', 'to'];

export default function TransactionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const wallets = useWallets();

  const filters = Object.fromEntries(FILTER_KEYS.map((key) => [key, searchParams.get(key) ?? '']));
  const page = Number(searchParams.get('page')) || 1;

  const history = useFetch(
    () => listTransactions({ ...filters, page, limit: 10 }),
    [searchParams.toString()]
  );

  const update = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.delete('page'); // any filter change goes back to page 1
    setSearchParams(next);
  };

  const hasFilters = FILTER_KEYS.some((key) => filters[key]);

  return (
    <div className="stack-lg">
      <h1>Transactions</h1>

      <div className="card filters">
        <Field as="select" label="Wallet" value={filters.walletId} onChange={(e) => update('walletId', e.target.value)}>
          <option value="">All wallets</option>
          {wallets.data?.map((wallet) => <option key={wallet._id} value={wallet._id}>{wallet.currency} ({wallet.reference})</option>)}
        </Field>
        <Field as="select" label="Type" value={filters.type} onChange={(e) => update('type', e.target.value)}>
          <option value="">All types</option>
          {TRANSACTION_TYPES.map((type) => <option key={type} value={type}>{titleCase(type)}</option>)}
        </Field>
        <Field as="select" label="Status" value={filters.status} onChange={(e) => update('status', e.target.value)}>
          <option value="">All statuses</option>
          {TRANSACTION_STATUSES.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}
        </Field>
        <Field label="From" type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => update('from', e.target.value)} />
        <Field label="To" type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => update('to', e.target.value)} />
        {hasFilters && <Button variant="secondary" onClick={() => setSearchParams({})}>Clear filters</Button>}
      </div>

      <LoadState loading={history.loading} error={history.error} onRetry={history.reload} hasData={!!history.data}>
        {history.data && (
          <>
            <TransactionTable transactions={history.data.transactions} />
            <Pagination pagination={history.data.pagination} onChange={(next) => update('page', String(next))} />
          </>
        )}
      </LoadState>
    </div>
  );
}
