// What we've spent with a company or person: every invoice, by project, with
// the total. Pure, tested in vendor-spend.test.ts. An invoice that came as
// backup inside a GC's bill is listed (it's work they did for us) and marked
// "through" that GC; credits count against the total.
export type SpendBill = {
  id: string; projectId: string; projectName: string; number: string | null; date: string; kind: string;
  amount: string; status: string; throughBillId: string | null; throughVendor: string | null;
};

export type ProjectSpend = { projectId: string; projectName: string; cents: number; direct: number; through: number; bills: SpendBill[]; first: string; last: string };

const c = (a: string) => Math.round(Number(a) * 100);

export function spendByProject(bills: SpendBill[]): { projects: ProjectSpend[]; cents: number; count: number } {
  const m = new Map<string, ProjectSpend>();
  for (const b of bills) {
    const p = m.get(b.projectId) ?? { projectId: b.projectId, projectName: b.projectName, cents: 0, direct: 0, through: 0, bills: [], first: b.date, last: b.date };
    const v = c(b.amount);
    p.cents += v;
    if (b.throughBillId) p.through += v; else p.direct += v;
    p.bills.push(b);
    if (b.date < p.first) p.first = b.date;
    if (b.date > p.last) p.last = b.date;
    m.set(b.projectId, p);
  }
  const projects = [...m.values()].map((p) => ({ ...p, bills: [...p.bills].sort((a, b) => a.date.localeCompare(b.date) || (a.number ?? '').localeCompare(b.number ?? '')) }))
    .sort((a, b) => b.last.localeCompare(a.last));
  return { projects, cents: projects.reduce((s, p) => s + p.cents, 0), count: bills.length };
}
