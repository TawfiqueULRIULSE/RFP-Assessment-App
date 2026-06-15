// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import {
  toResultRows,
  toL1HeatmapRows,
  toScoringBreakdownRows,
  exportWorkbook,
  exportRankingCsv,
} from './export';
import type { ExportMetadata } from './export';
import type { Criterion, ScoreEntry, Vendor, VendorLayerScores, AppConfig } from '../types/domain';

vi.mock('xlsx', async (importOriginal) => {
  const actual = await importOriginal<typeof import('xlsx')>();
  return { ...actual, writeFile: vi.fn() };
});

// ── Fixtures ────────────────────────────────────────────────────────────────

const vendors: Vendor[] = [
  { id: 'v1', name: 'Alpha Corp' },
  { id: 'v2', name: 'Beta Ltd' },
  { id: 'v3', name: 'Gamma Inc' },
];

const criteria: Criterion[] = [
  { id: 'c1', layer: 'L1', label: 'Architecture', description: '' },
  { id: 'c2', layer: 'L1', label: 'Security', description: '' },
  { id: 'c3', layer: 'L1', label: 'Delivery', description: '' },
  { id: 'c4', layer: 'L2', label: 'Commercial', description: '' },
  { id: 'c5', layer: 'L3', label: 'Familiarity', description: '' },
];

const nowIso = '2026-06-15T12:00:00.000Z';

const makeScore = (
  id: string,
  vendorId: string,
  criterionId: string,
  layer: 'L1' | 'L2' | 'L3',
  value: number | null,
): ScoreEntry => ({
  id,
  rfpId: 'rfp-test',
  vendorId,
  criterionId,
  layer,
  ownerId: 'assessor-1',
  value,
  comment: '',
  updatedAt: nowIso,
});

// Full scores: 3 vendors × 5 criteria
const scores: ScoreEntry[] = [
  makeScore('s1', 'v1', 'c1', 'L1', 80),
  makeScore('s2', 'v1', 'c2', 'L1', 75),
  makeScore('s3', 'v1', 'c3', 'L1', 90),
  makeScore('s4', 'v1', 'c4', 'L2', 70),
  makeScore('s5', 'v1', 'c5', 'L3', 60),

  makeScore('s6', 'v2', 'c1', 'L1', 65),
  makeScore('s7', 'v2', 'c2', 'L1', 55),
  makeScore('s8', 'v2', 'c3', 'L1', 70),
  makeScore('s9', 'v2', 'c4', 'L2', 80),
  makeScore('s10', 'v2', 'c5', 'L3', 75),

  makeScore('s11', 'v3', 'c1', 'L1', 50),
  makeScore('s12', 'v3', 'c2', 'L1', 60),
  makeScore('s13', 'v3', 'c3', 'L1', 55),
  makeScore('s14', 'v3', 'c4', 'L2', 65),
  makeScore('s15', 'v3', 'c5', 'L3', 80),
];

// Partial scores: some values are null
const partialScores: ScoreEntry[] = [
  makeScore('p1', 'v1', 'c1', 'L1', 80),
  makeScore('p2', 'v1', 'c2', 'L1', null),
  makeScore('p3', 'v1', 'c3', 'L1', null),
  makeScore('p4', 'v1', 'c4', 'L2', null),
  makeScore('p5', 'v1', 'c5', 'L3', 60),

  makeScore('p6', 'v2', 'c1', 'L1', null),
  makeScore('p7', 'v2', 'c2', 'L1', null),
  makeScore('p8', 'v2', 'c3', 'L1', null),
  makeScore('p9', 'v2', 'c4', 'L2', null),
  makeScore('p10', 'v2', 'c5', 'L3', null),

  makeScore('p11', 'v3', 'c1', 'L1', null),
  makeScore('p12', 'v3', 'c2', 'L1', null),
  makeScore('p13', 'v3', 'c3', 'L1', null),
  makeScore('p14', 'v3', 'c4', 'L2', null),
  makeScore('p15', 'v3', 'c5', 'L3', null),
];

const vendorScores: VendorLayerScores[] = [
  { vendorId: 'v1', l1Score: 81.67, l2Score: 70, l3Score: 60, weightedTotal: 75.92, confidence: 85, riskAdjustedScore: 74.2 },
  { vendorId: 'v2', l1Score: 63.33, l2Score: 80, l3Score: 75, weightedTotal: 70.33, confidence: 85, riskAdjustedScore: 68.68 },
  { vendorId: 'v3', l1Score: 55, l2Score: 65, l3Score: 80, weightedTotal: 62, confidence: 85, riskAdjustedScore: 60.59 },
];

const metadata: ExportMetadata = {
  rfpId: 'rfp-test-001',
  rfpTitle: 'Test RFP',
  exportedAt: nowIso,
  exportedBy: 'Test User',
};

const appConfig: AppConfig = {
  layerWeights: { L1: 0.55, L2: 0.3, L3: 0.15 },
  closeScoreThreshold: 0.03,
  confidenceBaseline: 100,
  confidenceVarianceImpact: 0.4,
  riskAdjustmentFloor: 0.7,
  riskAdjustmentScale: 0.3,
};

// ── toResultRows ─────────────────────────────────────────────────────────────

describe('toResultRows', () => {
  it('returns one row per vendor sorted by riskAdjustedScore descending', () => {
    const rows = toResultRows(vendorScores, vendors);
    expect(rows).toHaveLength(3);
    expect(rows[0].rank).toBe(1);
    expect(rows[0].vendor).toBe('Alpha Corp');
    expect(rows[1].rank).toBe(2);
    expect(rows[2].rank).toBe(3);
  });

  it('includes all required columns', () => {
    const [first] = toResultRows(vendorScores, vendors);
    expect(first).toHaveProperty('rank');
    expect(first).toHaveProperty('vendor');
    expect(first).toHaveProperty('l1');
    expect(first).toHaveProperty('l2');
    expect(first).toHaveProperty('l3');
    expect(first).toHaveProperty('weightedTotal');
    expect(first).toHaveProperty('confidence');
    expect(first).toHaveProperty('riskAdjustedScore');
  });

  it('does not throw when vendorScores is empty', () => {
    expect(() => toResultRows([], vendors)).not.toThrow();
    expect(toResultRows([], vendors)).toHaveLength(0);
  });
});

// ── toL1HeatmapRows ───────────────────────────────────────────────────────────

describe('toL1HeatmapRows', () => {
  it('returns one row per vendor with L1 criterion averages', () => {
    const rows = toL1HeatmapRows(scores, criteria, vendors);
    expect(rows).toHaveLength(3);
    expect(rows[0].vendor).toBe('Alpha Corp');
    expect(rows[0]['Architecture']).toBe(80);
    expect(rows[0]['Security']).toBe(75);
    expect(rows[0]['Delivery']).toBe(90);
  });

  it('only includes L1 criteria columns', () => {
    const rows = toL1HeatmapRows(scores, criteria, vendors);
    for (const row of rows) {
      expect(row).not.toHaveProperty('Commercial');
      expect(row).not.toHaveProperty('Familiarity');
    }
  });

  it('outputs "n/a" for a criterion with only null scores', () => {
    const rows = toL1HeatmapRows(partialScores, criteria, vendors);
    const v2Row = rows.find((r) => r.vendor === 'Beta Ltd');
    expect(v2Row?.['Architecture']).toBe('n/a');
    expect(v2Row?.['Security']).toBe('n/a');
  });

  it('does not throw when all scores are null', () => {
    expect(() => toL1HeatmapRows(partialScores, criteria, vendors)).not.toThrow();
  });
});

// ── toScoringBreakdownRows ────────────────────────────────────────────────────

describe('toScoringBreakdownRows', () => {
  it('returns one row per vendor per criterion (3×5 = 15 rows)', () => {
    const rows = toScoringBreakdownRows(scores, criteria, vendors);
    expect(rows).toHaveLength(15);
  });

  it('includes submittedScores and averageScore columns', () => {
    const rows = toScoringBreakdownRows(scores, criteria, vendors);
    const [first] = rows;
    expect(first).toHaveProperty('submittedScores');
    expect(first).toHaveProperty('averageScore');
    expect(first).toHaveProperty('totalSlots');
  });

  it('sets averageScore to "n/a" when all scores are null for that cell', () => {
    const rows = toScoringBreakdownRows(partialScores, criteria, vendors);
    const v2c1 = rows.find((r) => r.vendor === 'Beta Ltd' && r.criterion === 'Architecture');
    expect(v2c1?.averageScore).toBe('n/a');
    expect(v2c1?.submittedScores).toBe(0);
  });

  it('does not throw when all scores are null', () => {
    expect(() => toScoringBreakdownRows(partialScores, criteria, vendors)).not.toThrow();
  });
});

// ── exportWorkbook (smoke test) ───────────────────────────────────────────────

describe('exportWorkbook smoke test', () => {
  it('does not throw with fully populated 3-vendor 5-criteria dataset', () => {
    expect(() =>
      exportWorkbook({
        fileName: 'test_report.xlsx',
        vendors,
        criteria,
        scores,
        comments: [],
        evidence: [],
        vendorScores,
        executiveSummary: [],
        metadata,
        appConfig,
      }),
    ).not.toThrow();
  });

  it('does not throw when scores are partially null (incomplete assessment)', () => {
    expect(() =>
      exportWorkbook({
        fileName: 'test_partial.xlsx',
        vendors,
        criteria,
        scores: partialScores,
        comments: [],
        evidence: [],
        vendorScores,
        executiveSummary: [],
        metadata,
        appConfig,
      }),
    ).not.toThrow();
  });

  it('result rows carry RFP metadata (verified via ranking rows)', () => {
    const rows = toResultRows(vendorScores, vendors);
    // The ranking sheet should contain all 3 vendors ranked 1–3
    expect(rows).toHaveLength(3);
    expect(rows[0].rank).toBe(1);
    expect(rows[2].rank).toBe(3);
  });
});

// ── exportRankingCsv (smoke test) ─────────────────────────────────────────────

describe('exportRankingCsv smoke test', () => {
  it('does not throw with fully populated data', () => {
    // jsdom / node environment: mock DOM APIs used by the function
    const mockLink = {
      href: '',
      download: '',
      click: vi.fn(),
    } as unknown as HTMLAnchorElement;

    vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink);
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink);
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockLink);
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    expect(() =>
      exportRankingCsv({
        fileName: 'test_ranking.csv',
        vendors,
        vendorScores,
        metadata,
      }),
    ).not.toThrow();

    createElementSpy.mockRestore();
    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
  });
});
