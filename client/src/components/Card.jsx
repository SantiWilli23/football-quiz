export default function Card({ children, className = "" }) {
  return (
    <div className={`bg-panel border border-border rounded-2xl p-6 ${className}`}>
      {children}
    </div>
  );
}
