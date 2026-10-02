import Link from 'next/link';
import type { ReactNode } from 'react';

// One color per kind of section, the same everywhere (as TS Workspace):
// blue details / money, aqua places / documents, energy notes / follow-ups, grey history / filters.
export type SectionKind = 'blue' | 'aqua' | 'energy' | 'grey';

export function Section(props: { title: string; kind?: SectionKind; hint?: ReactNode; actions?: ReactNode; id?: string; children: ReactNode }) {
  return (
    <section className="section" data-c={props.kind ?? 'blue'} id={props.id} aria-labelledby={props.id ? `${props.id}-h` : undefined}>
      <header>
        <h2 id={props.id ? `${props.id}-h` : undefined}>{props.title}</h2>
        {props.hint ? <span className="hint">{props.hint}</span> : null}
        {props.actions}
      </header>
      <div className="body">{props.children}</div>
    </section>
  );
}

export function PageHead(props: { title: string; eyebrow?: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div className="titles">
        {props.eyebrow ? <div className="eyebrow">{props.eyebrow}</div> : null}
        <h1>{props.title}</h1>
        {props.sub ? <div className="sub">{props.sub}</div> : null}
      </div>
      {props.actions ? <div className="actions">{props.actions}</div> : null}
    </div>
  );
}

export function Tabs(props: { base: string; current: string; tabs: { key: string; label: string; count?: number }[] }) {
  return (
    <nav className="tabs" aria-label="Sections of this record">
      {props.tabs.map((t, i) => (
        <Link key={t.key} href={i === 0 ? props.base : `${props.base}?tab=${t.key}`} aria-current={props.current === t.key ? 'page' : undefined}>
          {t.label}{t.count !== undefined ? ` (${t.count})` : ''}
        </Link>
      ))}
    </nav>
  );
}

export function Facts({ items }: { items: [string, ReactNode][] }) {
  const shown = items.filter(([, v]) => v !== null && v !== undefined && v !== '' && v !== false);
  if (!shown.length) return <p className="empty">Nothing recorded yet.</p>;
  return (
    <dl className="facts">
      {shown.map(([k, v]) => (<div key={k} style={{ display: 'contents' }}><dt>{k}</dt><dd>{v}</dd></div>))}
    </dl>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

export function Tile(props: { k: string; v: ReactNode; s?: ReactNode; color?: string }) {
  return (
    <div className="tile" style={props.color ? { borderTopColor: props.color } : undefined}>
      <div className="k">{props.k}</div>
      <div className="v">{props.v}</div>
      {props.s ? <div className="s">{props.s}</div> : null}
    </div>
  );
}

export function Notice({ kind, children }: { kind?: 'warn' | 'error'; children: ReactNode }) {
  return <div className={`notice ${kind ?? ''}`} role={kind === 'error' ? 'alert' : 'status'}>{children}</div>;
}
