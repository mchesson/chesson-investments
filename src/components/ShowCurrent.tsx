'use client';
// Scrolls a sideways list (the stage bar on a phone) so the current step is in view.
import { useEffect, useRef } from 'react';

export function ShowCurrent() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const nav = ref.current?.parentElement;
    nav?.querySelectorAll<HTMLElement>('[aria-current]').forEach((el) => {
      const list = el.closest('ol, ul') as HTMLElement | null;
      if (list && list.scrollWidth > list.clientWidth) list.scrollLeft += el.getBoundingClientRect().left - list.getBoundingClientRect().left - 24;
    });
  });
  return <span ref={ref} hidden />;
}
