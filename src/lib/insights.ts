import type { Criterion, Evidence, ScoreEntry, Vendor } from '../types/domain';

const average = (values: number[]): number => {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const round2 = (value: number): number => Math.round(value * 100) / 100;

export interface VendorComparisonRow {
  criterionId: string;
  criterionLabel: string;
  vendorAScore: number | null;
  vendorBScore: number | null;
  delta: number | null;
  vendorACommentCount: number;
  vendorBCommentCount: number;
  vendorAEvidenceCount: number;
  vendorBEvidenceCount: number;
}

export interface L1VarianceCell {
  vendorId: string;
  criterionId: string;
  stdDev: number;
}

export const buildVendorComparisonRows = (input: {
  vendorAId: string;
  vendorBId: string;
  criteria: Criterion[];
  scores: ScoreEntry[];
  evidence: Evidence[];
}): VendorComparisonRow[] => {
  const { vendorAId, vendorBId, criteria, scores, evidence } = input;

  return criteria.map((criterion) => {
    const valuesA = scores
      .filter((entry) => entry.vendorId === vendorAId && entry.criterionId === criterion.id && entry.value !== null)
      .map((entry) => entry.value as number);

    const valuesB = scores
      .filter((entry) => entry.vendorId === vendorBId && entry.criterionId === criterion.id && entry.value !== null)
      .map((entry) => entry.value as number);

    const avgA = valuesA.length ? round2(average(valuesA)) : null;
    const avgB = valuesB.length ? round2(average(valuesB)) : null;

    const vendorACommentCount = scores.filter(
      (entry) =>
        entry.vendorId === vendorAId &&
        entry.criterionId === criterion.id &&
        entry.comment.trim().length > 0,
    ).length;

    const vendorBCommentCount = scores.filter(
      (entry) =>
        entry.vendorId === vendorBId &&
        entry.criterionId === criterion.id &&
        entry.comment.trim().length > 0,
    ).length;

    const vendorAEvidenceCount = evidence.filter(
      (item) => item.vendorId === vendorAId && item.criterionId === criterion.id,
    ).length;

    const vendorBEvidenceCount = evidence.filter(
      (item) => item.vendorId === vendorBId && item.criterionId === criterion.id,
    ).length;

    return {
      criterionId: criterion.id,
      criterionLabel: criterion.label,
      vendorAScore: avgA,
      vendorBScore: avgB,
      delta: avgA !== null && avgB !== null ? round2(avgA - avgB) : null,
      vendorACommentCount,
      vendorBCommentCount,
      vendorAEvidenceCount,
      vendorBEvidenceCount,
    };
  });
};

export const buildL1VarianceMatrix = (input: {
  vendors: Vendor[];
  criteria: Criterion[];
  scores: ScoreEntry[];
}): L1VarianceCell[] => {
  const { vendors, criteria, scores } = input;
  const l1Criteria = criteria.filter((criterion) => criterion.layer === 'L1');

  return vendors.flatMap((vendor) =>
    l1Criteria.map((criterion) => {
      const values = scores
        .filter(
          (entry) =>
            entry.layer === 'L1' && entry.vendorId === vendor.id && entry.criterionId === criterion.id,
        )
        .map((entry) => entry.value)
        .filter((value): value is number => value !== null);

      if (values.length <= 1) {
        return {
          vendorId: vendor.id,
          criterionId: criterion.id,
          stdDev: 0,
        };
      }

      const mean = average(values);
      const variance = average(values.map((value) => (value - mean) ** 2));
      return {
        vendorId: vendor.id,
        criterionId: criterion.id,
        stdDev: round2(Math.sqrt(variance)),
      };
    }),
  );
};
