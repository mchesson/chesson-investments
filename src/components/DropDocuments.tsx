'use client';

import { useRef, useState } from 'react';
import { unzipSync } from 'fflate';
import { useRouter } from 'next/navigation';
import { dropSmall, finishDrop, startDrop, type DropResult } from '@/app/(app)/doc-drop-actions';
import { toast } from './Toast';

type Row = DropResult | { name: string; status: 'waiting' | 'sending' | 'reading'; message: string; href?: string };
const label: Record<Row['status'], string> = { waiting: 'Waiting', sending: 'Sending', reading: 'Reading', filed: 'Filed', inbox: 'Needs You', refused: 'Not Kept', duplicate: 'Already Here', error: 'Problem' };

const mimeOf = (name: string) => {
  const e = name.toLowerCase().split('.').pop() ?? '';
  return ({ pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic' } as Record<string, string>)[e] ?? 'application/octet-stream';
};

/** Zips are opened here, in the browser: each file inside goes in as if dropped on its own (owner: "I don't know how to unzip"). */
export async function openZips(list: File[]): Promise<File[]> {
  const out: File[] = [];
  for (const f of list) {
    if (!/\.zip$/i.test(f.name)) { out.push(f); continue; }
    try {
      const entries = unzipSync(new Uint8Array(await f.arrayBuffer()));
      for (const [path, bytes] of Object.entries(entries)) {
        const name = path.split('/').pop() ?? '';
        if (!name || path.endsWith('/') || path.startsWith('__MACOSX/') || name.startsWith('._') || name === '.DS_Store' || !bytes.length) continue;
        out.push(new File([bytes as BlobPart], name, { type: mimeOf(name) }));
      }
    } catch { out.push(f); } // not a readable zip: it'll be refused with the reason
  }
  return out;
}

/** Drag in any number of files (or zips of them); each is sent, read and filed, two at a time. */
export function DropDocuments() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [over, setOver] = useState(false);
  const busy = useRef(false);
  const input = useRef<HTMLInputElement>(null);

  async function one(f: File, i: number) {
    const set = (r: Row) => setRows((rs) => rs.map((x, j) => (j === i ? r : x)));
    try {
      set({ name: f.name, status: 'sending', message: '' });
      const s = await startDrop(f.name, f.size);
      if ('error' in s) return set({ name: f.name, status: 'error', message: s.error });
      let r: DropResult;
      if ('direct' in s) {
        const d = new FormData(); d.set('file', f);
        set({ name: f.name, status: 'reading', message: '' });
        r = await dropSmall(d);
      } else {
        const up = await fetch(s.url, { method: 'PUT', body: f, headers: { 'content-type': f.type || 'application/octet-stream', 'x-upsert': 'false' } });
        if (!up.ok) return set({ name: f.name, status: 'error', message: `The upload was refused (${up.status}). Try that file again.` });
        set({ name: f.name, status: 'reading', message: '' });
        r = await finishDrop(s.path, s.token, f.name);
      }
      set(r);
    } catch (e) {
      set({ name: f.name, status: 'error', message: e instanceof Error ? e.message : 'Something went wrong.' });
    }
  }

  async function add(list: FileList | null) {
    if (!list?.length || busy.current) return;
    busy.current = true;
    const fs = await openZips([...list]);
    const start = rows.length;
    setRows((rs) => [...rs, ...fs.map((f) => ({ name: f.name, status: 'waiting' as const, message: '' }))]);
    let next = 0;
    const worker = async () => { while (next < fs.length) { const k = next++; await one(fs[k], start + k); } };
    await Promise.all([worker(), worker()]);
    busy.current = false;
    toast(`Done: ${fs.length} ${fs.length === 1 ? 'file' : 'files'} sent. Anything marked Needs You is in the inbox below.`);
    router.refresh();
  }

  const counts = rows.reduce<Record<string, number>>((c, r) => ({ ...c, [r.status]: (c[r.status] ?? 0) + 1 }), {});
  return (
    <div className="drop-docs">
      <div className={`drop-zone${over ? ' over' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}>
        <p style={{ margin: 0 }}><strong>Drag your documents here</strong>, as many as you like: PDFs, photos of receipts, Word and Excel files (up to 50 MB each), or <strong>zip files</strong> of them: no need to unzip.</p>
        <button type="button" className="btn" onClick={() => input.current?.click()}>Choose Files</button>
        <input ref={input} type="file" multiple hidden accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.docx,.xlsx,.doc,.xls,.zip" onChange={(e) => { add(e.target.files); e.target.value = ''; }} aria-label="Choose documents" />
      </div>
      {rows.length ? (
        <>
          <p className="small muted">{Object.entries(counts).map(([k, n]) => `${label[k as Row['status']]}: ${n}`).join(' · ')}</p>
          <div className="table-wrap"><table className="t drop-results">
            <thead><tr><th>File</th><th>Result</th><th>What Happened</th></tr></thead>
            <tbody>{rows.map((r, i) => (
              <tr key={i} data-status={r.status}>
                <td className="small">{r.name}</td>
                <td><span className={`chip ${r.status === 'filed' ? 'aqua' : r.status === 'inbox' ? 'energy' : r.status === 'error' || r.status === 'refused' ? 'red' : ''}`}>{label[r.status]}</span></td>
                <td className="small">{r.href ? <a href={r.href}>{r.message || 'Open'}</a> : r.message}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </>
      ) : null}
    </div>
  );
}
