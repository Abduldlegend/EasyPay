import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import ChartTooltip, { compactMoney } from './ChartTooltip.jsx';

const tick = { fill: 'var(--muted)', fontSize: 12 };

export default function BalanceTrendChart({ data, currency }) {
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={tick} interval="preserveStartEnd" minTickGap={24} />
          <YAxis tickFormatter={compactMoney} tickLine={false} axisLine={false} tick={tick} width={48} />
          <Tooltip content={<ChartTooltip currency={currency} />} />
          <Area type="monotone" dataKey="balance" name="Balance" stroke="#6366f1" strokeWidth={2.5} fill="url(#balanceFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
