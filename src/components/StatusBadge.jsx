export function StatusBadge({ tone = 'accent', children }) {
  return <span className={`statusBadge ${tone}`}>{children}</span>;
}
