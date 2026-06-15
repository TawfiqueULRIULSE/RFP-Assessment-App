import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { app } from '../index.js';

const request = supertest(app);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Login as a specific user and return the bearer token. */
const loginAs = async (userId: string): Promise<string> => {
  const res = await request.post('/auth/login').send({ userId });
  expect(res.status).toBe(201);
  return res.body.token as string;
};

/** Return auth headers for the given bearer token. */
const bearer = (token: string): Record<string, string> => ({ Authorization: 'Bearer ' + token });

// ─── Auth flow ────────────────────────────────────────────────────────────────

describe('Auth', () => {
  it('GET /auth/users returns all users', async () => {
    const res = await request.get('/auth/users');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
    expect(res.body.users.length).toBeGreaterThan(0);
  });

  it('POST /auth/login succeeds for a known userId', async () => {
    const res = await request.post('/auth/login').send({ userId: 'owner-1' });
    expect(res.status).toBe(201);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user.id).toBe('owner-1');
  });

  it('POST /auth/login returns 404 for an unknown userId', async () => {
    const res = await request.post('/auth/login').send({ userId: 'no-such-user' });
    expect(res.status).toBe(404);
  });

  it('GET /auth/session returns the user for a valid token', async () => {
    const token = await loginAs('owner-1');
    const res = await request.get('/auth/session').set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe('owner-1');
  });

  it('GET /auth/session returns 401 without a token', async () => {
    const res = await request.get('/auth/session');
    expect(res.status).toBe(401);
  });

  it('GET /auth/session returns 401 with an invalid token', async () => {
    const res = await request.get('/auth/session').set({ Authorization: '******' });
    expect(res.status).toBe(401);
  });

  it('POST /auth/logout invalidates the session', async () => {
    const token = await loginAs('owner-1');

    // Session is valid before logout
    const before = await request.get('/auth/session').set(bearer(token));
    expect(before.status).toBe(200);

    // Logout
    const logoutRes = await request.post('/auth/logout').set(bearer(token));
    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.ok).toBe(true);

    // Session is no longer valid
    const after = await request.get('/auth/session').set(bearer(token));
    expect(after.status).toBe(401);
  });
});

// ─── Score update ─────────────────────────────────────────────────────────────

describe('Score update (PUT /scores/:scoreId)', () => {
  let ownerToken: string;
  let assessor1Token: string;
  let panelToken: string;

  beforeAll(async () => {
    ownerToken = await loginAs('owner-1');
    assessor1Token = await loginAs('assessor-1');
    panelToken = await loginAs('panel-1');
  });

  /** Fetch a score from the default RFP matching the given predicate. */
  const findScore = async (
    predicate: (s: { layer: string; ownerId: string; criterionId: string }) => boolean,
  ) => {
    const res = await request.get('/scores').set(bearer(ownerToken));
    expect(res.status).toBe(200);
    return (res.body.scores as Array<{ id: string; layer: string; ownerId: string; criterionId: string }>).find(
      predicate,
    );
  };

  it('Primary Owner can update any score', async () => {
    const score = await findScore((s) => s.layer === 'L1');
    expect(score).toBeDefined();
    const res = await request.put(`/scores/${score!.id}`).set(bearer(ownerToken)).send({ value: 75 });
    expect(res.status).toBe(200);
    expect(res.body.score.value).toBe(75);
    expect(res.body.auditEvent).toBeDefined();
  });

  it('Assessor can update their own assigned L1 score', async () => {
    const score = await findScore((s) => s.layer === 'L1' && s.ownerId === 'assessor-1');
    expect(score).toBeDefined();
    const res = await request.put(`/scores/${score!.id}`).set(bearer(assessor1Token)).send({ value: 85 });
    expect(res.status).toBe(200);
    expect(res.body.score.value).toBe(85);
  });

  it('Assessor cannot update an L1 score owned by a different assessor', async () => {
    const score = await findScore((s) => s.layer === 'L1' && s.ownerId === 'assessor-2');
    expect(score).toBeDefined();
    const res = await request.put(`/scores/${score!.id}`).set(bearer(assessor1Token)).send({ value: 50 });
    expect(res.status).toBe(403);
  });

  it('Panel Reviewer cannot update any score', async () => {
    const score = await findScore((s) => s.layer === 'L1');
    expect(score).toBeDefined();
    const res = await request.put(`/scores/${score!.id}`).set(bearer(panelToken)).send({ value: 60 });
    expect(res.status).toBe(403);
  });

  it('returns 404 for a non-existent score ID', async () => {
    const res = await request.put('/scores/score-does-not-exist').set(bearer(ownerToken)).send({ value: 50 });
    expect(res.status).toBe(404);
  });

  it('returns 401 when no auth is provided', async () => {
    const score = await findScore((s) => s.layer === 'L1');
    expect(score).toBeDefined();
    const res = await request.put(`/scores/${score!.id}`).send({ value: 50 });
    expect(res.status).toBe(401);
  });

  it('updates the comment field independently', async () => {
    const score = await findScore((s) => s.layer === 'L1');
    expect(score).toBeDefined();
    const res = await request
      .put(`/scores/${score!.id}`)
      .set(bearer(ownerToken))
      .send({ comment: 'Updated comment text' });
    expect(res.status).toBe(200);
    expect(res.body.score.comment).toBe('Updated comment text');
  });
});

// ─── Panel validation ─────────────────────────────────────────────────────────

describe('Panel validation (POST /panel-validations)', () => {
  let panelToken: string;
  let ownerToken: string;
  let rfpId: string;
  let vendorId: string;

  beforeAll(async () => {
    panelToken = await loginAs('panel-1');
    ownerToken = await loginAs('owner-1');

    // Resolve the seeded RFP and pick a vendor from it
    const rfpRes = await request.get('/rfps').set(bearer(ownerToken));
    expect(rfpRes.status).toBe(200);
    rfpId = rfpRes.body.rfps[0].id as string;
    vendorId = (rfpRes.body.vendors as Array<{ id: string }>)[0].id;
  });

  it('Panel Reviewer can submit an approved validation', async () => {
    const res = await request
      .post('/panel-validations')
      .set(bearer(panelToken))
      .send({ rfpId, vendorId, decision: 'approved', comment: '' });
    expect(res.status).toBe(201);
    expect(res.body.validation.decision).toBe('approved');
    expect(res.body.validation.reviewerId).toBe('panel-1');
  });

  it('Panel Reviewer can submit a commented validation with a comment', async () => {
    const res = await request
      .post('/panel-validations')
      .set(bearer(panelToken))
      .send({ rfpId, vendorId, decision: 'commented', comment: 'Needs further review' });
    expect(res.status).toBe(201);
    expect(res.body.validation.decision).toBe('commented');
  });

  it('returns 400 when decision is "commented" but comment is empty', async () => {
    const res = await request
      .post('/panel-validations')
      .set(bearer(panelToken))
      .send({ rfpId, vendorId, decision: 'commented', comment: '' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for an unknown vendorId', async () => {
    const res = await request
      .post('/panel-validations')
      .set(bearer(panelToken))
      .send({ rfpId, vendorId: 'vendor-unknown', decision: 'approved', comment: '' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for an unknown rfpId', async () => {
    const res = await request
      .post('/panel-validations')
      .set(bearer(panelToken))
      .send({ rfpId: 'rfp-unknown', vendorId, decision: 'approved', comment: '' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for an invalid decision value', async () => {
    const res = await request
      .post('/panel-validations')
      .set(bearer(panelToken))
      .send({ rfpId, vendorId, decision: 'rejected', comment: '' });
    expect(res.status).toBe(400);
  });

  it('Primary Owner cannot submit panel validation', async () => {
    const res = await request
      .post('/panel-validations')
      .set(bearer(ownerToken))
      .send({ rfpId, vendorId, decision: 'approved', comment: '' });
    expect(res.status).toBe(403);
  });

  it('returns 401 without authentication', async () => {
    const res = await request
      .post('/panel-validations')
      .send({ rfpId, vendorId, decision: 'approved', comment: '' });
    expect(res.status).toBe(401);
  });
});

// ─── Ingest lifecycle ─────────────────────────────────────────────────────────

describe('Ingest lifecycle', () => {
  let ownerToken: string;
  let rfpId: string;

  beforeAll(async () => {
    ownerToken = await loginAs('owner-1');

    // Create a new RFP record to work with
    const createRes = await request
      .post('/rfp-records')
      .set(bearer(ownerToken))
      .send({ title: 'Ingest Test RFP', organization: 'Test Org', dueDate: '2026-12-31' });
    expect(createRes.status).toBe(201);
    rfpId = createRes.body.record.id as string;
  });

  it('creates an ingest job and returns queued status', async () => {
    const res = await request
      .post(`/rfp-records/${rfpId}/ingest-jobs`)
      .set(bearer(ownerToken))
      .send({ fileName: 'rfp-document.pdf', fileType: 'application/pdf' });
    expect(res.status).toBe(201);
    expect(res.body.job.status).toBe('queued');
    expect(res.body.job.rfpId).toBe(rfpId);
  });

  it('returns 400 when fileName is missing', async () => {
    const res = await request
      .post(`/rfp-records/${rfpId}/ingest-jobs`)
      .set(bearer(ownerToken))
      .send({ fileType: 'application/pdf' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when fileType is missing', async () => {
    const res = await request
      .post(`/rfp-records/${rfpId}/ingest-jobs`)
      .set(bearer(ownerToken))
      .send({ fileName: 'file.pdf' });
    expect(res.status).toBe(400);
  });

  it('can poll the job status', async () => {
    const createRes = await request
      .post(`/rfp-records/${rfpId}/ingest-jobs`)
      .set(bearer(ownerToken))
      .send({ fileName: 'poll-test.pdf', fileType: 'application/pdf' });
    expect(createRes.status).toBe(201);
    const jobId = createRes.body.job.id as string;

    const pollRes = await request.get(`/rfp-records/${rfpId}/ingest-jobs/${jobId}`).set(bearer(ownerToken));
    expect(pollRes.status).toBe(200);
    expect(pollRes.body.job.id).toBe(jobId);
  });

  it('returns 404 when polling an unknown job ID', async () => {
    const res = await request.get(`/rfp-records/${rfpId}/ingest-jobs/no-such-job`).set(bearer(ownerToken));
    expect(res.status).toBe(404);
  });

  it('applies the draft L1 criteria once the job is ready', async () => {
    // Create job and wait for it to transition to "ready"
    const createRes = await request
      .post(`/rfp-records/${rfpId}/ingest-jobs`)
      .set(bearer(ownerToken))
      .send({ fileName: 'apply-test.pdf', fileType: 'application/pdf' });
    expect(createRes.status).toBe(201);
    const jobId = createRes.body.job.id as string;

    // Poll until ready (max ~2 seconds with 100 ms intervals)
    let job: { status: string } = { status: 'queued' };
    for (let i = 0; i < 20; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const poll = await request.get(`/rfp-records/${rfpId}/ingest-jobs/${jobId}`).set(bearer(ownerToken));
      job = poll.body.job as { status: string };
      if (job.status === 'ready') break;
    }
    expect(job.status).toBe('ready');

    // Apply the draft
    const applyRes = await request
      .post(`/rfp-records/${rfpId}/ingest-jobs/${jobId}/apply-l1-draft`)
      .set(bearer(ownerToken))
      .send({});
    expect(applyRes.status).toBe(201);
    expect(Array.isArray(applyRes.body.criteria)).toBe(true);
    expect((applyRes.body.criteria as unknown[]).length).toBeGreaterThan(0);
  });

  it('returns 400 when applying a draft that is not yet ready', async () => {
    const createRes = await request
      .post(`/rfp-records/${rfpId}/ingest-jobs`)
      .set(bearer(ownerToken))
      .send({ fileName: 'not-ready.pdf', fileType: 'application/pdf' });
    expect(createRes.status).toBe(201);
    const jobId = createRes.body.job.id as string;

    // Try to apply immediately (job is still queued/processing)
    const applyRes = await request
      .post(`/rfp-records/${rfpId}/ingest-jobs/${jobId}/apply-l1-draft`)
      .set(bearer(ownerToken))
      .send({});
    expect(applyRes.status).toBe(400);
  });

  it('Non-owner cannot create ingest job', async () => {
    const panelToken = await loginAs('panel-1');
    const res = await request
      .post(`/rfp-records/${rfpId}/ingest-jobs`)
      .set(bearer(panelToken))
      .send({ fileName: 'rfp.pdf', fileType: 'application/pdf' });
    expect(res.status).toBe(403);
  });
});
