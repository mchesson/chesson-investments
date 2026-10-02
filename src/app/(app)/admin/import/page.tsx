import { requirePage } from '@/lib/session';
import { PageHead, Section } from '@/components/ui';
import { ImportTool } from '@/components/ImportTool';
import { MatchBills } from '@/components/MatchBills';
import { applyBillMatches, previewBillMatches } from '../../import-actions';

export const metadata = { title: 'Import' };
// Copying photos from the old website can take a minute.
export const maxDuration = 120;

export default async function ImportPage() {
  await requirePage('users.manage');
  return (
    <div className="stack">
      <PageHead title="Import" sub="Add people, companies, projects, bills and photos from a file Claude prepares (for example from your email and project folders). You see exactly what it adds before anything is saved." />
      <Section title="Import a File" kind="grey" hint="Matches by email, phone, then name; never changes what you typed, only fills empty fields; bills already on file are skipped">
        <ImportTool />
      </Section>
      <Section title="Match Bills to Companies" kind="blue" hint="Links bills whose vendor name means a company or person on file (“Baggett Brothers Contracting LLC” → Baggett Brothers), so each company shows every invoice and the total">
        <MatchBills preview={previewBillMatches} apply={applyBillMatches} />
      </Section>
    </div>
  );
}
