/** Each factor's share of why prices differ: one labelled bar per factor, biggest first (a single measure, so one color and the numbers written out). */
export function FactorBars({ shares }: { shares: { key: string; label: string; share: number }[] }) {
  const max = Math.max(...shares.map((s) => s.share), 1);
  return (
    <ol className="factor-bars" aria-label="Share of why prices differ">
      {shares.map((s) => (
        <li key={s.key} title={`${s.label}: ${s.share}% of why prices differ`}>
          <span className="fb-label">{s.label}</span>
          <span className="fb-track"><span className="fb-bar" style={{ width: `${(s.share / max) * 100}%` }} /></span>
          <span className="fb-value">{s.share}%</span>
        </li>
      ))}
    </ol>
  );
}
