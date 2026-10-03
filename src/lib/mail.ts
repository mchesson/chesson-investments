import 'server-only';

// Email through Resend, once it's set up (RESEND_API_KEY and MAIL_FROM in
// Vercel). Until then nothing is sent and the caller shows the link to copy.
export const mailReady = () => !!process.env.RESEND_API_KEY && !!process.env.MAIL_FROM;

export async function sendMail(m: { to: string; subject: string; text: string; html: string }): Promise<{ sent: true; id: string } | { sent: false; reason: string }> {
  if (!mailReady()) return { sent: false, reason: 'Email isn’t set up yet.' };
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(15_000),
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: process.env.MAIL_FROM, to: [m.to], subject: m.subject, text: m.text, html: m.html }),
    });
    const j = (await r.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!r.ok || !j.id) return { sent: false, reason: j.message ?? `the email service answered ${r.status}` };
    return { sent: true, id: j.id };
  } catch (e) {
    return { sent: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** A plain branded email with one button (values are escaped; the link is ours). */
export function linkEmail(o: { title: string; intro: string; button: string; url: string; note: string }) {
  const html = `<!doctype html><html><body style="margin:0;background:#f5f7f9;font-family:Arial,Helvetica,sans-serif;color:#212121">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e3e6ea;border-radius:8px">
<tr><td style="background:#212121;color:#ffffff;padding:16px 24px;font-family:Georgia,serif;font-size:20px;border-radius:8px 8px 0 0">Chesson <span style="color:#7fc4f0">Investments</span></td></tr>
<tr><td style="height:4px;background:#0D71BA"></td></tr>
<tr><td style="padding:24px"><h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 12px">${esc(o.title)}</h1>
<p style="font-size:15px;line-height:1.5;margin:0 0 20px;white-space:pre-line">${esc(o.intro)}</p>
<p style="margin:0 0 20px"><a href="${esc(o.url)}" style="display:inline-block;background:#0D71BA;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:6px">${esc(o.button)}</a></p>
<p style="font-size:13px;color:#5f6368;line-height:1.5;margin:0">${esc(o.note)}</p></td></tr>
</table></td></tr></table></body></html>`;
  return { html, text: `${o.title}\n\n${o.intro}\n\n${o.button}: ${o.url}\n\n${o.note}` };
}
