// Made-up sample people, a watched lot and tasks for local development.
// Refuses any database that isn't on this computer.
import postgres from 'postgres';

const url = process.env.DATABASE_URL ?? 'postgres://ci:ci@localhost:5432/ci';
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error('Refusing to seed a database that is not on this computer.');
  process.exit(1);
}
const sql = postgres(url, { max: 1, onnotice: () => {} });

await sql.begin(async (tx) => {
  const [owner] = await tx`insert into users (email, name, role) values ('owner@example.com', 'Sample Owner', 'owner')
    on conflict (email) do update set role = 'owner' returning id`;
  await tx`insert into users (email, name, role) values ('staff@example.com', 'Sample Staff', 'staff'), ('accountant@example.com', 'Sample Accountant', 'accountant') on conflict (email) do nothing`;
  const exists = await tx`select 1 from people where email = 'dana@example.com'`;
  if (exists.length) return;
  const [co] = await tx`insert into companies (name, city, state, created_by) values ('Oak Grove Builders', 'Raleigh', 'NC', ${owner.id}) returning id`;
  await tx`insert into party_roles (company_id, role, stage, trade, areas) values (${co.id}, 'gc', 'talking', 'Custom homes', 'Raleigh, Wake County')`;
  const [agent] = await tx`insert into people (first_name, last_name, email, phone, city, state, how_met, created_by)
    values ('Pat', 'Lee', 'pat@example.com', '+19195550101', 'Raleigh', 'NC', 'event', ${owner.id}) returning id`;
  await tx`insert into party_roles (person_id, role, stage, areas) values (${agent.id}, 'agent', 'talking', 'Five Points, Oakwood')`;
  const [gc] = await tx`insert into people (first_name, last_name, email, phone, company_id, title, how_met, introduced_by_id, intro_note, created_by)
    values ('Dana', 'Brooks', 'dana@example.com', '+19195550102', ${co.id}, 'Owner', 'introduction', ${agent.id}, 'Pat said Dana builds in Belvidere Park and is careful with budgets.', ${owner.id}) returning id`;
  await tx`insert into person_companies (person_id, company_id, title, started_on) values (${gc.id}, ${co.id}, 'Owner', current_date)`;
  await tx`insert into party_roles (person_id, role, stage, trade) values (${gc.id}, 'gc', 'bid', 'Custom homes')`;
  await tx`insert into touches (person_id, kind, happened_on, notes, user_id) values (${gc.id}, 'site_walk', current_date - 3, 'Walked 109 Plainview; will price framing.', ${owner.id}),
    (${agent.id}, 'call', current_date - 50, 'Sent our buy box.', ${owner.id})`;
  await tx`insert into tasks (title, due_on, assigned_to, person_id, created_by) values ('Get Dana''s framing number', current_date, ${owner.id}, ${gc.id}, ${owner.id})`;
  await tx`insert into properties (address, city, state, zip, neighborhood, source_person_id, asking_price, lot_sf, lot_acres, zoning, created_by)
    values ('1500 Sample St', 'Raleigh', 'NC', '27608', 'Five Points', ${agent.id}, 525000, 8712, 0.2, 'R-6', ${owner.id})`;
});
console.log('Seeded sample data (sign in locally as Sample Owner, Staff or Accountant).');
await sql.end();
