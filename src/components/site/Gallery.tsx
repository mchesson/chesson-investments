'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** A photo grid; a click opens the photo large, with ← / → and Esc. */
export function Gallery({ photos }: { photos: { src: string; alt: string }[] }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [at, setAt] = useState<number | null>(null);
  const open = (i: number) => { setAt(i); ref.current?.showModal(); };
  const step = useCallback((d: number) => setAt((i) => (i === null ? i : (i + d + photos.length) % photos.length)), [photos.length]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (!ref.current?.open) return; if (e.key === 'ArrowRight') step(1); if (e.key === 'ArrowLeft') step(-1); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [step]);
  const cur = at === null ? null : photos[at];
  return (
    <>
      <div className="grid">
        {photos.map((p, i) => (
          <button key={p.src} type="button" className="shot" onClick={() => open(i)} aria-label={`Open photo: ${p.alt}`}>
            <img src={p.src} alt={p.alt} loading="lazy" decoding="async" />
          </button>
        ))}
      </div>
      <dialog ref={ref} className="lightbox" onClose={() => setAt(null)} onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }} aria-label="Photo">
        {cur ? (
          <>
            <img src={cur.src} alt={cur.alt} />
            <div className="bar">
              <button type="button" onClick={() => step(-1)}>‹ Previous</button>
              <span>{(at ?? 0) + 1} of {photos.length}{cur.alt ? ` · ${cur.alt}` : ''}</span>
              <span style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => step(1)}>Next ›</button>
                <button type="button" onClick={() => ref.current?.close()}>Close</button>
              </span>
            </div>
          </>
        ) : null}
      </dialog>
    </>
  );
}
