import { forwardRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';

export function Button({ variant = 'primary', loading = false, children, ...props }) {
  return (
    <button className={`btn btn-${variant}`} disabled={loading || props.disabled} {...props}>
      {loading ? 'Please wait...' : children}
    </button>
  );
}

export const Field = forwardRef(function Field({ label, error, hint, as = 'input', children, ...props }, ref) {
  const Control = as;
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <Control ref={ref} className={`input${error ? ' input-error' : ''}`} {...props}>
        {children}
      </Control>
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
});

export const Alert = ({ kind = 'error', children }) =>
  children ? <div className={`alert alert-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>{children}</div> : null;

export const Skeleton = ({ height = 16, width = '100%', radius = 8 }) => (
  <span className="skeleton" style={{ height, width, borderRadius: radius }} />
);

export const SkeletonBlock = () => (
  <div className="stack" aria-busy="true" aria-label="Loading">
    <Skeleton height={22} width="40%" />
    <Skeleton height={90} radius={14} />
    <Skeleton height={16} width="70%" />
  </div>
);

export const Badge = ({ value }) => <span className={`badge badge-${value}`}>{value}</span>;

export function LoadState({ loading, error, onRetry, hasData, fallback, children }) {
  if (loading && !hasData) return fallback ?? <SkeletonBlock />;
  if (error) {
    return (
      <div className="stack">
        <Alert>{error.message}</Alert>
        {onRetry && <Button variant="secondary" onClick={onRetry}>Try again</Button>}
      </div>
    );
  }
  return children;
}

export function Pagination({ pagination, onChange }) {
  if (!pagination || pagination.totalPages <= 1) return null;
  const { page, totalPages } = pagination;
  return (
    <div className="pagination">
      <Button variant="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</Button>
      <span className="muted">Page {page} of {totalPages}</span>
      <Button variant="secondary" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Next</Button>
    </div>
  );
}

export function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable: nothing to do */
    }
  };
  return (
    <button type="button" className="copy-btn" onClick={copy} title="Copy to clipboard">
      {copied ? <Check size={14} /> : <Copy size={14} />}
      <span>{copied ? 'Copied' : label}</span>
    </button>
  );
}

export const Card = ({ title, subtitle, action, children, className = '' }) => (
  <section className={`card ${className}`}>
    {(title || action) && (
      <header className="card-header">
        <div>
          {title && <h2>{title}</h2>}
          {subtitle && <p className="muted small">{subtitle}</p>}
        </div>
        {action}
      </header>
    )}
    {children}
  </section>
);

export const Tabs = ({ options, value, onChange }) => (
  <div className="segmented" role="tablist">
    {options.map((option) => (
      <button key={option.value} role="tab" aria-selected={value === option.value}
        className={`segment${value === option.value ? ' segment-active' : ''}`} onClick={() => onChange(option.value)}>
        {option.label}
      </button>
    ))}
  </div>
);

export const EmptyState = ({ icon: Icon, title, children }) => (
  <div className="empty">
    {Icon && <span className="empty-icon"><Icon size={22} /></span>}
    <strong>{title}</strong>
    {children && <p className="muted small">{children}</p>}
  </div>
);
