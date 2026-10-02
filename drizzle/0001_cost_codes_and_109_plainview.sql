-- Data: the standard cost codes and the owner's first project, 109 Plainview Ave.
-- Safe to re-run: nothing is added twice. History is System, via "phase 1 setup".
INSERT INTO cost_codes (code, name, sort, kind) VALUES
  ('01', 'Benchmark', 1, 'construction'),
  ('02', 'Development', 2, 'construction'),
  ('03', 'Owner Design / Engineering', 3, 'construction'),
  ('04', 'Permits / Inspections', 4, 'construction'),
  ('05', 'Sewer / Water', 5, 'construction'),
  ('06', 'Sitework', 6, 'construction'),
  ('07', 'Foundation / Flatwork', 7, 'construction'),
  ('08', 'Framing', 8, 'construction'),
  ('09', 'Plumbing', 9, 'construction'),
  ('10', 'Electrical', 10, 'construction'),
  ('11', 'HVAC', 11, 'construction'),
  ('12', 'Insulation', 12, 'construction'),
  ('13', 'Roofing / Gutters', 13, 'construction'),
  ('14', 'Siding', 14, 'construction'),
  ('15', 'Windows / Exterior Doors', 15, 'construction'),
  ('16', 'Drywall', 16, 'construction'),
  ('17', 'Flooring / Tile', 17, 'construction'),
  ('18', 'Interior Doors / Trim', 18, 'construction'),
  ('19', 'Paint', 19, 'construction'),
  ('20', 'Cabinets / Countertops', 20, 'construction'),
  ('21', 'Appliances', 21, 'construction'),
  ('22', 'Accessories', 22, 'construction'),
  ('23', 'Life Safety', 23, 'construction'),
  ('24', 'Landscaping', 24, 'construction'),
  ('25', 'Cleaning', 25, 'construction'),
  ('26', 'Management', 26, 'soft'),
  ('27', 'Contingency', 27, 'soft'),
  ('28', 'General Conditions / Site Services', 28, 'construction'),
  ('29', 'Porch / Deck / Driveway', 29, 'construction'),
  ('30', 'Due Diligence / Closing Costs', 30, 'acquisition'),
  ('31', 'Staging / Listing / Marketing', 31, 'selling')
ON CONFLICT (code) DO NOTHING;
--> statement-breakpoint
WITH p AS (
  INSERT INTO projects (name, address, city, state, zip, neighborhood, owned_by, stage, lot_sf, lot_acres, zoning, lot_cost, lot_value, heated_sf, plan, proforma_sale_price, selling_cost_pct, closing_cost_at_sale, notes)
  SELECT '109 Plainview Ave', '109 Plainview Ave', 'Raleigh', 'NC', '27604', 'Belvidere Park', 'Chesson Investments, LLC', 'design', 9148, 0.210, 'R-10', 380000, 450000, 4142,
    'The Design Meister: 4,142 heated sf (2,047 main + 2,095 upstairs, est.), 4 bed, primary on main, study, game room, flex room, 2-car garage',
    1800000, 6, 3000,
    'Lot cleared. Lot cost is the all-in cost to date. Budget scaled from the 210 Plainview budget ($240.77/sf all-in). Comparables: 1823 Rankin St presold at $1,660,000 (3,737 sf); 210 Plainview appraised at $1,821,000 as completed (4,067 sf). Selling costs (6%) and closing cost at sale ($3,000) are placeholders from the 420 Peyton sheet: set the real figures.'
  WHERE NOT EXISTS (SELECT 1 FROM projects WHERE address = '109 Plainview Ave' AND archived_at IS NULL)
  RETURNING id
), b AS (
  INSERT INTO budget_lines (project_id, cost_code_id, amount, percent_of_construction, notes)
  SELECT p.id, cc.id, v.amount, v.pct, v.notes
  FROM p CROSS JOIN (VALUES
    ('01', 9460::numeric, NULL::numeric, NULL),
    ('02', 0::numeric, NULL::numeric, 'Lot is cleared'),
    ('03', 18000::numeric, NULL::numeric, NULL),
    ('04', 3030::numeric, NULL::numeric, NULL),
    ('05', 0::numeric, NULL::numeric, 'Existing connections (confirm)'),
    ('06', 3500::numeric, NULL::numeric, NULL),
    ('07', 84571::numeric, NULL::numeric, NULL),
    ('08', 102200::numeric, NULL::numeric, NULL),
    ('09', 36203::numeric, NULL::numeric, NULL),
    ('10', 49496::numeric, NULL::numeric, NULL),
    ('11', 58220::numeric, NULL::numeric, NULL),
    ('12', 11686::numeric, NULL::numeric, NULL),
    ('13', 21031::numeric, NULL::numeric, NULL),
    ('14', 36664::numeric, NULL::numeric, NULL),
    ('15', 82499::numeric, NULL::numeric, NULL),
    ('16', 22278::numeric, NULL::numeric, NULL),
    ('17', 60559::numeric, NULL::numeric, NULL),
    ('18', 66713::numeric, NULL::numeric, NULL),
    ('19', 38331::numeric, NULL::numeric, NULL),
    ('20', 63500::numeric, NULL::numeric, NULL),
    ('21', 16400::numeric, NULL::numeric, NULL),
    ('22', 13419::numeric, NULL::numeric, NULL),
    ('23', NULL::numeric, NULL::numeric, NULL),
    ('24', 20350::numeric, NULL::numeric, NULL),
    ('25', 600::numeric, NULL::numeric, NULL),
    ('26', NULL::numeric, 13.87::numeric, NULL),
    ('27', NULL::numeric, 5::numeric, NULL),
    ('28', NULL::numeric, NULL::numeric, NULL),
    ('29', NULL::numeric, NULL::numeric, NULL),
    ('30', NULL::numeric, NULL::numeric, NULL),
    ('31', NULL::numeric, NULL::numeric, NULL)
  ) AS v(code, amount, pct, notes)
  JOIN cost_codes cc ON cc.code = v.code
  RETURNING project_id
), i AS (
  INSERT INTO project_items (project_id, description, status)
  SELECT p.id, x.d, 'unpriced' FROM p CROSS JOIN (VALUES
    ('Outdoor patio fireplace'), ('12'' folding patio door'), ('Upstairs balcony'), ('Second laundry hookup'),
    ('Optional egress window and closet in the front flex room')
  ) AS x(d)
  RETURNING project_id
)
INSERT INTO audit_log (entity, entity_id, action, via, summary)
SELECT 'project', p.id, 'create', 'phase 1 setup', 'added 109 Plainview Ave with its budget (scaled from 210 Plainview) and five items not priced yet' FROM p;
