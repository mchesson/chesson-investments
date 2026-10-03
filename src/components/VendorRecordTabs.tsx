// The Grades and Issues tabs on a contractor's or vendor's page (company or person).
import Link from 'next/link';
import { GradeBadge, GradeForm, GradesTab } from './Grades';
import { Empty, Section } from './ui';
import { IssueForm, IssuesTab } from './Issues';
import { gradesFor, issuesFor, vendorsOnProject } from '@/lib/grade-data';
import { activeStaff, companyOptions, peopleOptions } from '@/lib/contacts';
import { db } from '@/db';
import { projects } from '@/db/schema';
import { asc, isNull } from 'drizzle-orm';

const projectOptions = () => db.select({ id: projects.id, name: projects.name }).from(projects).where(isNull(projects.archived)).orderBy(asc(projects.name));

export async function VendorGrades({ who, canEdit, override }: { who: { personId?: string; companyId?: string }; canEdit: boolean; override: { on: boolean; reason: string | null } }) {
  return <GradesTab who={who} data={await gradesFor(who)} projects={await projectOptions()} canEdit={canEdit} override={override} />;
}

export async function VendorIssues({ who, theirs, base, status, canEdit }: {
  who: { personId?: string; companyId?: string }; theirs: { id: string; name: string }[]; base: string; status: string | null; canEdit: boolean;
}) {
  const [issues, ps, staff, everyone] = await Promise.all([issuesFor(who), projectOptions(), activeStaff(), peopleOptions()]);
  const opts = { who, projects: ps, theirs, staff: staff.map((u) => ({ id: u.id, name: u.name ?? u.email })), everyone: everyone.map((p) => ({ id: p.id, name: p.name, sub: p.companyName })) };
  return (
    <IssuesTab issues={issues} status={status} canEdit={canEdit}
      href={(s) => `${base}?tab=issues${s ? `&status=${s}` : ''}`}
      form={canEdit ? <IssueForm {...opts} /> : null}
      editForm={(i) => <IssueForm {...opts} issue={i} />} />
  );
}

/** A project's Vendors tab: everyone on the job with their grade for it, and the job's issues. */
export async function ProjectVendors({ projectId, status, canEdit }: { projectId: string; status: string | null; canEdit: boolean }) {
  const [vs, issues, staff, everyone, ps, cos] = await Promise.all([vendorsOnProject(projectId), issuesFor({ projectId }), activeStaff(), peopleOptions(), projectOptions(), companyOptions()]);
  const base = { projects: ps, staff: staff.map((u) => ({ id: u.id, name: u.name ?? u.email })), everyone: everyone.map((p) => ({ id: p.id, name: p.name, sub: p.companyName })) };
  const whoOf = (v: (typeof vs)[number]) => (v.companyId ? { companyId: v.companyId } : { personId: v.personId! });
  return (
    <div className="stack">
      <Section title="Vendors on This Job" kind="blue" hint="Grade each one when their work is done, always with why">
        {vs.length ? <ul className="vendor-grade-list">{vs.map((v) => {
          const g = v.grades[0];
          const href = v.companyId ? `/companies/${v.companyId}` : `/people/${v.personId}`;
          return (
            <li key={v.companyId ?? v.personId} className="grade-card">
              <GradeBadge letter={g?.grade} />
              <div className="grade-body">
                <strong><Link href={href}>{v.name}</Link></strong>
                {g ? <p className="grade-why"><span className="small muted">Justification:</span> {g.justification}</p> : <p className="small muted" style={{ margin: 0 }}>Not graded on this job yet.</p>}
                {canEdit ? (
                  <div className="issue-actions">
                    <details className="fold"><summary>{g ? 'Grade Again' : 'Grade Them'}</summary><GradeForm who={whoOf(v)} projectId={projectId} /></details>
                    <Link className="btn small secondary" href={`${href}?tab=issues`}>Open an Issue</Link>
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}</ul> : <Empty>No vendors on this job yet: they show here once they bill it, have a commitment or send a bid.</Empty>}
      </Section>
      <IssuesTab issues={issues} status={status} canEdit={canEdit} showVendor
        href={(s) => `/projects/${projectId}?tab=vendors${s ? `&status=${s}` : ''}`}
        form={canEdit ? <IssueForm projectId={projectId} theirs={[]} {...base} vendors={[
          // Who's on this job first, then every company and person on file.
          ...vs.map((x) => ({ id: x.companyId ? `c:${x.companyId}` : `p:${x.personId}`, label: x.name, sub: 'On this job' })),
          ...cos.filter((c) => !vs.some((x) => x.companyId === c.id)).map((c) => ({ id: `c:${c.id}`, label: c.name, sub: 'Company' })),
          ...everyone.filter((p) => !vs.some((x) => x.personId === p.id)).map((p) => ({ id: `p:${p.id}`, label: p.name, sub: p.companyName ?? 'Person' })),
        ]} /> : null}
        editForm={(i) => <IssueForm who={i.companyId ? { companyId: i.companyId } : { personId: i.personId! }} projectId={projectId} theirs={[]} {...base} issue={i} />} />
    </div>
  );
}
