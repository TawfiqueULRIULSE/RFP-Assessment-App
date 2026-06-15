import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'rfp_app.db');

export const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * Runs all CREATE TABLE IF NOT EXISTS statements.
 * Safe to call on every startup — fully idempotent.
 */
export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS rfps (
      id              TEXT PRIMARY KEY,
      title           TEXT NOT NULL,
      organization    TEXT NOT NULL,
      due_date        TEXT NOT NULL DEFAULT '',
      intake_method   TEXT NOT NULL DEFAULT 'create',
      intake_status   TEXT NOT NULL DEFAULT 'draft',
      primary_owner_id TEXT NOT NULL,
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vendors (
      id      TEXT PRIMARY KEY,
      rfp_id  TEXT NOT NULL REFERENCES rfps(id) ON DELETE CASCADE,
      name    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS criteria (
      id          TEXT PRIMARY KEY,
      rfp_id      TEXT NOT NULL REFERENCES rfps(id) ON DELETE CASCADE,
      layer       TEXT NOT NULL,
      label       TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS scores (
      id           TEXT PRIMARY KEY,
      rfp_id       TEXT NOT NULL REFERENCES rfps(id) ON DELETE CASCADE,
      vendor_id    TEXT NOT NULL,
      criterion_id TEXT NOT NULL,
      layer        TEXT NOT NULL,
      owner_id     TEXT NOT NULL,
      value        REAL,
      comment      TEXT NOT NULL DEFAULT '',
      updated_at   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS comments (
      id           TEXT PRIMARY KEY,
      rfp_id       TEXT NOT NULL REFERENCES rfps(id) ON DELETE CASCADE,
      vendor_id    TEXT NOT NULL DEFAULT '',
      criterion_id TEXT NOT NULL DEFAULT '',
      scope        TEXT NOT NULL DEFAULT 'general',
      text         TEXT NOT NULL DEFAULT '',
      author_id    TEXT NOT NULL,
      author_role  TEXT NOT NULL,
      created_at   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS evidence (
      id              TEXT PRIMARY KEY,
      rfp_id          TEXT NOT NULL REFERENCES rfps(id) ON DELETE CASCADE,
      vendor_id       TEXT NOT NULL DEFAULT '',
      criterion_id    TEXT NOT NULL DEFAULT '',
      title           TEXT NOT NULL DEFAULT '',
      url             TEXT NOT NULL DEFAULT '',
      attachment_name TEXT NOT NULL DEFAULT '',
      added_by        TEXT NOT NULL,
      added_at        TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS benchmarks (
      id         TEXT PRIMARY KEY,
      rfp_id     TEXT NOT NULL REFERENCES rfps(id) ON DELETE CASCADE,
      data       TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS panel_validations (
      id          TEXT PRIMARY KEY,
      rfp_id      TEXT NOT NULL REFERENCES rfps(id) ON DELETE CASCADE,
      vendor_id   TEXT NOT NULL,
      reviewer_id TEXT NOT NULL,
      decision    TEXT NOT NULL,
      comment     TEXT NOT NULL DEFAULT '',
      created_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_events (
      id              TEXT PRIMARY KEY,
      rfp_id          TEXT NOT NULL REFERENCES rfps(id) ON DELETE CASCADE,
      score_id        TEXT NOT NULL,
      vendor_id       TEXT NOT NULL,
      criterion_id    TEXT NOT NULL,
      changed_by_id   TEXT NOT NULL,
      changed_by_role TEXT NOT NULL,
      old_value       REAL,
      new_value       REAL,
      old_comment     TEXT NOT NULL DEFAULT '',
      new_comment     TEXT NOT NULL DEFAULT '',
      changed_at      TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ingest_jobs (
      id                  TEXT PRIMARY KEY,
      rfp_id              TEXT NOT NULL REFERENCES rfps(id) ON DELETE CASCADE,
      status              TEXT NOT NULL DEFAULT 'queued',
      file_name           TEXT NOT NULL,
      file_type           TEXT NOT NULL,
      generated_l1_draft  TEXT NOT NULL DEFAULT '[]',
      created_at          TEXT NOT NULL,
      updated_at          TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token      TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL,
      role       TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_config (
      id                        INTEGER PRIMARY KEY,
      layer_weights             TEXT NOT NULL DEFAULT '{"L1":0.55,"L2":0.3,"L3":0.15}',
      close_score_threshold     REAL NOT NULL DEFAULT 0.03,
      confidence_baseline       REAL NOT NULL DEFAULT 100,
      confidence_variance_impact REAL NOT NULL DEFAULT 0.4,
      risk_adjustment_floor     REAL NOT NULL DEFAULT 0.7,
      risk_adjustment_scale     REAL NOT NULL DEFAULT 0.3
    );
  `);

  // Ensure the single app_config row exists with default values
  db.prepare(`
    INSERT OR IGNORE INTO app_config
      (id, layer_weights, close_score_threshold, confidence_baseline,
       confidence_variance_impact, risk_adjustment_floor, risk_adjustment_scale)
    VALUES (1, '{"L1":0.55,"L2":0.3,"L3":0.15}', 0.03, 100, 0.4, 0.7, 0.3)
  `).run();
}

// ── Row → domain-object transformers ─────────────────────────────────────────

export function rfpFromRow(row) {
  return {
    id: row.id,
    title: row.title,
    organization: row.organization,
    dueDate: row.due_date,
    intakeMethod: row.intake_method,
    intakeStatus: row.intake_status,
    primaryOwnerId: row.primary_owner_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function vendorFromRow(row) {
  return { id: row.id, name: row.name };
}

export function criterionFromRow(row) {
  return {
    id: row.id,
    layer: row.layer,
    label: row.label,
    description: row.description,
  };
}

export function scoreFromRow(row) {
  return {
    id: row.id,
    rfpId: row.rfp_id,
    vendorId: row.vendor_id,
    criterionId: row.criterion_id,
    layer: row.layer,
    ownerId: row.owner_id,
    value: row.value,
    comment: row.comment,
    updatedAt: row.updated_at,
  };
}

export function commentFromRow(row) {
  return {
    id: row.id,
    rfpId: row.rfp_id,
    vendorId: row.vendor_id,
    criterionId: row.criterion_id,
    scope: row.scope,
    text: row.text,
    authorId: row.author_id,
    authorRole: row.author_role,
    createdAt: row.created_at,
  };
}

export function evidenceFromRow(row) {
  return {
    id: row.id,
    rfpId: row.rfp_id,
    vendorId: row.vendor_id,
    criterionId: row.criterion_id,
    title: row.title,
    url: row.url,
    attachmentName: row.attachment_name,
    addedBy: row.added_by,
    addedAt: row.added_at,
  };
}

export function benchmarkFromRow(row) {
  try {
    return JSON.parse(row.data);
  } catch {
    return { id: row.id, rfpId: row.rfp_id };
  }
}

export function panelValidationFromRow(row) {
  return {
    id: row.id,
    rfpId: row.rfp_id,
    vendorId: row.vendor_id,
    reviewerId: row.reviewer_id,
    decision: row.decision,
    comment: row.comment,
    createdAt: row.created_at,
  };
}

export function auditEventFromRow(row) {
  return {
    id: row.id,
    rfpId: row.rfp_id,
    scoreId: row.score_id,
    vendorId: row.vendor_id,
    criterionId: row.criterion_id,
    changedById: row.changed_by_id,
    changedByRole: row.changed_by_role,
    oldValue: row.old_value,
    newValue: row.new_value,
    oldComment: row.old_comment,
    newComment: row.new_comment,
    changedAt: row.changed_at,
  };
}

export function ingestJobFromRow(row) {
  let generatedL1Draft = [];
  try {
    generatedL1Draft = JSON.parse(row.generated_l1_draft || '[]');
  } catch {
    generatedL1Draft = [];
  }
  return {
    id: row.id,
    rfpId: row.rfp_id,
    status: row.status,
    fileName: row.file_name,
    fileType: row.file_type,
    generatedL1Draft,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function configFromRow(row) {
  let layerWeights = { L1: 0.55, L2: 0.3, L3: 0.15 };
  try {
    layerWeights = JSON.parse(row.layer_weights);
  } catch {
    layerWeights = { L1: 0.55, L2: 0.3, L3: 0.15 };
  }
  return {
    layerWeights,
    closeScoreThreshold: row.close_score_threshold,
    confidenceBaseline: row.confidence_baseline,
    confidenceVarianceImpact: row.confidence_variance_impact,
    riskAdjustmentFloor: row.risk_adjustment_floor,
    riskAdjustmentScale: row.risk_adjustment_scale,
  };
}
