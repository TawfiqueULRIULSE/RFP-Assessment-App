import { describe, it, expect } from 'vitest';
import { deriveExecutiveSummary } from '../reporting';
import type { CommentEntry, Criterion, ScoreEntry, Vendor, VendorLayerScores } from '../../types/domain';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makeVendor = (id: string, name: string): Vendor => ({ id, name });

const makeVendorScore = (vendorId: string, riskAdjustedScore: number, confidence = 90): VendorLayerScores => ({
  vendorId,
  l1Score: riskAdjustedScore,
  l2Score: riskAdjustedScore,
  l3Score: riskAdjustedScore,
  weightedTotal: riskAdjustedScore,
  confidence,
  riskAdjustedScore,
});

const makeCriterion = (id: string): Criterion => ({
  id,
  layer: 'L1',
  label: `Label for ${id}`,
  description: '',
});

const makeScore = (
  vendorId: string,
  criterionId: string,
  value: number | null,
  comment = '',
): ScoreEntry => ({
  id: `score-${vendorId}-${criterionId}`,
  rfpId: 'rfp-1',
  vendorId,
  criterionId,
  layer: 'L1',
  ownerId: 'owner-1',
  value,
  comment,
  updatedAt: new Date().toISOString(),
});

const makeComment = (vendorId: string, text: string): CommentEntry => ({
  id: `comment-${vendorId}`,
  rfpId: 'rfp-1',
  vendorId,
  criterionId: 'c1',
  scope: 'general',
  text,
  authorId: 'panel-1',
  authorRole: 'Panel Reviewer',
  createdAt: new Date().toISOString(),
});

const VENDORS = [makeVendor('v1', 'Vendor One'), makeVendor('v2', 'Vendor Two')];
const CRITERIA = [makeCriterion('c1'), makeCriterion('c2')];

// ─── deriveExecutiveSummary ───────────────────────────────────────────────────

describe('deriveExecutiveSummary', () => {
  it('returns one entry per vendor', () => {
    const vendorScores = [makeVendorScore('v1', 80), makeVendorScore('v2', 60)];
    const result = deriveExecutiveSummary({
      vendors: VENDORS,
      criteria: CRITERIA,
      vendorScores,
      scores: [],
      comments: [],
    });
    expect(result).toHaveLength(2);
  });

  it('ranks vendors by riskAdjustedScore descending', () => {
    const vendorScores = [makeVendorScore('v2', 60), makeVendorScore('v1', 80)];
    const result = deriveExecutiveSummary({
      vendors: VENDORS,
      criteria: CRITERIA,
      vendorScores,
      scores: [],
      comments: [],
    });
    expect(result[0].vendorId).toBe('v1');
    expect(result[0].rank).toBe(1);
    expect(result[1].vendorId).toBe('v2');
    expect(result[1].rank).toBe(2);
  });

  it('resolves vendor name from vendors list', () => {
    const vendorScores = [makeVendorScore('v1', 80)];
    const result = deriveExecutiveSummary({
      vendors: VENDORS,
      criteria: CRITERIA,
      vendorScores,
      scores: [],
      comments: [],
    });
    expect(result[0].vendorName).toBe('Vendor One');
  });

  it('falls back to vendorId when vendor not in list', () => {
    const vendorScores = [makeVendorScore('unknown-vendor', 80)];
    const result = deriveExecutiveSummary({
      vendors: VENDORS,
      criteria: CRITERIA,
      vendorScores,
      scores: [],
      comments: [],
    });
    expect(result[0].vendorName).toBe('unknown-vendor');
  });

  it('includes criterion as strength when mean >= 80', () => {
    const vendorScores = [makeVendorScore('v1', 80)];
    const scores: ScoreEntry[] = [makeScore('v1', 'c1', 85)];
    const result = deriveExecutiveSummary({
      vendors: VENDORS,
      criteria: CRITERIA,
      vendorScores,
      scores,
      comments: [],
    });
    expect(result[0].strengths.some((s) => s.includes('Label for c1'))).toBe(true);
  });

  it('includes criterion as risk when mean > 0 and < 65', () => {
    const vendorScores = [makeVendorScore('v1', 80)];
    const scores: ScoreEntry[] = [makeScore('v1', 'c1', 55)];
    const result = deriveExecutiveSummary({
      vendors: VENDORS,
      criteria: CRITERIA,
      vendorScores,
      scores,
      comments: [],
    });
    expect(result[0].risks.some((r) => r.includes('Label for c1'))).toBe(true);
  });

  it('adds positive sentiment from score comments', () => {
    const vendorScores = [makeVendorScore('v1', 80)];
    const scores: ScoreEntry[] = [makeScore('v1', 'c1', 75, 'The team showed excellent delivery capability')];
    const result = deriveExecutiveSummary({
      vendors: VENDORS,
      criteria: CRITERIA,
      vendorScores,
      scores,
      comments: [],
    });
    expect(result[0].strengths.some((s) => s.includes('delivery confidence'))).toBe(true);
  });

  it('adds negative sentiment from panel comments', () => {
    const vendorScores = [makeVendorScore('v1', 80)];
    const comments: CommentEntry[] = [makeComment('v1', 'There is a significant risk in the timeline')];
    const result = deriveExecutiveSummary({
      vendors: VENDORS,
      criteria: CRITERIA,
      vendorScores,
      scores: [],
      comments,
    });
    expect(result[0].risks.some((r) => r.includes('unresolved concerns'))).toBe(true);
  });

  it('adds low confidence risk when confidence < 70', () => {
    const vendorScores = [makeVendorScore('v1', 80, 65)];
    const result = deriveExecutiveSummary({
      vendors: VENDORS,
      criteria: CRITERIA,
      vendorScores,
      scores: [],
      comments: [],
    });
    expect(result[0].risks.some((r) => r.includes('Low confidence'))).toBe(true);
  });

  it('does not add low confidence risk when confidence >= 70', () => {
    const vendorScores = [makeVendorScore('v1', 80, 70)];
    const result = deriveExecutiveSummary({
      vendors: VENDORS,
      criteria: CRITERIA,
      vendorScores,
      scores: [],
      comments: [],
    });
    expect(result[0].risks.every((r) => !r.includes('Low confidence'))).toBe(true);
  });

  it('caps strengths at 3 items', () => {
    const vendorScores = [makeVendorScore('v1', 80)];
    const manyCriteria: Criterion[] = Array.from({ length: 10 }, (_, i) => makeCriterion(`c${i}`));
    const scores: ScoreEntry[] = manyCriteria.map((c) => makeScore('v1', c.id, 85));
    const result = deriveExecutiveSummary({
      vendors: [makeVendor('v1', 'Vendor One')],
      criteria: manyCriteria,
      vendorScores,
      scores,
      comments: [],
    });
    expect(result[0].strengths.length).toBeLessThanOrEqual(3);
  });

  it('caps risks at 3 items', () => {
    const vendorScores = [makeVendorScore('v1', 80, 50)]; // confidence < 70 triggers a risk
    const manyCriteria: Criterion[] = Array.from({ length: 10 }, (_, i) => makeCriterion(`c${i}`));
    const scores: ScoreEntry[] = manyCriteria.map((c) => makeScore('v1', c.id, 50));
    const result = deriveExecutiveSummary({
      vendors: [makeVendor('v1', 'Vendor One')],
      criteria: manyCriteria,
      vendorScores,
      scores,
      comments: [],
    });
    expect(result[0].risks.length).toBeLessThanOrEqual(3);
  });

  it('returns empty strengths and risks when no data', () => {
    const vendorScores = [makeVendorScore('v1', 80, 90)];
    const result = deriveExecutiveSummary({
      vendors: VENDORS,
      criteria: CRITERIA,
      vendorScores,
      scores: [],
      comments: [],
    });
    expect(result[0].strengths).toHaveLength(0);
    expect(result[0].risks).toHaveLength(0);
  });

  it('handles multi-vendor scenario with correct ranking', () => {
    const vendorScores = [
      makeVendorScore('v1', 70),
      makeVendorScore('v2', 85),
    ];
    const result = deriveExecutiveSummary({
      vendors: VENDORS,
      criteria: CRITERIA,
      vendorScores,
      scores: [],
      comments: [],
    });
    expect(result[0].vendorId).toBe('v2');
    expect(result[1].vendorId).toBe('v1');
    expect(result[0].riskAdjustedScore).toBeGreaterThan(result[1].riskAdjustedScore);
  });
});
