import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Receipt, Search } from 'lucide-react';
import { listAdminTransactions } from '../api/admin.api.js';
import { useFetch } from '../hooks/useFetch.js';
import { Badge, Button, EmptyState, Field, LoadState, Pagination } from '../components/ui.jsx';
import { describeFlow } from '../utils/adminTransactions.js';
import { formatDateTime, titleCase } from '../utils/format.js';
import { formatMoney } from '../utils/money.js';
import { CURRENCIES, TRANSACTION_STATUSES, TRANSACTION_TYPES } from '../utils/transactions.js';

const FILTER_KEYS = ['search', 'type', 'status', 'currency', 'from', 'to'];

export default function AdminTransactionsPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const filters = Object.fromEntries(FILTER_KEYS.map((key) => [key, searchParams.get(key) ?? '']));
    const page = Number(searchParams.get('page')) || 1;

    // The search box is typed into freely and only applied on submit, so each keystroke
    // does not hit the API.
    const [searchText, setSearchText] = useState(filters.search);
    useEffect(() => setSearchText(filters.search), [filters.search]);

    const result = useFetch(() => listAdminTransactions({ ...filters, page, limit: 15 }), [searchParams.toString()]);

    const update = (key, value) => {
        const next = new URLSearchParams(searchParams);
        if (value) next.set(key, value); else next.delete(key);
        if (key !== 'page') next.delete('page');
        setSearchParams(next);
    };

    const hasFilters = FILTER_KEYS.some((key) => filters[key]);

    return (
        <div className="stack-lg">
            <div>
                <h2 className="greeting">Transactions</h2>
                <p className="muted">Every transaction on the platform, including failed attempts.</p>
            </div>

            <form className="card filters" onSubmit={(event) => { event.preventDefault(); update('search', searchText.trim()); }}>
                <Field label="Search" placeholder="TXN-… , WLT-… or email" value={searchText}
                    onChange={(event) => setSearchText(event.target.value)} />
                <Field as="select" label="Type" value={filters.type} onChange={(e) => update('type', e.target.value)}>
                    <option value="">All types</option>
                    {TRANSACTION_TYPES.map((type) => <option key={type} value={type}>{titleCase(type)}</option>)}
                </Field>
                <Field as="select" label="Status" value={filters.status} onChange={(e) => update('status', e.target.value)}>
                    <option value="">All statuses</option>
                    {TRANSACTION_STATUSES.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}
                </Field>
                <Field as="select" label="Currency" value={filters.currency} onChange={(e) => update('currency', e.target.value)}>
                    <option value="">All currencies</option>
                    {CURRENCIES.map((code) => <option key={code} value={code}>{code}</option>)}
                </Field>
                <Field label="From" type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => update('from', e.target.value)} />
                <Field label="To" type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => update('to', e.target.value)} />
                <Button type="submit" variant="secondary"><Search size={16} /> Search</Button>
                {hasFilters && <Button type="button" variant="secondary" onClick={() => setSearchParams({})}>Clear</Button>}
            </form>

            <LoadState loading={result.loading} error={result.error} onRetry={result.reload} hasData={!!result.data}>
                {result.data && (result.data.transactions.length === 0 ? (
                    <EmptyState icon={Receipt} title="No transactions match">Try removing a filter or checking the reference.</EmptyState>
                ) : (
                    <>
                        <div className="table-wrap">
                            <table className="table">
                                <thead>
                                    <tr><th>When</th><th>Reference</th><th>Type</th><th>Flow</th><th className="right">Amount</th><th>Status</th></tr>
                                </thead>
                                <tbody>
                                    {result.data.transactions.map((tx) => (
                                        <tr key={tx._id}>
                                            <td className="nowrap">{formatDateTime(tx.createdAt)}</td>
                                            <td><Link to={`/admin/transactions/${tx.reference}`}><code>{tx.reference}</code></Link></td>
                                            <td>{titleCase(tx.type)}</td>
                                            <td>{describeFlow(tx)}</td>
                                            <td className="right nowrap">{formatMoney(tx.amount, tx.currency)}</td>
                                            <td><Badge value={tx.status} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <Pagination pagination={result.data.pagination} onChange={(next) => update('page', String(next))} />
                        <p className="muted small">{result.data.pagination.total} transactions</p>
                    </>
                ))}
            </LoadState>
        </div>
    );
}