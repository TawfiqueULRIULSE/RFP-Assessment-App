import cors from 'cors';
import express from 'express';

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

const records = new Map();
const sessions = new Map();
const appConfig = {
  layerWeights: {
    L1: 0.55,
    L2: 0.3,
    L3: 0.15,
  },
  closeScoreThreshold: 0.03,
  confidenceBaseline: 100,
  confidenceVarianceImpact: 0.4,
  riskAdjustmentFloor: 0.7,
  riskAdjustmentScale: 0.3,
};

const createScoresForRecord = (rfpId, vendors, criteria) => {
  const l1 = assessorsWithAssignments.flatMap((assessor) =>
    vendors.flatMap((vendor) =>
      criteria
        .filter((criterion) => criterion.layer === 'L1')
        .map((criterion) => ({
          id: newId('score'),
          rfpId,
          vendorId: vendor.id,
          criterionId: criterion.id,
          layer: 'L1',
          ownerId: assessor.id,
          value: null,
          comment: '',
          updatedAt: nowIso(),
        })),
    ),
  );

  const l2l3 = vendors.flatMap((vendor) =>
    criteria
      .filter((criterion) => criterion.layer !== 'L1')
      .map((criterion) => ({
        id: newId('score'),
        rfpId,
        vendorId: vendor.id,
        criterionId: criterion.id,
        layer: criterion.layer,
        ownerId: users.owner.id,
        value: null,
        comment: '',
        updatedAt: nowIso(),
      })),
  );

  return [...l1, ...l2l3];
};

const createRecordStore = ({
  id,
  title,
  organization,
  dueDate,
  intakeMethod,
  intakeStatus,
  vendors,
  criteria,
}) => {
  const createdAt = nowIso();
  const rfp = {
    id,
    title,
    createdAt,
    primaryOwnerId: users.owner.id,
    organization,
    dueDate,
    intakeMethod,
    intakeStatus,
    updatedAt: createdAt,
  };

  return {
    rfp,
    vendors,
    criteria,
    scores: createScoresForRecord(rfp.id, vendors, criteria),
    comments: [],
    evidence: [],
    benchmarks: [],
    panelValidations: [],
    auditEvents: [],
    ingestJobs: [],
  };
};

const seedRecord = createRecordStore({
  id: 'rfp-2026-network-modernization',
  title: '2026 Network Modernization RFP',
  organization: 'City Infrastructure Office',
  dueDate: '',
  intakeMethod: 'create',
  intakeStatus: 'ready',
  vendors: seedVendors,
  criteria: seedCriteria,
});
records.set(seedRecord.rfp.id, seedRecord);

const buildAppUsers = () => [
  users.owner,
  ...users.assessors,
  ...users.panel,
];

const findUserById = (userId) => buildAppUsers().find((user) => user.id === userId);

const listRfps = () => Array.from(records.values()).map((record) => record.rfp);

const firstRecord = () => Array.from(records.values())[0] ?? null;

const findRecordById = (rfpId) => records.get(rfpId) ?? null;

const findRecordByScoreId = (scoreId) => {
  for (const record of records.values()) {
    const score = record.scores.find((entry) => entry.id === scoreId);
    if (score) {
      return { record, score };
    }
  }

  return null;
};

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

const resolveRequestedRecord = (req) => {
  const requestedRfpId = String(req.query.rfpId || req.body.rfpId || '').trim();

  if (requestedRfpId) {
    return findRecordById(requestedRfpId);
  }

  return firstRecord();
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
    const session = sessions.get(bearerToken);
    if (session) {
      return {
        id: session.id,
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

  const record = createRecordStore({
    id: newId('rfp'),
    title,
    organization,
    dueDate,
    intakeMethod: 'create',
    intakeStatus: 'draft',
    vendors: [],
    criteria: [],
  });

  records.set(record.rfp.id, record);
  res.status(201).json({ record: record.rfp });
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

  const record = findRecordById(req.params.rfpId);
  if (!requireRecord(record, res)) {
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
    rfpId: record.rfp.id,
    status: 'queued',
    fileName,
    fileType,
    createdAt,
    updatedAt: createdAt,
    generatedL1Draft: [],
  };

  record.ingestJobs.push(job);
  record.rfp.intakeMethod = 'ingest';
  record.rfp.intakeStatus = 'ingesting';
  record.rfp.updatedAt = nowIso();

  setTimeout(() => {
    const liveRecord = findRecordById(record.rfp.id);
    const liveJob = liveRecord?.ingestJobs.find((entry) => entry.id === job.id);

    if (!liveRecord || !liveJob) {
      return;
    }

    liveJob.status = 'processing';
    liveJob.updatedAt = nowIso();

    setTimeout(() => {
      const nextRecord = findRecordById(record.rfp.id);
      const nextJob = nextRecord?.ingestJobs.find((entry) => entry.id === job.id);

      if (!nextRecord || !nextJob) {
        return;
      }

      nextJob.status = 'ready';
      nextJob.generatedL1Draft = buildIngestDraft(nextJob.fileName);
      nextJob.updatedAt = nowIso();
      nextRecord.rfp.intakeStatus = 'ready';
      nextRecord.rfp.updatedAt = nowIso();
    }, 900);
  }, 450);

  res.status(201).json({ job });
});

app.get('/rfp-records/:rfpId/ingest-jobs/:jobId', (req, res) => {
  const record = findRecordById(req.params.rfpId);
  if (!requireRecord(record, res)) {
    return;
  }

  const job = record.ingestJobs.find((entry) => entry.id === req.params.jobId);
  if (!job) {
    res.status(404).json({ message: 'Ingest job not found.' });
    return;
  }

  res.json({ job });
});

app.post('/rfp-records/:rfpId/ingest-jobs/:jobId/apply-l1-draft', (req, res) => {
  const actor = requirePrimaryOwner(req, res);
  if (!actor) {
    return;
  }

  const record = findRecordById(req.params.rfpId);
  if (!requireRecord(record, res)) {
    return;
  }

  const job = record.ingestJobs.find((entry) => entry.id === req.params.jobId);
  if (!job) {
    res.status(404).json({ message: 'Ingest job not found.' });
    return;
  }

  if (job.status !== 'ready') {
    res.status(400).json({ message: 'Ingest job is not ready to apply.' });
    return;
  }

  const l1Criteria = job.generatedL1Draft.map((criterion) => ({ ...criterion }));
  record.criteria = ensureL2L3Criteria(l1Criteria);
  record.scores = createScoresForRecord(record.rfp.id, record.vendors, record.criteria);
  record.rfp.intakeStatus = 'ready';
  record.rfp.updatedAt = nowIso();

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
  sessions.set(token, { id: user.id, role: user.role });
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
    sessions.delete(token);
  }

  res.json({ ok: true });
});

app.get('/config', (_req, res) => {
  res.json({ config: appConfig });
});

app.put('/config', (req, res) => {
  const actor = resolveActor(req);
  if (actor.role !== 'Primary Owner') {
    res.status(403).json({ message: 'Only Primary Owner can edit config.' });
    return;
  }

  if (req.body.layerWeights) {
    appConfig.layerWeights = {
      L1: Number(req.body.layerWeights.L1 ?? appConfig.layerWeights.L1),
      L2: Number(req.body.layerWeights.L2 ?? appConfig.layerWeights.L2),
      L3: Number(req.body.layerWeights.L3 ?? appConfig.layerWeights.L3),
    };
  }

  appConfig.closeScoreThreshold = Number(req.body.closeScoreThreshold ?? appConfig.closeScoreThreshold);
  appConfig.confidenceBaseline = Number(req.body.confidenceBaseline ?? appConfig.confidenceBaseline);
  appConfig.confidenceVarianceImpact = Number(
    req.body.confidenceVarianceImpact ?? appConfig.confidenceVarianceImpact,
  );
  appConfig.riskAdjustmentFloor = Number(req.body.riskAdjustmentFloor ?? appConfig.riskAdjustmentFloor);
  appConfig.riskAdjustmentScale = Number(req.body.riskAdjustmentScale ?? appConfig.riskAdjustmentScale);

  res.json({ config: appConfig });
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
  const match = findRecordByScoreId(req.params.scoreId);

  if (!match) {
    res.status(404).json({ message: 'Score not found.' });
    return;
  }

  const { record, score } = match;

  if (!canWriteScore(actor, score)) {
    res.status(403).json({ message: 'Not authorized to update this score.' });
    return;
  }

  const nextValue = Object.prototype.hasOwnProperty.call(req.body, 'value') ? req.body.value : score.value;
  const nextComment = typeof req.body.comment === 'string' ? req.body.comment : score.comment;

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
    changedAt: nowIso(),
  };

  score.value = nextValue;
  score.comment = nextComment;
  score.updatedAt = auditEvent.changedAt;

  record.auditEvents.push(auditEvent);

  res.json({ score, auditEvent });
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

  const record = findRecordById(String(req.body.rfpId || '').trim());
  if (!requireRecord(record, res)) {
    return;
  }

  const comment = {
    id: newId('comment'),
    rfpId: record.rfp.id,
    vendorId: String(req.body.vendorId || ''),
    criterionId: String(req.body.criterionId || ''),
    scope: String(req.body.scope || 'general'),
    text: String(req.body.text || ''),
    authorId: actor.id,
    authorRole: actor.role,
    createdAt: nowIso(),
  };

  record.comments.push(comment);
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

  record.panelValidations.push(validation);
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

  const record = findRecordById(String(req.body.rfpId || '').trim());
  if (!requireRecord(record, res)) {
    return;
  }

  const item = {
    id: newId('evidence'),
    rfpId: record.rfp.id,
    vendorId: String(req.body.vendorId || ''),
    criterionId: String(req.body.criterionId || ''),
    title: String(req.body.title || ''),
    url: String(req.body.url || ''),
    attachmentName: String(req.body.attachmentName || ''),
    addedBy: String(req.body.addedBy || actor.id),
    addedAt: nowIso(),
  };

  record.evidence.push(item);
  res.status(201).json({ evidence: item });
});

app.get('/rfps/:rfpId/benchmarks', (req, res) => {
  const record = findRecordById(req.params.rfpId);
  if (!requireRecord(record, res)) {
    return;
  }

  res.json({ benchmarks: record.benchmarks });
});

app.post('/rfps/:rfpId/benchmarks', (req, res) => {
  const record = findRecordById(req.params.rfpId);
  if (!requireRecord(record, res)) {
    return;
  }

  const incoming = Array.isArray(req.body.benchmarks) ? req.body.benchmarks : [];
  const retained = [];

  for (const item of incoming) {
    retained.push({
      ...item,
      id: item.id || newId('benchmark'),
      rfpId: req.params.rfpId,
      recordedAt: item.recordedAt || nowIso(),
    });
  }

  record.benchmarks.splice(0, record.benchmarks.length, ...retained);
  res.status(201).json({ benchmarks: record.benchmarks });
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Mock API listening on http://localhost:${port}`);
});
