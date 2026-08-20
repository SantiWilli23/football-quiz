export default function Card({ children, className = "" }) {
  return (
    <div className={`bg-panel border border-border rounded-card p-6 ${className}`}>
      {children}
    </div>
  );
}
