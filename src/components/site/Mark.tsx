export function Mark({ size = 38, light = false }: { size?: number; light?: boolean }) {
  const a = light ? '#FFFFFF' : '#1E4D7B', b = light ? '#A7B0BC' : '#707A89';
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <path d="M90.38 47.11 A33 33 0 1 0 90.38 72.89" fill="none" stroke={a} strokeWidth="5" strokeLinecap="round" />
      <line x1="49" y1="40" x2="71" y2="40" stroke={b} strokeWidth="4" strokeLinecap="round" />
      <line x1="60" y1="40" x2="60" y2="80" stroke={b} strokeWidth="4" strokeLinecap="round" />
      <line x1="49" y1="80" x2="71" y2="80" stroke={b} strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
