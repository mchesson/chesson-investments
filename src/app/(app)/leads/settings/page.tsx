import Link from 'next/link';
import { and, desc, eq } from 'drizzle-orm';
import { requirePage } from '@/lib/session';
import { db } from '@/db';
import { auditLog, users } from '@/db/schema';
import { readWebsiteSettings, websiteDefaults } from '@/lib/site-settings';
import { PageHead, Section } from '@/components/ui';
import { ActionForm } from '@/components/ActionForm';
import { HistoryList } from '@/components/contacts';
import { saveWebsiteSettings } from '../../lead-actions';

export const metadata = { title: 'Website Settings' };

export default async function WebsiteSettingsPage() {
  await requirePage('website.edit');
  const s = await readWebsiteSettings();
  const history = await db.select({ id: auditLog.id, at: auditLog.at, summary: auditLog.summary, via: auditLog.via, userName: users.name })
    .from(auditLog).leftJoin(users, eq(users.id, auditLog.userId)).where(and(eq(auditLog.entity, 'website_settings'))).orderBy(desc(auditLog.at)).limit(50);
  return (
    <>
      <PageHead eyebrow="Website Leads" title="Website Settings" sub="What the website shows for how to reach us, the longer page texts, and the Google tools. Projects are set on each project’s Website tab."
        actions={<Link className="btn secondary" href="/leads">Back to Leads</Link>} />
      <ActionForm action={saveWebsiteSettings} submit="Save the Settings">
        <Section title="How to Reach Us" kind="blue" hint="Shown in the top bar, the footer and the Contact page">
          <div className="fields">
            <label className="f">Phone<span className="h">Leave empty to hide it everywhere</span><input name="phone" type="tel" defaultValue={s.phone ?? ''} /></label>
            <label className="f">Email<span className="h">Leave empty to hide it; the forms still work</span><input name="email" type="email" defaultValue={s.email ?? ''} /></label>
            <label className="f">Where We Work<input name="area" defaultValue={s.area} placeholder={websiteDefaults.area} /></label>
          </div>
        </Section>
        <Section title="Page Words" kind="aqua" hint="A blank line starts a new paragraph; empty puts back the starting words">
          <div className="fields">
            <label className="f">About Page<textarea name="aboutText" rows={7} defaultValue={s.aboutText} /></label>
            <label className="f">What We Do (Introduction)<textarea name="whatWeDoIntro" rows={3} defaultValue={s.whatWeDoIntro} /></label>
            <label className="f">Sell Us Your Property (Introduction)<textarea name="sellIntro" rows={4} defaultValue={s.sellIntro} /></label>
            <label className="f">Contact Us (Introduction)<textarea name="contactIntro" rows={3} defaultValue={s.contactIntro} /></label>
          </div>
        </Section>
        <Section title="Google Tools" kind="grey" hint="Optional; nothing is signed up for here">
          <div className="fields">
            <label className="f">Google Analytics Measurement ID<span className="h">From Google Analytics → Admin → Data Streams; starts with G-. Added to the website’s pages only.</span><input name="gaId" defaultValue={s.gaId ?? ''} placeholder="G-XXXXXXXXXX" /></label>
            <label className="f">Search Console Verification<span className="h">Search Console → Add Property → HTML tag: paste the tag or the code in content=&quot;…&quot;</span><input name="searchConsole" defaultValue={s.searchConsole ?? ''} /></label>
          </div>
        </Section>
      </ActionForm>
      <Section title="History" kind="grey"><HistoryList rows={history} /></Section>
    </>
  );
}
