import { describe, it, expect } from 'vitest';
import { canEditScore, canAddEvidence, canSubmitPanelValidation, canEditComment } from '../permissions';
import type { AppUser, Assessor, PanelReviewer, ScoreEntry } from '../../types/domain';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makeScore = (layer: 'L1' | 'L2' | 'L3', ownerId: string, criterionId: string): ScoreEntry => ({
  id: 'score-1',
  rfpId: 'rfp-1',
  vendorId: 'v1',
  criterionId,
  layer,
  ownerId,
  value: null,
  comment: '',
  updatedAt: new Date().toISOString(),
});

const makeAssessor = (id: string, criterionIds: string[]): Assessor => ({
  id,
  name: id,
  weight: 1,
  assignedCriterionIds: criterionIds,
});

const primaryOwner: AppUser = { id: 'owner-1', name: 'Owner', role: 'Primary Owner' };
const assessorUser: AppUser = { id: 'assessor-1', name: 'Assessor', role: 'Assessor' };
const panelUser: AppUser = { id: 'panel-1', name: 'Panel', role: 'Panel Reviewer' };

const assessors: Assessor[] = [makeAssessor('assessor-1', ['crit-l1', 'crit-l1-b'])];

// ─── canEditScore ─────────────────────────────────────────────────────────────

describe('canEditScore', () => {
  describe('Primary Owner', () => {
    it('can edit any L1 score', () => {
      const score = makeScore('L1', 'assessor-1', 'crit-l1');
      expect(canEditScore(primaryOwner, score, assessors)).toBe(true);
    });

    it('can edit any L2 score', () => {
      const score = makeScore('L2', 'owner-1', 'crit-l2');
      expect(canEditScore(primaryOwner, score, assessors)).toBe(true);
    });

    it('can edit any L3 score', () => {
      const score = makeScore('L3', 'owner-1', 'crit-l3');
      expect(canEditScore(primaryOwner, score, assessors)).toBe(true);
    });

    it("can edit another assessor's score", () => {
      const score = makeScore('L1', 'assessor-1', 'crit-l1');
      expect(canEditScore(primaryOwner, score, assessors)).toBe(true);
    });
  });

  describe('Assessor', () => {
    it('can edit own L1 score for assigned criterion', () => {
      const score = makeScore('L1', 'assessor-1', 'crit-l1');
      expect(canEditScore(assessorUser, score, assessors)).toBe(true);
    });

    it('cannot edit L2 score', () => {
      const score = makeScore('L2', 'assessor-1', 'crit-l2');
      expect(canEditScore(assessorUser, score, assessors)).toBe(false);
    });

    it('cannot edit L3 score', () => {
      const score = makeScore('L3', 'assessor-1', 'crit-l3');
      expect(canEditScore(assessorUser, score, assessors)).toBe(false);
    });

    it("cannot edit another assessor's L1 score", () => {
      const score = makeScore('L1', 'assessor-2', 'crit-l1');
      expect(canEditScore(assessorUser, score, assessors)).toBe(false);
    });

    it('cannot edit L1 score for an unassigned criterion', () => {
      const score = makeScore('L1', 'assessor-1', 'crit-unassigned');
      expect(canEditScore(assessorUser, score, assessors)).toBe(false);
    });

    it('can edit all assigned L1 criterion scores', () => {
      const scoreA = makeScore('L1', 'assessor-1', 'crit-l1');
      const scoreB = makeScore('L1', 'assessor-1', 'crit-l1-b');
      expect(canEditScore(assessorUser, scoreA, assessors)).toBe(true);
      expect(canEditScore(assessorUser, scoreB, assessors)).toBe(true);
    });

    it('returns false when assessor is not in the assessors list', () => {
      const unknownAssessor: AppUser = { id: 'unknown', name: 'Unknown', role: 'Assessor' };
      const score = makeScore('L1', 'unknown', 'crit-l1');
      expect(canEditScore(unknownAssessor, score, assessors)).toBe(false);
    });
  });

  describe('Panel Reviewer', () => {
    it('cannot edit any score', () => {
      const score = makeScore('L1', 'panel-1', 'crit-l1');
      expect(canEditScore(panelUser, score, assessors)).toBe(false);
    });

    it('cannot edit L2 score', () => {
      const score = makeScore('L2', 'panel-1', 'crit-l2');
      expect(canEditScore(panelUser, score, assessors)).toBe(false);
    });
  });
});

// ─── canEditComment ───────────────────────────────────────────────────────────

describe('canEditComment', () => {
  it('Panel Reviewer can always edit comments', () => {
    const score = makeScore('L1', 'assessor-1', 'crit-l1');
    expect(canEditComment(panelUser, score, assessors)).toBe(true);
  });

  it('Primary Owner can edit comments on any score', () => {
    const score = makeScore('L2', 'owner-1', 'crit-l2');
    expect(canEditComment(primaryOwner, score, assessors)).toBe(true);
  });

  it('Assessor can edit comment on their own assigned L1 score', () => {
    const score = makeScore('L1', 'assessor-1', 'crit-l1');
    expect(canEditComment(assessorUser, score, assessors)).toBe(true);
  });

  it('Assessor cannot edit comment on unassigned criterion', () => {
    const score = makeScore('L1', 'assessor-1', 'crit-unassigned');
    expect(canEditComment(assessorUser, score, assessors)).toBe(false);
  });
});

// ─── canAddEvidence ───────────────────────────────────────────────────────────

describe('canAddEvidence', () => {
  it('Primary Owner can add evidence', () => {
    expect(canAddEvidence(primaryOwner)).toBe(true);
  });

  it('Assessor cannot add evidence', () => {
    expect(canAddEvidence(assessorUser)).toBe(false);
  });

  it('Panel Reviewer cannot add evidence', () => {
    expect(canAddEvidence(panelUser)).toBe(false);
  });
});

// ─── canSubmitPanelValidation ─────────────────────────────────────────────────

describe('canSubmitPanelValidation', () => {
  const panelReviewers: PanelReviewer[] = [
    { id: 'panel-1', name: 'Panel Reviewer 1' },
    { id: 'panel-2', name: 'Panel Reviewer 2' },
  ];

  it('assigned Panel Reviewer can submit validation', () => {
    expect(canSubmitPanelValidation(panelUser, panelReviewers)).toBe(true);
  });

  it('unassigned Panel Reviewer cannot submit validation', () => {
    const unassigned: AppUser = { id: 'panel-99', name: 'Unassigned', role: 'Panel Reviewer' };
    expect(canSubmitPanelValidation(unassigned, panelReviewers)).toBe(false);
  });

  it('Primary Owner cannot submit panel validation', () => {
    expect(canSubmitPanelValidation(primaryOwner, panelReviewers)).toBe(false);
  });

  it('Assessor cannot submit panel validation', () => {
    expect(canSubmitPanelValidation(assessorUser, panelReviewers)).toBe(false);
  });

  it('returns false when panel reviewers list is empty', () => {
    expect(canSubmitPanelValidation(panelUser, [])).toBe(false);
  });

  it('all assigned panel reviewers can submit', () => {
    const panel2: AppUser = { id: 'panel-2', name: 'Panel 2', role: 'Panel Reviewer' };
    expect(canSubmitPanelValidation(panel2, panelReviewers)).toBe(true);
  });
});
