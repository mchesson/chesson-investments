const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="24" fill="#1E4D7B"/><path d="M90.38 47.11 A33 33 0 1 0 90.38 72.89" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/><g stroke="#A7B0BC" stroke-width="6" stroke-linecap="round"><line x1="49" y1="40" x2="71" y2="40"/><line x1="60" y1="40" x2="60" y2="80"/><line x1="49" y1="80" x2="71" y2="80"/></g></svg>`;

export function GET() {
  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' } });
}
