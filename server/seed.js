/**
 * Seed script — initialises demo data.
 * Usage: npm run db:seed
 *
 * Idempotent: existing demo data is skipped, not duplicated.
 */

import { db, migrate } from './db.js';

migrate();

// ── Static reference data ─────────────────────────────────────────────────────

const OWNER_ID = 'owner-1';
const SEED_RFP_ID = 'rfp-2026-network-modernization';

const nowIso = () => new Date().toISOString();
const newId = (prefix) => `${prefix}-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;

const seedVendors = [
  { id: 'vendor-northstar', name: 'Northstar Systems' },
  { id: 'vendor-quanta', name: 'Quanta Grid' },
  { id: 'vendor-apex', name: 'Apex Dynamics' },
];

const seedCriteria = [
  {
    id: 'l1-architecture',
    layer: 'L1',
    label: 'Architecture Quality',
    description: 'Scalability, resilience, and technical fit.',
  },
  {
    id: 'l1-security',
    layer: 'L1',
    label: 'Security Posture',
    description: 'Security controls and compliance readiness.',
  },
  {
    id: 'l1-delivery',
    layer: 'L1',
    label: 'Delivery Plan',
    description: 'Execution practicality, staffing, and timeline.',
  },
  {
    id: 'l2-commercial',
    layer: 'L2',
    label: 'Commercial Terms',
    description: 'Commercial flexibility and contractual alignment.',
  },
  {
    id: 'l3-familiarity',
    layer: 'L3',
    label: 'Domain Familiarity',
    description: 'Institutional familiarity and prior outcomes.',
  },
];

const assessorsWithAssignments = [
  {
    id: 'assessor-1',
    weight: 0.4,
    assignedCriterionIds: ['l1-architecture', 'l1-security', 'l1-delivery'],
  },
  {
    id: 'assessor-2',
    weight: 0.35,
    assignedCriterionIds: ['l1-architecture', 'l1-security', 'l1-delivery'],
  },
  {
    id: 'assessor-3',
    weight: 0.25,
    assignedCriterionIds: ['l1-architecture', 'l1-security', 'l1-delivery'],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildScores(rfpId, vendors, criteria) {
  const l1 = assessorsWithAssignments.flatMap((assessor) =>
    vendors.flatMap((vendor) =>
      criteria
        .filter((c) => c.layer === 'L1')
        .map((criterion) => ({
          id: newId('score'),
          rfp_id: rfpId,
          vendor_id: vendor.id,
          criterion_id: criterion.id,
          layer: 'L1',
          owner_id: assessor.id,
          value: null,
          comment: '',
          updated_at: nowIso(),
        })),
    ),
  );

  const l2l3 = vendors.flatMap((vendor) =>
    criteria
      .filter((c) => c.layer !== 'L1')
      .map((criterion) => ({
        id: newId('score'),
        rfp_id: rfpId,
        vendor_id: vendor.id,
        criterion_id: criterion.id,
        layer: criterion.layer,
        owner_id: OWNER_ID,
        value: null,
        comment: '',
        updated_at: nowIso(),
      })),
  );

  return [...l1, ...l2l3];
}

// ── Seed ─────────────────────────────────────────────────────────────────────

const existing = db.prepare('SELECT id FROM rfps WHERE id = ?').get(SEED_RFP_ID);

if (existing) {
  // eslint-disable-next-line no-console
  console.log(`Seed data already present (rfp id: ${SEED_RFP_ID}). Nothing to do.`);
  process.exit(0);
}

const createdAt = nowIso();

const insertAll = db.transaction(() => {
  db.prepare(`
    INSERT INTO rfps (id, title, organization, due_date, intake_method, intake_status,
                      primary_owner_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    SEED_RFP_ID,
    '2026 Network Modernization RFP',
    'City Infrastructure Office',
    '',
    'create',
    'ready',
    OWNER_ID,
    createdAt,
    createdAt,
  );

  const insertVendor = db.prepare('INSERT INTO vendors (id, rfp_id, name) VALUES (?, ?, ?)');
  for (const v of seedVendors) {
    insertVendor.run(v.id, SEED_RFP_ID, v.name);
  }

  const insertCriterion = db.prepare(`
    INSERT INTO criteria (id, rfp_id, layer, label, description) VALUES (?, ?, ?, ?, ?)
  `);
  for (const c of seedCriteria) {
    insertCriterion.run(c.id, SEED_RFP_ID, c.layer, c.label, c.description);
  }

  const scores = buildScores(SEED_RFP_ID, seedVendors, seedCriteria);
  const insertScore = db.prepare(`
    INSERT INTO scores (id, rfp_id, vendor_id, criterion_id, layer, owner_id,
                        value, comment, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const s of scores) {
    insertScore.run(
      s.id, s.rfp_id, s.vendor_id, s.criterion_id, s.layer, s.owner_id,
      s.value, s.comment, s.updated_at,
    );
  }
});

insertAll();

// eslint-disable-next-line no-console
console.log(`Seed complete. Demo RFP "${SEED_RFP_ID}" created with ${seedVendors.length} vendors, ${seedCriteria.length} criteria.`);
