import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import ChartTooltip, { compactMoney } from './ChartTooltip.jsx';

export const COLORS = { in: '#10b981', out: '#6366f1' };
const tick = { fill: 'var(--muted)', fontSize: 12 };

export default function CashFlowChart({ data, currency }) {
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={4} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={tick} interval="preserveStartEnd" minTickGap={16} />
          <YAxis tickFormatter={compactMoney} tickLine={false} axisLine={false} tick={tick} width={48} />
          <Tooltip content={<ChartTooltip currency={currency} />} cursor={{ fill: 'var(--hover)' }} />
          <Bar dataKey="moneyIn" name="Money in" fill={COLORS.in} radius={[6, 6, 0, 0]} maxBarSize={20} />
          <Bar dataKey="moneyOut" name="Money out" fill={COLORS.out} radius={[6, 6, 0, 0]} maxBarSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
