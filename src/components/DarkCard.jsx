export function DarkCard({ className = '', children }) {
  return <article className={`darkCard ${className}`}>{children}</article>;
}
