// The standard cost codes (from the 210 Plainview budget). The migration
// 0001_cost_codes inserts the same list; admins can add more later.

export const COST_CODES: { code: string; name: string; kind: 'construction' | 'soft' | 'acquisition' | 'selling' }[] = [
  { code: '01', name: 'Benchmark', kind: 'construction' },
  { code: '02', name: 'Development', kind: 'construction' },
  { code: '03', name: 'Owner Design / Engineering', kind: 'construction' },
  { code: '04', name: 'Permits / Inspections', kind: 'construction' },
  { code: '05', name: 'Sewer / Water', kind: 'construction' },
  { code: '06', name: 'Sitework', kind: 'construction' },
  { code: '07', name: 'Foundation / Flatwork', kind: 'construction' },
  { code: '08', name: 'Framing', kind: 'construction' },
  { code: '09', name: 'Plumbing', kind: 'construction' },
  { code: '10', name: 'Electrical', kind: 'construction' },
  { code: '11', name: 'HVAC', kind: 'construction' },
  { code: '12', name: 'Insulation', kind: 'construction' },
  { code: '13', name: 'Roofing / Gutters', kind: 'construction' },
  { code: '14', name: 'Siding', kind: 'construction' },
  { code: '15', name: 'Windows / Exterior Doors', kind: 'construction' },
  { code: '16', name: 'Drywall', kind: 'construction' },
  { code: '17', name: 'Flooring / Tile', kind: 'construction' },
  { code: '18', name: 'Interior Doors / Trim', kind: 'construction' },
  { code: '19', name: 'Paint', kind: 'construction' },
  { code: '20', name: 'Cabinets / Countertops', kind: 'construction' },
  { code: '21', name: 'Appliances', kind: 'construction' },
  { code: '22', name: 'Accessories', kind: 'construction' },
  { code: '23', name: 'Life Safety', kind: 'construction' },
  { code: '24', name: 'Landscaping', kind: 'construction' },
  { code: '25', name: 'Cleaning', kind: 'construction' },
  { code: '26', name: 'Management', kind: 'soft' },
  { code: '27', name: 'Contingency', kind: 'soft' },
  // Added Oct 2, 2026 from the 420 Peyton invoices: dumpsters, porta-johns,
  // temporary power and locks, tools and protective gear; porches and driveways;
  // inspections, survey and closing costs (part of the lot's cost, not the build).
  { code: '28', name: 'General Conditions / Site Services', kind: 'construction' },
  { code: '29', name: 'Porch / Deck / Driveway', kind: 'construction' },
  { code: '30', name: 'Due Diligence / Closing Costs', kind: 'acquisition' },
  // Staging, listing photos and marketing: a cost of selling, not the build.
  { code: '31', name: 'Staging / Listing / Marketing', kind: 'selling' },
];

/** Management and contingency start as a percent of the construction subtotal. */
export const DEFAULT_PERCENTS: Record<string, string> = { '26': '13.87', '27': '5' };

export const HOLDING_KINDS = ['Interest', 'Property Taxes', 'Insurance', 'Utilities', 'HOA', 'Other'] as const;
