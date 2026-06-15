import cors from 'cors';
import express from 'express';
import {
  db,
  migrate,
  rfpFromRow,
  vendorFromRow,
  criterionFromRow,
  scoreFromRow,
  commentFromRow,
  evidenceFromRow,
  benchmarkFromRow,
  panelValidationFromRow,
  auditEventFromRow,
  ingestJobFromRow,
  configFromRow,
} from './db.js';

migrate();

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(cors());
app.use(express.json());

const nowIso = () => new Date().toISOString();
const newId = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const users = {
  owner: { id: 'owner-1', name: 'Avery Khan', role: 'Primary Owner' },
  assessors: [
    { id: 'assessor-1', name: 'Maya Patel', role: 'Assessor' },
    { id: 'assessor-2', name: 'Jon Lee', role: 'Assessor' },
    { id: 'assessor-3', name: 'Rita Chen', role: 'Assessor' },
  ],
  panel: [
    { id: 'panel-1', name: 'Nadia Brooks', role: 'Panel Reviewer' },
    { id: 'panel-2', name: 'Imran Sadiq', role: 'Panel Reviewer' },
  ],
};

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

const defaultL2L3Criteria = [
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

// ── Prepared statements ───────────────────────────────────────────────────────

const stmts = {
  insertRfp: db.prepare(`
    INSERT INTO rfps (id, title, organization, due_date, intake_method, intake_status,
                      primary_owner_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  updateRfpIntake: db.prepare(`
    UPDATE rfps SET intake_method=?, intake_status=?, updated_at=? WHERE id=?
  `),
  updateRfpIntakeStatus: db.prepare(`
    UPDATE rfps SET intake_status=?, updated_at=? WHERE id=?
  `),
  insertVendor: db.prepare('INSERT INTO vendors (id, rfp_id, name) VALUES (?, ?, ?)'),
  insertCriterion: db.prepare(`
    INSERT INTO criteria (id, rfp_id, layer, label, description) VALUES (?, ?, ?, ?, ?)
  `),
  deleteCriteria: db.prepare('DELETE FROM criteria WHERE rfp_id = ?'),
  insertScore: db.prepare(`
    INSERT INTO scores (id, rfp_id, vendor_id, criterion_id, layer, owner_id,
                        value, comment, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  deleteScores: db.prepare('DELETE FROM scores WHERE rfp_id = ?'),
  updateScore: db.prepare(`
    UPDATE scores SET value=?, comment=?, updated_at=? WHERE id=?
  `),
  insertAuditEvent: db.prepare(`
    INSERT INTO audit_events (id, rfp_id, score_id, vendor_id, criterion_id,
      changed_by_id, changed_by_role, old_value, new_value, old_comment, new_comment, changed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  insertComment: db.prepare(`
    INSERT INTO comments (id, rfp_id, vendor_id, criterion_id, scope, text,
                          author_id, author_role, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  insertEvidence: db.prepare(`
    INSERT INTO evidence (id, rfp_id, vendor_id, criterion_id, title, url,
                          attachment_name, added_by, added_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  deleteBenchmarks: db.prepare('DELETE FROM benchmarks WHERE rfp_id = ?'),
  insertBenchmark: db.prepare('INSERT INTO benchmarks (id, rfp_id, data) VALUES (?, ?, ?)'),
  insertPanelValidation: db.prepare(`
    INSERT INTO panel_validations (id, rfp_id, vendor_id, reviewer_id, decision, comment, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `),
  insertIngestJob: db.prepare(`
    INSERT INTO ingest_jobs (id, rfp_id, status, file_name, file_type,
                             generated_l1_draft, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `),
  updateIngestJobStatus: db.prepare(`
    UPDATE ingest_jobs SET status=?, updated_at=? WHERE id=?
  `),
  updateIngestJobReady: db.prepare(`
    UPDATE ingest_jobs SET status=?, generated_l1_draft=?, updated_at=? WHERE id=?
  `),
  insertSession: db.prepare(`
    INSERT INTO sessions (token, user_id, role, created_at) VALUES (?, ?, ?, ?)
  `),
  deleteSession: db.prepare('DELETE FROM sessions WHERE token = ?'),
  updateConfig: db.prepare(`
    UPDATE app_config
    SET layer_weights=?, close_score_threshold=?, confidence_baseline=?,
        confidence_variance_impact=?, risk_adjustment_floor=?, risk_adjustment_scale=?
    WHERE id=1
  `),
};

// ── Repository helpers ────────────────────────────────────────────────────────

const persistScoresForRecord = db.transaction((rfpId, vendors, criteria) => {
  stmts.deleteScores.run(rfpId);
  const ts = nowIso();

  for (const assessor of assessorsWithAssignments) {
    for (const vendor of vendors) {
      for (const criterion of criteria.filter((c) => c.layer === 'L1')) {
        stmts.insertScore.run(
          newId('score'), rfpId, vendor.id, criterion.id, 'L1',
          assessor.id, null, '', ts,
        );
      }
    }
  }

  for (const vendor of vendors) {
    for (const criterion of criteria.filter((c) => c.layer !== 'L1')) {
      stmts.insertScore.run(
        newId('score'), rfpId, vendor.id, criterion.id, criterion.layer,
        users.owner.id, null, '', ts,
      );
    }
  }
});

const buildAppUsers = () => [
  users.owner,
  ...users.assessors,
  ...users.panel,
];

const findUserById = (userId) => buildAppUsers().find((user) => user.id === userId);

const listRfps = () => db.prepare('SELECT * FROM rfps').all().map(rfpFromRow);

const firstRfpId = () => {
  const row = db.prepare('SELECT id FROM rfps LIMIT 1').get();
  return row?.id ?? null;
};

const loadRecord = (rfpId) => {
  const rfpRow = db.prepare('SELECT * FROM rfps WHERE id = ?').get(rfpId);
  if (!rfpRow) return null;

  return {
    rfp: rfpFromRow(rfpRow),
    vendors: db.prepare('SELECT * FROM vendors WHERE rfp_id = ?').all(rfpId).map(vendorFromRow),
    criteria: db.prepare('SELECT * FROM criteria WHERE rfp_id = ?').all(rfpId).map(criterionFromRow),
    scores: db.prepare('SELECT * FROM scores WHERE rfp_id = ?').all(rfpId).map(scoreFromRow),
    comments: db.prepare('SELECT * FROM comments WHERE rfp_id = ?').all(rfpId).map(commentFromRow),
    evidence: db.prepare('SELECT * FROM evidence WHERE rfp_id = ?').all(rfpId).map(evidenceFromRow),
    benchmarks: db.prepare('SELECT * FROM benchmarks WHERE rfp_id = ?').all(rfpId).map(benchmarkFromRow),
    panelValidations: db.prepare('SELECT * FROM panel_validations WHERE rfp_id = ?').all(rfpId).map(panelValidationFromRow),
    auditEvents: db.prepare('SELECT * FROM audit_events WHERE rfp_id = ?').all(rfpId).map(auditEventFromRow),
    ingestJobs: db.prepare('SELECT * FROM ingest_jobs WHERE rfp_id = ?').all(rfpId).map(ingestJobFromRow),
  };
};

const findRecordById = (rfpId) => loadRecord(rfpId);

const requirePrimaryOwner = (req, res) => {
  const actor = requireAuth(req, res);
  if (!actor) {
    return null;
  }

  if (actor.role !== 'Primary Owner') {
    res.status(403).json({ message: 'Only Primary Owner can perform this action.' });
    return null;
  }

  return actor;
};

const resolveRequestedRfpId = (req) => {
  const requestedRfpId = String(req.query.rfpId || req.body?.rfpId || '').trim();
  return requestedRfpId || firstRfpId();
};

const resolveRequestedRecord = (req) => {
  const rfpId = resolveRequestedRfpId(req);
  return rfpId ? findRecordById(rfpId) : null;
};

const requireRecord = (record, res) => {
  if (record) {
    return record;
  }

  res.status(404).json({ message: 'RFP record not found.' });
  return null;
};

const ensureL2L3Criteria = (criteria) => {
  const next = [...criteria];

  for (const criterion of defaultL2L3Criteria) {
    if (!next.some((entry) => entry.id === criterion.id)) {
      next.push({ ...criterion });
    }
  }

  return next;
};

const buildIngestDraft = (fileName) => {
  const cleaned = fileName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const suffix = cleaned || 'rfp';

  return [
    {
      id: `l1-${suffix}-solution-architecture`,
      layer: 'L1',
      label: 'Solution Architecture',
      description: `Generated from ${fileName}: architecture depth, extensibility, and technical fit.`,
    },
    {
      id: `l1-${suffix}-security-and-compliance`,
      layer: 'L1',
      label: 'Security and Compliance',
      description: `Generated from ${fileName}: controls, compliance coverage, and risk handling.`,
    },
    {
      id: `l1-${suffix}-implementation-and-delivery`,
      layer: 'L1',
      label: 'Implementation and Delivery',
      description: `Generated from ${fileName}: implementation feasibility, staffing model, and timeline confidence.`,
    },
  ];
};

const resolveActor = (req) => {
  const bearerToken = String(req.header('authorization') || '')
    .replace(/^Bearer\s+/i, '')
    .trim();

  if (bearerToken) {
    const session = db.prepare('SELECT * FROM sessions WHERE token = ?').get(bearerToken);
    if (session) {
      return {
        id: session.user_id,
        role: session.role,
      };
    }
  }

  return {
    id: String(req.header('x-user-id') || ''),
    role: String(req.header('x-role') || ''),
  };
};

const requireAuth = (req, res) => {
  const actor = resolveActor(req);
  if (!actor.id || !actor.role) {
    res.status(401).json({ message: 'Authentication required.' });
    return null;
  }

  return actor;
};

const canWriteScore = (actor, score) => {
  if (actor.role === 'Primary Owner') {
    return true;
  }

  if (actor.role !== 'Assessor') {
    return false;
  }

  if (score.layer !== 'L1' || score.ownerId !== actor.id) {
    return false;
  }

  const assessor = assessorsWithAssignments.find((item) => item.id === actor.id);
  return Boolean(assessor?.assignedCriterionIds.includes(score.criterionId));
};

app.get('/rfps', (_req, res) => {
  const record = resolveRequestedRecord(_req);

  if (!record) {
    res.status(404).json({ message: 'No RFP records available.' });
    return;
  }

  res.json({
    rfps: listRfps(),
    vendors: record.vendors,
    criteria: record.criteria,
    assessors: users.assessors,
    panelReviewers: users.panel,
    primaryOwner: users.owner,
  });
});

app.get('/rfp-records', (_req, res) => {
  res.json({ records: listRfps() });
});

app.post('/rfp-records', (req, res) => {
  const actor = requirePrimaryOwner(req, res);
  if (!actor) {
    return;
  }

  const title = String(req.body.title || '').trim();
  const organization = String(req.body.organization || '').trim();
  const dueDate = String(req.body.dueDate || '').trim();

  if (!title || !organization || !dueDate) {
    res.status(400).json({ message: 'title, organization, and dueDate are required.' });
    return;
  }

  const createdAt = nowIso();
  const rfp = {
    id: newId('rfp'),
    title,
    organization,
    dueDate,
    intakeMethod: 'create',
    intakeStatus: 'draft',
    primaryOwnerId: users.owner.id,
    createdAt,
    updatedAt: createdAt,
  };

  stmts.insertRfp.run(
    rfp.id, rfp.title, rfp.organization, rfp.dueDate,
    rfp.intakeMethod, rfp.intakeStatus, rfp.primaryOwnerId,
    rfp.createdAt, rfp.updatedAt,
  );

  res.status(201).json({ record: rfp });
});

app.get('/rfp-records/:rfpId', (req, res) => {
  const record = findRecordById(req.params.rfpId);
  if (!requireRecord(record, res)) {
    return;
  }

  res.json({ record: record.rfp });
});

app.post('/rfp-records/:rfpId/ingest-jobs', (req, res) => {
  const actor = requirePrimaryOwner(req, res);
  if (!actor) {
    return;
  }

  const rfpRow = db.prepare('SELECT * FROM rfps WHERE id = ?').get(req.params.rfpId);
  if (!rfpRow) {
    res.status(404).json({ message: 'RFP record not found.' });
    return;
  }

  const fileName = String(req.body.fileName || '').trim();
  const fileType = String(req.body.fileType || '').trim();

  if (!fileName || !fileType) {
    res.status(400).json({ message: 'fileName and fileType are required.' });
    return;
  }

  const createdAt = nowIso();
  const job = {
    id: newId('ingest-job'),
    rfpId: rfpRow.id,
    status: 'queued',
    fileName,
    fileType,
    createdAt,
    updatedAt: createdAt,
    generatedL1Draft: [],
  };

  stmts.insertIngestJob.run(
    job.id, job.rfpId, job.status, job.fileName, job.fileType,
    JSON.stringify(job.generatedL1Draft), job.createdAt, job.updatedAt,
  );
  stmts.updateRfpIntake.run('ingest', 'ingesting', nowIso(), rfpRow.id);

  setTimeout(() => {
    stmts.updateIngestJobStatus.run('processing', nowIso(), job.id);

    setTimeout(() => {
      const draft = buildIngestDraft(job.fileName);
      stmts.updateIngestJobReady.run('ready', JSON.stringify(draft), nowIso(), job.id);
      stmts.updateRfpIntakeStatus.run('ready', nowIso(), job.rfpId);
    }, 900);
  }, 450);

  res.status(201).json({ job });
});

app.get('/rfp-records/:rfpId/ingest-jobs/:jobId', (req, res) => {
  const rfpRow = db.prepare('SELECT id FROM rfps WHERE id = ?').get(req.params.rfpId);
  if (!rfpRow) {
    res.status(404).json({ message: 'RFP record not found.' });
    return;
  }

  const jobRow = db.prepare('SELECT * FROM ingest_jobs WHERE id = ? AND rfp_id = ?')
    .get(req.params.jobId, req.params.rfpId);
  if (!jobRow) {
    res.status(404).json({ message: 'Ingest job not found.' });
    return;
  }

  res.json({ job: ingestJobFromRow(jobRow) });
});

app.post('/rfp-records/:rfpId/ingest-jobs/:jobId/apply-l1-draft', (req, res) => {
  const actor = requirePrimaryOwner(req, res);
  if (!actor) {
    return;
  }

  const rfpRow = db.prepare('SELECT * FROM rfps WHERE id = ?').get(req.params.rfpId);
  if (!rfpRow) {
    res.status(404).json({ message: 'RFP record not found.' });
    return;
  }

  const jobRow = db.prepare('SELECT * FROM ingest_jobs WHERE id = ? AND rfp_id = ?')
    .get(req.params.jobId, req.params.rfpId);
  if (!jobRow) {
    res.status(404).json({ message: 'Ingest job not found.' });
    return;
  }

  if (jobRow.status !== 'ready') {
    res.status(400).json({ message: 'Ingest job is not ready to apply.' });
    return;
  }

  const generatedL1Draft = JSON.parse(jobRow.generated_l1_draft || '[]');
  const l1Criteria = generatedL1Draft.map((criterion) => ({ ...criterion }));
  const allCriteria = ensureL2L3Criteria(l1Criteria);
  const vendors = db.prepare('SELECT * FROM vendors WHERE rfp_id = ?').all(req.params.rfpId).map(vendorFromRow);

  const applyDraft = db.transaction(() => {
    stmts.deleteCriteria.run(req.params.rfpId);
    for (const c of allCriteria) {
      stmts.insertCriterion.run(c.id, req.params.rfpId, c.layer, c.label, c.description);
    }
    persistScoresForRecord(req.params.rfpId, vendors, allCriteria);
    stmts.updateRfpIntakeStatus.run('ready', nowIso(), req.params.rfpId);
  });
  applyDraft();

  res.status(201).json({ criteria: l1Criteria });
});

app.get('/auth/users', (_req, res) => {
  res.json({ users: buildAppUsers() });
});

app.post('/auth/login', (req, res) => {
  const userId = String(req.body.userId || '');
  const user = findUserById(userId);

  if (!user) {
    res.status(404).json({ message: 'User not found.' });
    return;
  }

  const token = newId('session');
  stmts.insertSession.run(token, user.id, user.role, nowIso());
  res.status(201).json({ token, user });
});

app.get('/auth/session', (req, res) => {
  const actor = requireAuth(req, res);
  if (!actor) {
    return;
  }

  const user = findUserById(actor.id);
  if (!user) {
    res.status(404).json({ message: 'Authenticated user not found.' });
    return;
  }

  res.json({ user });
});

app.post('/auth/logout', (req, res) => {
  const token = String(req.header('authorization') || '')
    .replace(/^Bearer\s+/i, '')
    .trim();

  if (token) {
    stmts.deleteSession.run(token);
  }

  res.json({ ok: true });
});

app.get('/config', (_req, res) => {
  const row = db.prepare('SELECT * FROM app_config WHERE id = 1').get();
  res.json({ config: configFromRow(row) });
});

app.put('/config', (req, res) => {
  const actor = resolveActor(req);
  if (actor.role !== 'Primary Owner') {
    res.status(403).json({ message: 'Only Primary Owner can edit config.' });
    return;
  }

  const current = configFromRow(db.prepare('SELECT * FROM app_config WHERE id = 1').get());

  const next = {
    layerWeights: current.layerWeights,
    closeScoreThreshold: Number(req.body.closeScoreThreshold ?? current.closeScoreThreshold),
    confidenceBaseline: Number(req.body.confidenceBaseline ?? current.confidenceBaseline),
    confidenceVarianceImpact: Number(req.body.confidenceVarianceImpact ?? current.confidenceVarianceImpact),
    riskAdjustmentFloor: Number(req.body.riskAdjustmentFloor ?? current.riskAdjustmentFloor),
    riskAdjustmentScale: Number(req.body.riskAdjustmentScale ?? current.riskAdjustmentScale),
  };

  if (req.body.layerWeights) {
    next.layerWeights = {
      L1: Number(req.body.layerWeights.L1 ?? current.layerWeights.L1),
      L2: Number(req.body.layerWeights.L2 ?? current.layerWeights.L2),
      L3: Number(req.body.layerWeights.L3 ?? current.layerWeights.L3),
    };
  }

  stmts.updateConfig.run(
    JSON.stringify(next.layerWeights),
    next.closeScoreThreshold,
    next.confidenceBaseline,
    next.confidenceVarianceImpact,
    next.riskAdjustmentFloor,
    next.riskAdjustmentScale,
  );

  res.json({ config: next });
});

app.get('/scores', (req, res) => {
  const record = resolveRequestedRecord(req);
  if (!requireRecord(record, res)) {
    return;
  }

  res.json({ scores: record.scores });
});

app.put('/scores/:scoreId', (req, res) => {
  const actor = requireAuth(req, res);
  if (!actor) {
    return;
  }

  const scoreRow = db.prepare('SELECT * FROM scores WHERE id = ?').get(req.params.scoreId);
  if (!scoreRow) {
    res.status(404).json({ message: 'Score not found.' });
    return;
  }

  const score = scoreFromRow(scoreRow);

  if (!canWriteScore(actor, score)) {
    res.status(403).json({ message: 'Not authorized to update this score.' });
    return;
  }

  const nextValue = Object.prototype.hasOwnProperty.call(req.body, 'value') ? req.body.value : score.value;
  const nextComment = typeof req.body.comment === 'string' ? req.body.comment : score.comment;
  const changedAt = nowIso();

  const auditEvent = {
    id: newId('audit'),
    rfpId: score.rfpId,
    scoreId: score.id,
    vendorId: score.vendorId,
    criterionId: score.criterionId,
    changedById: actor.id,
    changedByRole: actor.role,
    oldValue: score.value,
    newValue: nextValue,
    oldComment: score.comment,
    newComment: nextComment,
    changedAt,
  };

  stmts.updateScore.run(nextValue ?? null, nextComment, changedAt, score.id);
  stmts.insertAuditEvent.run(
    auditEvent.id, auditEvent.rfpId, auditEvent.scoreId, auditEvent.vendorId,
    auditEvent.criterionId, auditEvent.changedById, auditEvent.changedByRole,
    auditEvent.oldValue ?? null, auditEvent.newValue ?? null,
    auditEvent.oldComment, auditEvent.newComment, auditEvent.changedAt,
  );

  const updatedScore = { ...score, value: nextValue, comment: nextComment, updatedAt: changedAt };
  res.json({ score: updatedScore, auditEvent });
});

app.get('/audit', (req, res) => {
  const record = resolveRequestedRecord(req);
  if (!requireRecord(record, res)) {
    return;
  }

  res.json({ events: record.auditEvents });
});

app.get('/comments', (req, res) => {
  const record = resolveRequestedRecord(req);
  if (!requireRecord(record, res)) {
    return;
  }

  res.json({ comments: record.comments });
});

app.post('/comments', (req, res) => {
  const actor = requireAuth(req, res);
  if (!actor) {
    return;
  }

  const rfpId = String(req.body.rfpId || '').trim();
  const rfpRow = db.prepare('SELECT id FROM rfps WHERE id = ?').get(rfpId);
  if (!rfpRow) {
    res.status(404).json({ message: 'RFP record not found.' });
    return;
  }

  const comment = {
    id: newId('comment'),
    rfpId: rfpRow.id,
    vendorId: String(req.body.vendorId || ''),
    criterionId: String(req.body.criterionId || ''),
    scope: String(req.body.scope || 'general'),
    text: String(req.body.text || ''),
    authorId: actor.id,
    authorRole: actor.role,
    createdAt: nowIso(),
  };

  stmts.insertComment.run(
    comment.id, comment.rfpId, comment.vendorId, comment.criterionId,
    comment.scope, comment.text, comment.authorId, comment.authorRole, comment.createdAt,
  );
  res.status(201).json({ comment });
});

app.get('/panel-validations', (req, res) => {
  const record = resolveRequestedRecord(req);
  if (!requireRecord(record, res)) {
    return;
  }

  res.json({ validations: record.panelValidations });
});

app.post('/panel-validations', (req, res) => {
  const actor = requireAuth(req, res);
  if (!actor) {
    return;
  }

  if (actor.role !== 'Panel Reviewer') {
    res.status(403).json({ message: 'Only Panel Reviewer can submit validation.' });
    return;
  }

  if (!users.panel.some((reviewer) => reviewer.id === actor.id)) {
    res.status(403).json({ message: 'Authenticated user is not an assigned panel reviewer.' });
    return;
  }

  const rfpId = String(req.body.rfpId || '').trim();
  const vendorId = String(req.body.vendorId || '').trim();
  const decision = String(req.body.decision || '').trim();
  const comment = String(req.body.comment || '').trim();

  if (!rfpId) {
    res.status(400).json({ message: 'rfpId is required.' });
    return;
  }

  const record = findRecordById(rfpId);

  if (!record) {
    res.status(400).json({ message: 'Unknown rfpId.' });
    return;
  }

  if (!vendorId) {
    res.status(400).json({ message: 'vendorId is required.' });
    return;
  }

  if (!record.vendors.some((entry) => entry.id === vendorId)) {
    res.status(400).json({ message: 'Unknown vendorId.' });
    return;
  }

  if (decision !== 'approved' && decision !== 'commented') {
    res.status(400).json({ message: 'decision must be approved or commented.' });
    return;
  }

  if (decision === 'commented' && !comment) {
    res.status(400).json({ message: 'comment is required when decision is commented.' });
    return;
  }

  const validation = {
    id: newId('panel-validation'),
    rfpId,
    vendorId,
    reviewerId: actor.id,
    decision,
    comment,
    createdAt: nowIso(),
  };

  stmts.insertPanelValidation.run(
    validation.id, validation.rfpId, validation.vendorId,
    validation.reviewerId, validation.decision, validation.comment, validation.createdAt,
  );
  res.status(201).json({ validation });
});

app.get('/evidence', (req, res) => {
  const record = resolveRequestedRecord(req);
  if (!requireRecord(record, res)) {
    return;
  }

  res.json({ evidence: record.evidence });
});

app.post('/evidence', (req, res) => {
  const actor = requireAuth(req, res);
  if (!actor) {
    return;
  }

  if (actor.role !== 'Primary Owner') {
    res.status(403).json({ message: 'Only Primary Owner can add evidence.' });
    return;
  }

  const rfpId = String(req.body.rfpId || '').trim();
  const rfpRow = db.prepare('SELECT id FROM rfps WHERE id = ?').get(rfpId);
  if (!rfpRow) {
    res.status(404).json({ message: 'RFP record not found.' });
    return;
  }

  const item = {
    id: newId('evidence'),
    rfpId: rfpRow.id,
    vendorId: String(req.body.vendorId || ''),
    criterionId: String(req.body.criterionId || ''),
    title: String(req.body.title || ''),
    url: String(req.body.url || ''),
    attachmentName: String(req.body.attachmentName || ''),
    addedBy: String(req.body.addedBy || actor.id),
    addedAt: nowIso(),
  };

  stmts.insertEvidence.run(
    item.id, item.rfpId, item.vendorId, item.criterionId,
    item.title, item.url, item.attachmentName, item.addedBy, item.addedAt,
  );
  res.status(201).json({ evidence: item });
});

app.get('/rfps/:rfpId/benchmarks', (req, res) => {
  const rfpRow = db.prepare('SELECT id FROM rfps WHERE id = ?').get(req.params.rfpId);
  if (!rfpRow) {
    res.status(404).json({ message: 'RFP record not found.' });
    return;
  }

  const benchmarks = db.prepare('SELECT * FROM benchmarks WHERE rfp_id = ?')
    .all(req.params.rfpId).map(benchmarkFromRow);
  res.json({ benchmarks });
});

app.post('/rfps/:rfpId/benchmarks', (req, res) => {
  const rfpRow = db.prepare('SELECT id FROM rfps WHERE id = ?').get(req.params.rfpId);
  if (!rfpRow) {
    res.status(404).json({ message: 'RFP record not found.' });
    return;
  }

  const incoming = Array.isArray(req.body.benchmarks) ? req.body.benchmarks : [];
  const retained = incoming.map((item) => ({
    ...item,
    id: item.id || newId('benchmark'),
    rfpId: req.params.rfpId,
    recordedAt: item.recordedAt || nowIso(),
  }));

  const replaceBenchmarks = db.transaction(() => {
    stmts.deleteBenchmarks.run(req.params.rfpId);
    for (const item of retained) {
      stmts.insertBenchmark.run(item.id, req.params.rfpId, JSON.stringify(item));
    }
  });
  replaceBenchmarks();

  res.status(201).json({ benchmarks: retained });
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Mock API listening on http://localhost:${port}`);
});
