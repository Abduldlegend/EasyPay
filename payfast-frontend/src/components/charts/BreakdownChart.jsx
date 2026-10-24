import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatMoney } from '../../utils/money.js';
import ChartTooltip from './ChartTooltip.jsx';

const PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#ec4899'];

export default function BreakdownChart({ data, currency }) {
  const total = data.reduce((sum, row) => sum + row.value, 0);
  return (
    <div className="breakdown">
      <div className="chart-box chart-box-sm">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="92%" paddingAngle={3} stroke="none">
              {data.map((row, index) => <Cell key={row.key} fill={PALETTE[index % PALETTE.length]} />)}
            </Pie>
            <Tooltip content={<ChartTooltip currency={currency} />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="legend">
        {data.map((row, index) => (
          <li key={row.key}>
            <span className="dot" style={{ background: PALETTE[index % PALETTE.length] }} />
            <span>{row.name}</span>
            <span className="muted small">{Math.round((row.value / total) * 100)}%</span>
            <strong>{formatMoney(row.value, currency)}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
