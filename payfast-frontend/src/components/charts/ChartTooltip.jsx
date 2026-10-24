import { formatMoney } from '../../utils/money.js';

export default function ChartTooltip({ active, payload, label, currency }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <strong>{label ?? payload[0].payload.name}</strong>
      {payload.map((item) => (
        <div key={item.dataKey ?? item.name} className="chart-tooltip-row">
          <span className="dot" style={{ background: item.color ?? item.payload.fill }} />
          <span>{item.name}</span>
          <strong>{formatMoney(item.value, currency)}</strong>
        </div>
      ))}
    </div>
  );
}

export const compactMoney = (minorUnits) =>
  new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(minorUnits / 100);
