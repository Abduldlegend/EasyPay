export default function StatCard({ icon: Icon, label, value, hint, tone = 'neutral' }) {
  return (
    <div className="card stat">
      <span className={`stat-icon stat-${tone}`}><Icon size={20} /></span>
      <div>
        <p className="muted small">{label}</p>
        <p className="stat-value">{value}</p>
        {hint && <p className="muted small">{hint}</p>}
      </div>
    </div>
  );
}
