import * as XLSX from 'xlsx';
import type {
  CommentEntry,
  Criterion,
  Evidence,
  ExecutiveSummaryItem,
  ScoreEntry,
  Vendor,
  VendorLayerScores,
} from '../types/domain';

const toScoreRows = (scores: ScoreEntry[], criteria: Criterion[], vendors: Vendor[]) =>
  scores.map((score) => ({
    vendor: vendors.find((vendor) => vendor.id === score.vendorId)?.name ?? score.vendorId,
    criterion: criteria.find((criterion) => criterion.id === score.criterionId)?.label ?? score.criterionId,
    layer: score.layer,
    ownerId: score.ownerId,
    value: score.value,
    comment: score.comment,
    updatedAt: score.updatedAt,
  }));

const toCommentRows = (comments: CommentEntry[], vendors: Vendor[]) =>
  comments.map((entry) => ({
    vendor: vendors.find((vendor) => vendor.id === entry.vendorId)?.name ?? entry.vendorId,
    text: entry.text,
    scope: entry.scope,
    authorRole: entry.authorRole,
    createdAt: entry.createdAt,
  }));

const toEvidenceRows = (evidence: Evidence[], criteria: Criterion[], vendors: Vendor[]) =>
  evidence.map((item) => ({
    vendor: vendors.find((vendor) => vendor.id === item.vendorId)?.name ?? item.vendorId,
    criterion: criteria.find((criterion) => criterion.id === item.criterionId)?.label ?? item.criterionId,
    title: item.title,
    url: item.url,
    attachmentName: item.attachmentName,
    addedBy: item.addedBy,
    addedAt: item.addedAt,
  }));

const toResultRows = (vendorScores: VendorLayerScores[], vendors: Vendor[]) =>
  [...vendorScores]
    .sort((a, b) => b.riskAdjustedScore - a.riskAdjustedScore)
    .map((entry, index) => ({
      rank: index + 1,
      vendor: vendors.find((vendor) => vendor.id === entry.vendorId)?.name ?? entry.vendorId,
      l1: entry.l1Score,
      l2: entry.l2Score,
      l3: entry.l3Score,
      weightedTotal: entry.weightedTotal,
      confidence: entry.confidence,
      riskAdjustedScore: entry.riskAdjustedScore,
    }));

const toExecutiveRows = (summary: ExecutiveSummaryItem[]) =>
  summary.map((item) => ({
    rank: item.rank,
    vendor: item.vendorName,
    weightedTotal: item.weightedTotal,
    riskAdjustedScore: item.riskAdjustedScore,
    keyStrengths: item.strengths.join(' | ') || 'n/a',
    keyRisks: item.risks.join(' | ') || 'n/a',
  }));

export const exportWorkbook = (input: {
  fileName: string;
  vendors: Vendor[];
  criteria: Criterion[];
  scores: ScoreEntry[];
  comments: CommentEntry[];
  evidence: Evidence[];
  vendorScores: VendorLayerScores[];
  executiveSummary: ExecutiveSummaryItem[];
}) => {
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(toResultRows(input.vendorScores, input.vendors)),
    'Ranking',
  );

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(toExecutiveRows(input.executiveSummary)),
    'Executive Summary',
  );

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(toScoreRows(input.scores, input.criteria, input.vendors)),
    'Scores',
  );

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(toCommentRows(input.comments, input.vendors)),
    'Comments',
  );

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(toEvidenceRows(input.evidence, input.criteria, input.vendors)),
    'Evidence',
  );

  XLSX.writeFile(workbook, input.fileName);
};

export const exportRankingCsv = (input: {
  fileName: string;
  vendors: Vendor[];
  vendorScores: VendorLayerScores[];
}) => {
  const rows = toResultRows(input.vendorScores, input.vendors);
  const sheet = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(sheet);

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = input.fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
};
