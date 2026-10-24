// Pure helpers that turn API transactions / ledger entries into chart data.
// Only completed transactions count as money moved. `direction` comes from the API
// (credit = money into the viewer's wallet, debit = money out).

const pad = (value) => String(value).padStart(2, '0');
export const dayKey = (value) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const shortLabel = (date) => date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/** First day (local midnight) of a period that ends today and spans `days` days. */
export function periodStart(days, now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return start;
}

const inPeriod = (tx, days, now) => new Date(tx.createdAt) >= periodStart(days, now);

export function buildCashFlow(transactions, { days, currency, now = new Date() }) {
  const start = periodStart(days, now);
  const buckets = new Map();
  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + offset);
    buckets.set(dayKey(date), { date: dayKey(date), label: shortLabel(date), moneyIn: 0, moneyOut: 0 });
  }

  for (const tx of transactions) {
    if (tx.status !== 'completed' || tx.currency !== currency) continue;
    const bucket = buckets.get(dayKey(tx.createdAt));
    if (!bucket) continue;
    if (tx.direction === 'credit') bucket.moneyIn += tx.amount;
    else bucket.moneyOut += tx.amount;
  }
  return [...buckets.values()];
}

const BREAKDOWN_LABELS = {
  deposit: 'Deposits',
  withdrawal: 'Withdrawals',
  transfer_out: 'Transfers sent',
  transfer_in: 'Transfers received',
};

export function buildBreakdown(transactions, { days, currency, now = new Date() }) {
  const totals = {};
  for (const tx of transactions) {
    if (tx.status !== 'completed' || tx.currency !== currency || !inPeriod(tx, days, now)) continue;
    const key = tx.type === 'transfer' ? (tx.direction === 'credit' ? 'transfer_in' : 'transfer_out') : tx.type;
    totals[key] = (totals[key] ?? 0) + tx.amount;
  }
  return Object.entries(totals)
    .map(([key, value]) => ({ key, name: BREAKDOWN_LABELS[key] ?? key, value }))
    .sort((a, b) => b.value - a.value);
}

export function summarize(transactions, { days, currency, now = new Date() }) {
  const scoped = transactions.filter((tx) => tx.currency === currency && inPeriod(tx, days, now));
  const completed = scoped.filter((tx) => tx.status === 'completed');
  const failed = scoped.filter((tx) => tx.status === 'failed');
  const sum = (list) => list.reduce((total, tx) => total + tx.amount, 0);

  const moneyIn = sum(completed.filter((tx) => tx.direction === 'credit'));
  const moneyOut = sum(completed.filter((tx) => tx.direction === 'debit'));
  const finished = completed.length + failed.length;

  return {
    moneyIn,
    moneyOut,
    net: moneyIn - moneyOut,
    count: scoped.length,
    successRate: finished === 0 ? null : Math.round((completed.length / finished) * 100),
  };
}

/** Ledger entries (newest first, as the API returns them) -> balance over time, oldest first. */
export function buildBalanceTrend(entries) {
  if (!entries?.length) return [];
  const oldestFirst = [...entries].reverse().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const points = oldestFirst.map((entry) => ({
    time: new Date(entry.createdAt).getTime(),
    label: new Date(entry.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    balance: entry.balanceAfter,
  }));

  const first = oldestFirst[0];
  return [{ time: points[0].time - 1, label: points[0].label, balance: first.balanceBefore }, ...points];
}
