'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

/** A <details> menu that closes on a click outside, Esc, choosing a link, or moving to another page. */
export function AutoCloseDetails({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const path = usePathname();
  useEffect(() => { if (ref.current) ref.current.open = false; }, [path]);
  useEffect(() => {
    const close = () => { if (ref.current) ref.current.open = false; };
    const down = (e: PointerEvent) => { if (ref.current?.open && !ref.current.contains(e.target as Node)) close(); };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && ref.current?.open) { close(); ref.current.querySelector('summary')?.focus(); }
    };
    document.addEventListener('pointerdown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', down); document.removeEventListener('keydown', key); };
  }, []);
  return (
    <details ref={ref} className={className} onClick={(e) => { if ((e.target as HTMLElement).closest('a')) ref.current!.open = false; }}>
      {children}
    </details>
  );
}
