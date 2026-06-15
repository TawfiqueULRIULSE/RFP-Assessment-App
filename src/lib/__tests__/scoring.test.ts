import { describe, it, expect } from 'vitest';
import { consolidateL1, calculateVendorScores, hasCloseScoreDiscussionFlagByThreshold } from '../scoring';
import type { Assessor, Criterion, ScoreEntry, Vendor, VendorLayerScores } from '../../types/domain';
import { DEFAULT_APP_CONFIG } from '../../config/defaults';

// ─── Shared fixtures ─────────────────────────────────────────────────────────

const makeVendor = (id: string): Vendor => ({ id, name: id });
const makeCriterion = (id: string, layer: 'L1' | 'L2' | 'L3'): Criterion => ({
  id,
  layer,
  label: id,
  description: '',
});
const makeAssessor = (id: string, weight: number, criterionIds: string[]): Assessor => ({
  id,
  name: id,
  weight,
  assignedCriterionIds: criterionIds,
});
const makeScore = (
  id: string,
  rfpId: string,
  vendorId: string,
  criterionId: string,
  layer: 'L1' | 'L2' | 'L3',
  ownerId: string,
  value: number | null,
): ScoreEntry => ({
  id,
  rfpId,
  vendorId,
  criterionId,
  layer,
  ownerId,
  value,
  comment: '',
  updatedAt: new Date().toISOString(),
});

const VENDORS = [makeVendor('v1'), makeVendor('v2')];
const L1_CRIT = makeCriterion('c-l1', 'L1');
const L2_CRIT = makeCriterion('c-l2', 'L2');
const L3_CRIT = makeCriterion('c-l3', 'L3');
const CRITERIA = [L1_CRIT, L2_CRIT, L3_CRIT];

const ASSESSOR_A = makeAssessor('a1', 0.6, ['c-l1']);
const ASSESSOR_B = makeAssessor('a2', 0.4, ['c-l1']);
const ASSESSORS = [ASSESSOR_A, ASSESSOR_B];

// ─── consolidateL1 ────────────────────────────────────────────────────────────

describe('consolidateL1', () => {
  it('returns one entry per vendor×L1criterion', () => {
    const result = consolidateL1([], CRITERIA, VENDORS, ASSESSORS);
    expect(result).toHaveLength(2); // 2 vendors × 1 L1 criterion
  });

  it('ignores non-L1 criteria', () => {
    const scores: ScoreEntry[] = [
      makeScore('s1', 'rfp1', 'v1', 'c-l2', 'L2', 'a1', 80),
    ];
    const result = consolidateL1(scores, CRITERIA, VENDORS, ASSESSORS);
    // All L1 scores should be null since we only have L2 score
    expect(result.every((r) => r.score === null)).toBe(true);
  });

  it('computes weighted average from multiple assessors', () => {
    // a1 weight=0.6, score=80; a2 weight=0.4, score=60
    // weighted avg = (80*0.6 + 60*0.4) / (0.6+0.4) = (48+24)/1 = 72
    const scores: ScoreEntry[] = [
      makeScore('s1', 'rfp1', 'v1', 'c-l1', 'L1', 'a1', 80),
      makeScore('s2', 'rfp1', 'v1', 'c-l1', 'L1', 'a2', 60),
    ];
    const result = consolidateL1(scores, CRITERIA, [makeVendor('v1')], ASSESSORS);
    const entry = result.find((r) => r.vendorId === 'v1' && r.criterionId === 'c-l1');
    expect(entry?.score).toBe(72);
  });

  it('returns null score when no assessor has submitted a value', () => {
    const result = consolidateL1([], CRITERIA, [makeVendor('v1')], ASSESSORS);
    const entry = result.find((r) => r.vendorId === 'v1' && r.criterionId === 'c-l1');
    expect(entry?.score).toBeNull();
  });

  it('lists missing assessor IDs for assigned but unscored assessors', () => {
    // a1 scored, a2 has not
    const scores: ScoreEntry[] = [
      makeScore('s1', 'rfp1', 'v1', 'c-l1', 'L1', 'a1', 70),
    ];
    const result = consolidateL1(scores, CRITERIA, [makeVendor('v1')], ASSESSORS);
    const entry = result.find((r) => r.vendorId === 'v1' && r.criterionId === 'c-l1');
    expect(entry?.missingAssessorIds).toEqual(['a2']);
  });

  it('handles partial scores — only submitted assessors contribute', () => {
    // Only a1 (weight=0.6) scored; a2 is missing
    const scores: ScoreEntry[] = [
      makeScore('s1', 'rfp1', 'v1', 'c-l1', 'L1', 'a1', 90),
    ];
    const result = consolidateL1(scores, CRITERIA, [makeVendor('v1')], ASSESSORS);
    const entry = result.find((r) => r.vendorId === 'v1' && r.criterionId === 'c-l1');
    expect(entry?.score).toBe(90);
  });

  it('ignores assessors with weight 0', () => {
    const zeroWeightAssessor = makeAssessor('a3', 0, ['c-l1']);
    const scores: ScoreEntry[] = [
      makeScore('s1', 'rfp1', 'v1', 'c-l1', 'L1', 'a3', 50),
    ];
    const result = consolidateL1(scores, CRITERIA, [makeVendor('v1')], [zeroWeightAssessor]);
    const entry = result.find((r) => r.vendorId === 'v1' && r.criterionId === 'c-l1');
    expect(entry?.score).toBeNull();
  });

  it('handles multiple vendors independently', () => {
    const scores: ScoreEntry[] = [
      makeScore('s1', 'rfp1', 'v1', 'c-l1', 'L1', 'a1', 80),
      makeScore('s2', 'rfp1', 'v2', 'c-l1', 'L1', 'a1', 40),
    ];
    const result = consolidateL1(scores, CRITERIA, VENDORS, ASSESSORS);
    const v1Entry = result.find((r) => r.vendorId === 'v1' && r.criterionId === 'c-l1');
    const v2Entry = result.find((r) => r.vendorId === 'v2' && r.criterionId === 'c-l1');
    expect(v1Entry?.score).toBe(80);
    expect(v2Entry?.score).toBe(40);
  });
});

// ─── calculateVendorScores ────────────────────────────────────────────────────

describe('calculateVendorScores', () => {
  it('returns one entry per vendor', () => {
    const result = calculateVendorScores([], CRITERIA, VENDORS, ASSESSORS);
    expect(result).toHaveLength(2);
  });

  it('returns zero scores when no data is provided', () => {
    const [score] = calculateVendorScores([], CRITERIA, [makeVendor('v1')], ASSESSORS);
    expect(score.l1Score).toBe(0);
    expect(score.l2Score).toBe(0);
    expect(score.l3Score).toBe(0);
    expect(score.weightedTotal).toBe(0);
    expect(score.confidence).toBe(0);
    expect(score.riskAdjustedScore).toBe(0);
  });

  it('computes correct weighted total from all three layers', () => {
    // v1: L1=80, L2=70, L3=60 (single assessor, weight=1)
    const assessor = makeAssessor('a1', 1, ['c-l1']);
    const scores: ScoreEntry[] = [
      makeScore('s1', 'rfp1', 'v1', 'c-l1', 'L1', 'a1', 80),
      makeScore('s2', 'rfp1', 'v1', 'c-l2', 'L2', 'owner-1', 70),
      makeScore('s3', 'rfp1', 'v1', 'c-l3', 'L3', 'owner-1', 60),
    ];
    const [score] = calculateVendorScores(scores, CRITERIA, [makeVendor('v1')], [assessor], DEFAULT_APP_CONFIG);
    // weightedTotal = 80*0.55 + 70*0.3 + 60*0.15 = 44+21+9 = 74
    expect(score.weightedTotal).toBe(74);
  });

  it('confidence is proportional to completion ratio', () => {
    // Fully filled: 3 scores for 1 vendor × 3 criteria = 100% complete
    const assessor = makeAssessor('a1', 1, ['c-l1']);
    const fullyFilledScores: ScoreEntry[] = [
      makeScore('s1', 'rfp1', 'v1', 'c-l1', 'L1', 'a1', 80),
      makeScore('s2', 'rfp1', 'v1', 'c-l2', 'L2', 'owner-1', 70),
      makeScore('s3', 'rfp1', 'v1', 'c-l3', 'L3', 'owner-1', 60),
    ];
    const [full] = calculateVendorScores(fullyFilledScores, CRITERIA, [makeVendor('v1')], [assessor], DEFAULT_APP_CONFIG);

    // Partially filled (only 1 of 3)
    const partialScores: ScoreEntry[] = [
      makeScore('s1', 'rfp1', 'v1', 'c-l1', 'L1', 'a1', 80),
    ];
    const [partial] = calculateVendorScores(partialScores, CRITERIA, [makeVendor('v1')], [assessor], DEFAULT_APP_CONFIG);

    expect(full.confidence).toBeGreaterThan(partial.confidence);
  });

  it('riskAdjustedScore is lower than weightedTotal when confidence < 100', () => {
    const assessor = makeAssessor('a1', 1, ['c-l1']);
    // Only partially filled — confidence < 100
    const scores: ScoreEntry[] = [
      makeScore('s1', 'rfp1', 'v1', 'c-l1', 'L1', 'a1', 80),
    ];
    const [result] = calculateVendorScores(scores, CRITERIA, [makeVendor('v1')], [assessor], DEFAULT_APP_CONFIG);
    expect(result.riskAdjustedScore).toBeLessThan(result.weightedTotal);
  });

  it('handles multi-vendor scenario correctly', () => {
    const assessor = makeAssessor('a1', 1, ['c-l1']);
    const scores: ScoreEntry[] = [
      makeScore('s1', 'rfp1', 'v1', 'c-l1', 'L1', 'a1', 90),
      makeScore('s2', 'rfp1', 'v1', 'c-l2', 'L2', 'owner-1', 80),
      makeScore('s3', 'rfp1', 'v1', 'c-l3', 'L3', 'owner-1', 70),
      makeScore('s4', 'rfp1', 'v2', 'c-l1', 'L1', 'a1', 50),
      makeScore('s5', 'rfp1', 'v2', 'c-l2', 'L2', 'owner-1', 40),
      makeScore('s6', 'rfp1', 'v2', 'c-l3', 'L3', 'owner-1', 30),
    ];
    const results = calculateVendorScores(scores, CRITERIA, VENDORS, [assessor], DEFAULT_APP_CONFIG);
    const v1 = results.find((r) => r.vendorId === 'v1')!;
    const v2 = results.find((r) => r.vendorId === 'v2')!;
    expect(v1.riskAdjustedScore).toBeGreaterThan(v2.riskAdjustedScore);
  });

  it('uses custom config layer weights', () => {
    const assessor = makeAssessor('a1', 1, ['c-l1']);
    const scores: ScoreEntry[] = [
      makeScore('s1', 'rfp1', 'v1', 'c-l1', 'L1', 'a1', 100),
      makeScore('s2', 'rfp1', 'v1', 'c-l2', 'L2', 'owner-1', 0),
      makeScore('s3', 'rfp1', 'v1', 'c-l3', 'L3', 'owner-1', 0),
    ];
    const l1HeavyConfig = { ...DEFAULT_APP_CONFIG, layerWeights: { L1: 1, L2: 0, L3: 0 } };
    const [result] = calculateVendorScores(scores, CRITERIA, [makeVendor('v1')], [assessor], l1HeavyConfig);
    expect(result.weightedTotal).toBe(100);
  });

  it('partial-score scenario: missing values are treated as zero in layer average', () => {
    const assessor = makeAssessor('a1', 1, ['c-l1']);
    // L2 has null, L3 has null — only L1 is filled
    const scores: ScoreEntry[] = [
      makeScore('s1', 'rfp1', 'v1', 'c-l1', 'L1', 'a1', 60),
      makeScore('s2', 'rfp1', 'v1', 'c-l2', 'L2', 'owner-1', null),
      makeScore('s3', 'rfp1', 'v1', 'c-l3', 'L3', 'owner-1', null),
    ];
    const [result] = calculateVendorScores(scores, CRITERIA, [makeVendor('v1')], [assessor], DEFAULT_APP_CONFIG);
    expect(result.l2Score).toBe(0);
    expect(result.l3Score).toBe(0);
  });
});

// ─── hasCloseScoreDiscussionFlagByThreshold ───────────────────────────────────

const makeVendorScore = (vendorId: string, riskAdjustedScore: number): VendorLayerScores => ({
  vendorId,
  l1Score: 0,
  l2Score: 0,
  l3Score: 0,
  weightedTotal: riskAdjustedScore,
  confidence: 100,
  riskAdjustedScore,
});

describe('hasCloseScoreDiscussionFlagByThreshold', () => {
  it('returns false with fewer than 2 vendors', () => {
    const scores = [makeVendorScore('v1', 80)];
    expect(hasCloseScoreDiscussionFlagByThreshold(scores, 0.05)).toBe(false);
  });

  it('returns false when scores are far apart', () => {
    const scores = [makeVendorScore('v1', 90), makeVendorScore('v2', 50)];
    // diff = 40/90 ≈ 0.44, threshold = 0.05 → not close
    expect(hasCloseScoreDiscussionFlagByThreshold(scores, 0.05)).toBe(false);
  });

  it('returns true when scores are within threshold', () => {
    const scores = [makeVendorScore('v1', 100), makeVendorScore('v2', 98)];
    // diff = 2/100 = 0.02, threshold = 0.03 → close
    expect(hasCloseScoreDiscussionFlagByThreshold(scores, 0.03)).toBe(true);
  });

  it('returns false when highest score is 0', () => {
    const scores = [makeVendorScore('v1', 0), makeVendorScore('v2', 0)];
    expect(hasCloseScoreDiscussionFlagByThreshold(scores, 0.03)).toBe(false);
  });

  it('uses the custom threshold correctly', () => {
    const scores = [makeVendorScore('v1', 100), makeVendorScore('v2', 95)];
    // diff = 5/100 = 0.05
    expect(hasCloseScoreDiscussionFlagByThreshold(scores, 0.04)).toBe(false);
    expect(hasCloseScoreDiscussionFlagByThreshold(scores, 0.05)).toBe(true);
    expect(hasCloseScoreDiscussionFlagByThreshold(scores, 0.10)).toBe(true);
  });

  it('handles more than two vendors — compares top two', () => {
    const scores = [
      makeVendorScore('v1', 100),
      makeVendorScore('v2', 99),
      makeVendorScore('v3', 10),
    ];
    // top two: 100 & 99, diff = 1/100 = 0.01 < 0.03
    expect(hasCloseScoreDiscussionFlagByThreshold(scores, 0.03)).toBe(true);
  });

  it('returns true at exactly the threshold boundary', () => {
    const scores = [makeVendorScore('v1', 100), makeVendorScore('v2', 97)];
    // diff = 3/100 = 0.03, threshold = 0.03 → exactly at threshold (<=)
    expect(hasCloseScoreDiscussionFlagByThreshold(scores, 0.03)).toBe(true);
  });
});
