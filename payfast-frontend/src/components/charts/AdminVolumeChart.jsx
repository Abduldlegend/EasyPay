import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import ChartTooltip, { compactMoney } from './ChartTooltip.jsx';

const tick = { fill: 'var(--muted)', fontSize: 12 };

export default function AdminVolumeChart({ data, currency }) {
    return (
        <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={tick} interval="preserveStartEnd" minTickGap={16} />
                    <YAxis tickFormatter={compactMoney} tickLine={false} axisLine={false} tick={tick} width={48} />
                    <Tooltip content={<ChartTooltip currency={currency} />} cursor={{ fill: 'var(--hover)' }} />
                    <Bar dataKey="volume" name="Completed volume" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={24} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}