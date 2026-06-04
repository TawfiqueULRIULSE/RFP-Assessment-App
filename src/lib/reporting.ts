import type {
  CommentEntry,
  Criterion,
  ExecutiveSummaryItem,
  ScoreEntry,
  Vendor,
  VendorLayerScores,
} from '../types/domain';

const POSITIVE_TOKENS = ['strong', 'excellent', 'robust', 'mature', 'compliant', 'experienced'];
const NEGATIVE_TOKENS = ['risk', 'concern', 'weak', 'gap', 'issue', 'delay', 'unclear', 'expensive'];

const round2 = (value: number): number => Math.round(value * 100) / 100;

const average = (values: number[]): number => {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const includesToken = (text: string, tokens: string[]): boolean => {
  const lower = text.toLowerCase();
  return tokens.some((token) => lower.includes(token));
};

const deriveCriterionMean = (scores: ScoreEntry[], vendorId: string, criterionId: string): number | null => {
  const values = scores
    .filter((entry) => entry.vendorId === vendorId && entry.criterionId === criterionId && entry.value !== null)
    .map((entry) => entry.value as number);

  if (values.length === 0) {
    return null;
  }

  return round2(average(values));
};

export const deriveExecutiveSummary = (input: {
  vendors: Vendor[];
  criteria: Criterion[];
  vendorScores: VendorLayerScores[];
  scores: ScoreEntry[];
  comments: CommentEntry[];
}): ExecutiveSummaryItem[] => {
  const { vendors, criteria, vendorScores, scores, comments } = input;

  const ranked = [...vendorScores].sort((a, b) => b.riskAdjustedScore - a.riskAdjustedScore);

  return ranked.map((rankedScore, index) => {
    const vendor = vendors.find((item) => item.id === rankedScore.vendorId);
    const vendorName = vendor?.name ?? rankedScore.vendorId;

    const criterionStrengths: string[] = [];
    const criterionRisks: string[] = [];

    for (const criterion of criteria) {
      const mean = deriveCriterionMean(scores, rankedScore.vendorId, criterion.id);
      if (mean === null) {
        continue;
      }

      if (mean >= 80) {
        criterionStrengths.push(`${criterion.label} (${mean})`);
      }

      if (mean > 0 && mean < 65) {
        criterionRisks.push(`${criterion.label} (${mean})`);
      }
    }

    const scoreComments = scores
      .filter((entry) => entry.vendorId === rankedScore.vendorId && entry.comment.trim().length > 0)
      .map((entry) => entry.comment.trim());

    const panelComments = comments
      .filter((entry) => entry.vendorId === rankedScore.vendorId && entry.text.trim().length > 0)
      .map((entry) => entry.text.trim());

    const allCommentText = [...scoreComments, ...panelComments].join(' | ');

    const strengths = [...criterionStrengths];
    const risks = [...criterionRisks];

    if (allCommentText.length > 0 && includesToken(allCommentText, POSITIVE_TOKENS)) {
      strengths.push('Comment sentiment indicates delivery confidence');
    }

    if (allCommentText.length > 0 && includesToken(allCommentText, NEGATIVE_TOKENS)) {
      risks.push('Comment sentiment indicates unresolved concerns');
    }

    if (rankedScore.confidence < 70) {
      risks.push(`Low confidence score (${rankedScore.confidence})`);
    }

    return {
      vendorId: rankedScore.vendorId,
      vendorName,
      rank: index + 1,
      weightedTotal: rankedScore.weightedTotal,
      riskAdjustedScore: rankedScore.riskAdjustedScore,
      strengths: strengths.slice(0, 3),
      risks: risks.slice(0, 3),
    };
  });
};
