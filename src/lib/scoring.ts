import { CLOSE_SCORE_THRESHOLD, DEFAULT_APP_CONFIG } from '../config/defaults';
import type {
  AppConfig,
  Assessor,
  ConsolidatedCriterionScore,
  Criterion,
  ScoreEntry,
  Vendor,
  VendorLayerScores,
} from '../types/domain';

const average = (values: number[]): number => {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const getWeightedAverage = (pairs: Array<{ value: number; weight: number }>): number | null => {
  if (pairs.length === 0) {
    return null;
  }

  const totalWeight = pairs.reduce((sum, pair) => sum + pair.weight, 0);
  if (totalWeight === 0) {
    return null;
  }

  const weighted = pairs.reduce((sum, pair) => sum + pair.value * pair.weight, 0);
  return weighted / totalWeight;
};

const round2 = (value: number): number => Math.round(value * 100) / 100;

export const consolidateL1 = (
  scores: ScoreEntry[],
  criteria: Criterion[],
  vendors: Vendor[],
  assessors: Assessor[],
): ConsolidatedCriterionScore[] => {
  const l1Criteria = criteria.filter((criterion) => criterion.layer === 'L1');

  return vendors.flatMap((vendor) =>
    l1Criteria.map((criterion) => {
      const entries = scores.filter(
        (entry) =>
          entry.layer === 'L1' && entry.vendorId === vendor.id && entry.criterionId === criterion.id,
      );

      const submittedByAssessor = new Set(entries.filter((entry) => entry.value !== null).map((entry) => entry.ownerId));

      const missingAssessorIds = assessors
        .filter((assessor) => assessor.assignedCriterionIds.includes(criterion.id))
        .map((assessor) => assessor.id)
        .filter((assessorId) => !submittedByAssessor.has(assessorId));

      const weightedPairs = entries
        .filter((entry): entry is ScoreEntry & { value: number } => entry.value !== null)
        .map((entry) => {
          const assessorWeight = assessors.find((assessor) => assessor.id === entry.ownerId)?.weight ?? 0;
          return { value: entry.value, weight: assessorWeight };
        })
        .filter((pair) => pair.weight > 0);

      const consolidatedScore = getWeightedAverage(weightedPairs);

      return {
        vendorId: vendor.id,
        criterionId: criterion.id,
        score: consolidatedScore === null ? null : round2(consolidatedScore),
        missingAssessorIds,
      };
    }),
  );
};

const getLayerAverage = (values: Array<number | null>): number => {
  const numbers = values.filter((value): value is number => value !== null);
  return round2(average(numbers));
};

const calculateL1VariancePenalty = (
  scores: ScoreEntry[],
  criteria: Criterion[],
  vendors: Vendor[],
): number => {
  const l1Criteria = criteria.filter((criterion) => criterion.layer === 'L1');
  const penalties: number[] = [];

  for (const vendor of vendors) {
    for (const criterion of l1Criteria) {
      const values = scores
        .filter(
          (entry) =>
            entry.layer === 'L1' && entry.vendorId === vendor.id && entry.criterionId === criterion.id,
        )
        .map((entry) => entry.value)
        .filter((value): value is number => value !== null);

      if (values.length <= 1) {
        continue;
      }

      const mean = average(values);
      const variance = average(values.map((value) => (value - mean) ** 2));
      const stdDev = Math.sqrt(variance);
      penalties.push(Math.min(1, stdDev / 50));
    }
  }

  return average(penalties);
};

export const calculateVendorScores = (
  scores: ScoreEntry[],
  criteria: Criterion[],
  vendors: Vendor[],
  assessors: Assessor[],
  config: AppConfig = DEFAULT_APP_CONFIG,
): VendorLayerScores[] => {
  const l1Consolidated = consolidateL1(scores, criteria, vendors, assessors);
  const l2CriteriaIds = criteria.filter((criterion) => criterion.layer === 'L2').map((criterion) => criterion.id);
  const l3CriteriaIds = criteria.filter((criterion) => criterion.layer === 'L3').map((criterion) => criterion.id);

  const totalExpectedEntries = vendors.length * criteria.length;
  const filledEntries = scores.filter((entry) => entry.value !== null).length;
  const completionRatio = totalExpectedEntries === 0 ? 0 : Math.min(1, filledEntries / totalExpectedEntries);

  const l1VariancePenalty = calculateL1VariancePenalty(scores, criteria, vendors);
  const confidence = round2(
    config.confidenceBaseline * completionRatio * (1 - l1VariancePenalty * config.confidenceVarianceImpact),
  );

  return vendors.map((vendor) => {
    const l1Values = l1Consolidated
      .filter((entry) => entry.vendorId === vendor.id)
      .map((entry) => entry.score);

    const l2Values = scores
      .filter((entry) => entry.vendorId === vendor.id && l2CriteriaIds.includes(entry.criterionId))
      .map((entry) => entry.value);

    const l3Values = scores
      .filter((entry) => entry.vendorId === vendor.id && l3CriteriaIds.includes(entry.criterionId))
      .map((entry) => entry.value);

    const l1Score = getLayerAverage(l1Values);
    const l2Score = getLayerAverage(l2Values);
    const l3Score = getLayerAverage(l3Values);

    const weightedTotal = round2(
      l1Score * config.layerWeights.L1 +
        l2Score * config.layerWeights.L2 +
        l3Score * config.layerWeights.L3,
    );

    const riskAdjustedScore = round2(
      weightedTotal * (config.riskAdjustmentFloor + (confidence / 100) * config.riskAdjustmentScale),
    );

    return {
      vendorId: vendor.id,
      l1Score,
      l2Score,
      l3Score,
      weightedTotal,
      confidence,
      riskAdjustedScore,
    };
  });
};

export const hasCloseScoreDiscussionFlag = (vendorScores: VendorLayerScores[]): boolean => {
  if (vendorScores.length < 2) {
    return false;
  }

  const sorted = [...vendorScores].sort((a, b) => b.riskAdjustedScore - a.riskAdjustedScore);
  const highest = sorted[0]?.riskAdjustedScore ?? 0;
  const second = sorted[1]?.riskAdjustedScore ?? 0;

  if (highest === 0) {
    return false;
  }

  return (highest - second) / highest <= CLOSE_SCORE_THRESHOLD;
};

export const hasCloseScoreDiscussionFlagByThreshold = (
  vendorScores: VendorLayerScores[],
  threshold: number,
): boolean => {
  if (vendorScores.length < 2) {
    return false;
  }

  const sorted = [...vendorScores].sort((a, b) => b.riskAdjustedScore - a.riskAdjustedScore);
  const highest = sorted[0]?.riskAdjustedScore ?? 0;
  const second = sorted[1]?.riskAdjustedScore ?? 0;

  if (highest === 0) {
    return false;
  }

  return (highest - second) / highest <= threshold;
};
