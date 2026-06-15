import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from './index.js';

// Helper: obtain a real session token by logging in as a specific user.
const loginAs = async (userId) => {
  const res = await request(app)
    .post('/auth/login')
    .send({ userId });
  return res.body.token;
};

describe('Authentication hardening', () => {
  describe('401 without token', () => {
    it('PUT /config returns 401 with no credentials', async () => {
      const res = await request(app).put('/config').send({});
      expect(res.status).toBe(401);
    });

    it('POST /rfp-records returns 401 with no credentials', async () => {
      const res = await request(app)
        .post('/rfp-records')
        .send({ title: 'T', organization: 'O', dueDate: '2026-01-01' });
      expect(res.status).toBe(401);
    });

    it('PUT /scores/:scoreId returns 401 with no credentials', async () => {
      const res = await request(app).put('/scores/nonexistent-score').send({ value: 5 });
      expect(res.status).toBe(401);
    });

    it('POST /comments returns 401 with no credentials', async () => {
      const res = await request(app).post('/comments').send({});
      expect(res.status).toBe(401);
    });

    it('POST /panel-validations returns 401 with no credentials', async () => {
      const res = await request(app).post('/panel-validations').send({});
      expect(res.status).toBe(401);
    });

    it('POST /evidence returns 401 with no credentials', async () => {
      const res = await request(app).post('/evidence').send({});
      expect(res.status).toBe(401);
    });
  });

  describe('Header impersonation is blocked outside development', () => {
    // NODE_ENV defaults to 'test' in this suite, so x-user-id / x-role must NOT grant access.
    it('PUT /config ignores spoofed x-role header and returns 401', async () => {
      const res = await request(app)
        .put('/config')
        .set('x-user-id', 'owner-1')
        .set('x-role', 'Primary Owner')
        .send({});
      expect(res.status).toBe(401);
    });

    it('POST /rfp-records ignores spoofed role headers and returns 401', async () => {
      const res = await request(app)
        .post('/rfp-records')
        .set('x-user-id', 'owner-1')
        .set('x-role', 'Primary Owner')
        .send({ title: 'T', organization: 'O', dueDate: '2026-01-01' });
      expect(res.status).toBe(401);
    });
  });

  describe('Primary Owner role boundary', () => {
    it('obtains a session token via /auth/login', async () => {
      const res = await request(app).post('/auth/login').send({ userId: 'owner-1' });
      expect(res.status).toBe(201);
      expect(res.body.token).toBeTruthy();
      expect(res.body.user.role).toBe('Primary Owner');
    });

    it('GET /config is accessible without auth', async () => {
      const res = await request(app).get('/config');
      expect(res.status).toBe(200);
    });

    it('PUT /config succeeds with Primary Owner token', async () => {
      const token = await loginAs('owner-1');
      const res = await request(app)
        .put('/config')
        .set('Authorization', `Bearer ${token}`)
        .send({ closeScoreThreshold: 0.05 });
      expect(res.status).toBe(200);
      expect(res.body.config.closeScoreThreshold).toBe(0.05);
    });

    it('PUT /config returns 403 when Assessor tries to edit config', async () => {
      const token = await loginAs('assessor-1');
      const res = await request(app)
        .put('/config')
        .set('Authorization', `Bearer ${token}`)
        .send({ closeScoreThreshold: 0.1 });
      expect(res.status).toBe(403);
    });

    it('PUT /config returns 403 when Panel Reviewer tries to edit config', async () => {
      const token = await loginAs('panel-1');
      const res = await request(app)
        .put('/config')
        .set('Authorization', `Bearer ${token}`)
        .send({ closeScoreThreshold: 0.1 });
      expect(res.status).toBe(403);
    });

    it('POST /rfp-records succeeds with Primary Owner token', async () => {
      const token = await loginAs('owner-1');
      const res = await request(app)
        .post('/rfp-records')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Auth Test RFP', organization: 'Org', dueDate: '2027-01-01' });
      expect(res.status).toBe(201);
    });

    it('POST /rfp-records returns 403 when Assessor attempts creation', async () => {
      const token = await loginAs('assessor-1');
      const res = await request(app)
        .post('/rfp-records')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Auth Test RFP', organization: 'Org', dueDate: '2027-01-01' });
      expect(res.status).toBe(403);
    });
  });

  describe('Assessor role boundary', () => {
    // Uses the known seeded RFP id 'rfp-2026-network-modernization' to avoid an extra network round-trip.
    const lookupScores = async () => {
      const res = await request(app)
        .get('/scores')
        .query({ rfpId: 'rfp-2026-network-modernization' });
      return res.body.scores;
    };

    it('PUT /scores/:scoreId returns 401 without token', async () => {
      const scores = await lookupScores();
      const scoreId = scores[0].id;
      const res = await request(app).put(`/scores/${scoreId}`).send({ value: 5 });
      expect(res.status).toBe(401);
    });

    it('PUT /scores/:scoreId returns 403 when wrong assessor tries to update', async () => {
      const scores = await lookupScores();
      const assessorScore = scores.find(
        (s) => s.layer === 'L1' && s.ownerId === 'assessor-1',
      );

      // Log in as assessor-2 (not the owner of this score) — expect 403
      const token = await loginAs('assessor-2');
      const res = await request(app)
        .put(`/scores/${assessorScore.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ value: 4 });
      expect(res.status).toBe(403);
    });

    it('PUT /scores/:scoreId succeeds when correct assessor updates their own score', async () => {
      const scores = await lookupScores();
      const assessorScore = scores.find(
        (s) => s.layer === 'L1' && s.ownerId === 'assessor-1' && s.criterionId === 'l1-architecture',
      );

      const token = await loginAs('assessor-1');
      const res = await request(app)
        .put(`/scores/${assessorScore.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ value: 4 });
      expect(res.status).toBe(200);
    });
  });

  describe('Panel Reviewer role boundary', () => {
    it('POST /panel-validations returns 401 without token', async () => {
      const res = await request(app).post('/panel-validations').send({});
      expect(res.status).toBe(401);
    });

    it('POST /panel-validations returns 403 when Assessor attempts submission', async () => {
      const token = await loginAs('assessor-1');
      const res = await request(app)
        .post('/panel-validations')
        .set('Authorization', `Bearer ${token}`)
        .send({ rfpId: 'rfp-2026-network-modernization', vendorId: 'vendor-northstar', decision: 'approved' });
      expect(res.status).toBe(403);
    });

    it('POST /panel-validations returns 403 when Primary Owner attempts submission', async () => {
      const token = await loginAs('owner-1');
      const res = await request(app)
        .post('/panel-validations')
        .set('Authorization', `Bearer ${token}`)
        .send({ rfpId: 'rfp-2026-network-modernization', vendorId: 'vendor-northstar', decision: 'approved' });
      expect(res.status).toBe(403);
    });

    it('POST /panel-validations succeeds with Panel Reviewer token', async () => {
      const token = await loginAs('panel-1');
      const res = await request(app)
        .post('/panel-validations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          rfpId: 'rfp-2026-network-modernization',
          vendorId: 'vendor-northstar',
          decision: 'approved',
        });
      expect(res.status).toBe(201);
    });
  });

  describe('Session management', () => {
    it('GET /auth/session returns 401 with no token', async () => {
      const res = await request(app).get('/auth/session');
      expect(res.status).toBe(401);
    });

    it('GET /auth/session returns user when valid token is provided', async () => {
      const token = await loginAs('owner-1');
      const res = await request(app)
        .get('/auth/session')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.user.id).toBe('owner-1');
    });

    it('GET /auth/session returns 401 after logout', async () => {
      const token = await loginAs('owner-1');
      await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${token}`);
      const res = await request(app)
        .get('/auth/session')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(401);
    });
  });
});
