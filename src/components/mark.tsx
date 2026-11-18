export function Mark({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <circle cx="32" cy="32" r="22" fill="none" stroke="white" strokeOpacity="0.88" strokeWidth="2.4" />
      <rect x="30.2" y="20" width="3.6" height="24" rx="1.8" fill="white" />
    </svg>
  );
}
