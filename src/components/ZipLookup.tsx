/** Type a ZIP code, see what's happening there (a plain GET form: works without script). */
export function ZipLookup({ current }: { current?: string }) {
  return (
    <form action="/market/zip" method="get" className="zip-lookup" role="search" aria-label="Look up a ZIP code">
      <input name="zip" inputMode="numeric" pattern="\d{5}(-\d{4})?" maxLength={10} placeholder="ZIP code" defaultValue={current ?? ''} aria-label="ZIP code" required />
      <button className="btn" type="submit">Look Up</button>
    </form>
  );
}
