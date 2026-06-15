import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import type {
  AppConfig,
  CommentEntry,
  Criterion,
  Evidence,
  ExecutiveSummaryItem,
  ScoreEntry,
  Vendor,
  VendorLayerScores,
} from '../types/domain';

export interface ExportMetadata {
  rfpId: string;
  rfpTitle: string;
  exportedAt: string;
  exportedBy: string;
}

const toScoreRows = (scores: ScoreEntry[], criteria: Criterion[], vendors: Vendor[]) =>
  scores.map((score) => ({
    vendor: vendors.find((vendor) => vendor.id === score.vendorId)?.name ?? score.vendorId,
    criterion: criteria.find((criterion) => criterion.id === score.criterionId)?.label ?? score.criterionId,
    layer: score.layer,
    ownerId: score.ownerId,
    value: score.value ?? 'n/a',
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

export const toResultRows = (vendorScores: VendorLayerScores[], vendors: Vendor[]) =>
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

export const toL1HeatmapRows = (
  scores: ScoreEntry[],
  criteria: Criterion[],
  vendors: Vendor[],
): Record<string, string | number>[] => {
  const l1Criteria = criteria.filter((c) => c.layer === 'L1');
  return vendors.map((vendor) => {
    const row: Record<string, string | number> = { vendor: vendor.name };
    for (const criterion of l1Criteria) {
      const values = scores
        .filter(
          (s) => s.layer === 'L1' && s.vendorId === vendor.id && s.criterionId === criterion.id && s.value !== null,
        )
        .map((s) => s.value as number);
      row[criterion.label] = values.length > 0 ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100 : 'n/a';
    }
    return row;
  });
};

export const toScoringBreakdownRows = (
  scores: ScoreEntry[],
  criteria: Criterion[],
  vendors: Vendor[],
): Record<string, string | number>[] =>
  vendors.flatMap((vendor) =>
    criteria.map((criterion) => {
      const entries = scores.filter(
        (s) => s.vendorId === vendor.id && s.criterionId === criterion.id,
      );
      const filled = entries.filter((s) => s.value !== null);
      const avg =
        filled.length > 0
          ? Math.round((filled.reduce((a, s) => a + (s.value as number), 0) / filled.length) * 100) / 100
          : 'n/a';
      return {
        vendor: vendor.name,
        criterion: criterion.label,
        layer: criterion.layer,
        submittedScores: filled.length,
        totalSlots: entries.length,
        averageScore: avg,
      };
    }),
  );

const toConfigSnapshotRows = (config: AppConfig): Record<string, string | number>[] => [
  { parameter: 'L1 Weight', value: config.layerWeights.L1 },
  { parameter: 'L2 Weight', value: config.layerWeights.L2 },
  { parameter: 'L3 Weight', value: config.layerWeights.L3 },
  { parameter: 'Close Score Threshold', value: config.closeScoreThreshold },
  { parameter: 'Confidence Baseline', value: config.confidenceBaseline },
  { parameter: 'Confidence Variance Impact', value: config.confidenceVarianceImpact },
  { parameter: 'Risk Adjustment Floor', value: config.riskAdjustmentFloor },
  { parameter: 'Risk Adjustment Scale', value: config.riskAdjustmentScale },
];

const toMetadataRows = (metadata: ExportMetadata): Record<string, string>[] => [
  { field: 'RFP ID', value: metadata.rfpId },
  { field: 'RFP Title', value: metadata.rfpTitle },
  { field: 'Export Timestamp', value: metadata.exportedAt },
  { field: 'Exported By', value: metadata.exportedBy },
];

export const exportWorkbook = (input: {
  fileName: string;
  vendors: Vendor[];
  criteria: Criterion[];
  scores: ScoreEntry[];
  comments: CommentEntry[];
  evidence: Evidence[];
  vendorScores: VendorLayerScores[];
  executiveSummary: ExecutiveSummaryItem[];
  metadata: ExportMetadata;
  appConfig: AppConfig;
}) => {
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(toMetadataRows(input.metadata)),
    'Metadata',
  );

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
    XLSX.utils.json_to_sheet(toScoringBreakdownRows(input.scores, input.criteria, input.vendors)),
    'Scoring Breakdown',
  );

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(toL1HeatmapRows(input.scores, input.criteria, input.vendors)),
    'L1 Heatmap',
  );

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(toConfigSnapshotRows(input.appConfig)),
    'Config Snapshot',
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
  metadata: ExportMetadata;
}) => {
  const rows = toResultRows(input.vendorScores, input.vendors);
  const metaRows = toMetadataRows(input.metadata).map((r) => ({ '# field': r.field, '# value': r.value }));
  const sheet = XLSX.utils.json_to_sheet([...metaRows, {}, ...rows]);
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

export const exportPdfSummary = (input: {
  fileName: string;
  vendors: Vendor[];
  vendorScores: VendorLayerScores[];
  executiveSummary: ExecutiveSummaryItem[];
  metadata: ExportMetadata;
}) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const addLine = (text: string, fontSize: number, bold = false, indent = 0) => {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    const lines = doc.splitTextToSize(text, contentWidth - indent);
    doc.text(lines as string[], margin + indent, y);
    y += (fontSize * 0.35 + 1) * (lines as string[]).length + 1;
  };

  const checkPageBreak = (requiredSpace = 20) => {
    if (y + requiredSpace > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
  };

  addLine('RFP Assessment — Executive Summary', 16, true);
  y += 2;
  addLine(`RFP: ${input.metadata.rfpTitle}`, 9);
  addLine(`RFP ID: ${input.metadata.rfpId}`, 9);
  addLine(`Exported: ${new Date(input.metadata.exportedAt).toLocaleString()}`, 9);
  addLine(`Exported by: ${input.metadata.exportedBy}`, 9);
  y += 4;

  addLine('Vendor Rankings', 13, true);
  y += 1;

  const ranked = [...input.vendorScores].sort((a, b) => b.riskAdjustedScore - a.riskAdjustedScore);

  const colX = [margin, margin + 8, margin + 55, margin + 90, margin + 120, margin + 155];
  const colHeaders = ['#', 'Vendor', 'Weighted Total', 'Confidence', 'Risk Adj. Score'];

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(230, 230, 230);
  doc.rect(margin, y - 4, contentWidth, 7, 'F');
  colHeaders.forEach((header, i) => {
    doc.text(header, colX[i] ?? margin, y);
  });
  y += 4;

  doc.setFont('helvetica', 'normal');
  ranked.forEach((score, index) => {
    checkPageBreak(8);
    const vendorName = input.vendors.find((v) => v.id === score.vendorId)?.name ?? score.vendorId;
    if (index % 2 === 0) {
      doc.setFillColor(247, 247, 247);
      doc.rect(margin, y - 4, contentWidth, 7, 'F');
    }
    doc.text(String(index + 1), colX[0] ?? margin, y);
    doc.text(vendorName, colX[1] ?? margin, y);
    doc.text(String(score.weightedTotal), colX[2] ?? margin, y);
    doc.text(String(score.confidence), colX[3] ?? margin, y);
    doc.text(String(score.riskAdjustedScore), colX[4] ?? margin, y);
    y += 7;
  });

  y += 4;
  checkPageBreak(30);

  addLine('Key Strengths & Risks by Vendor', 13, true);
  y += 1;

  for (const item of input.executiveSummary) {
    checkPageBreak(25);
    addLine(`${item.rank}. ${item.vendorName}`, 10, true);
    addLine(`Strengths: ${item.strengths.join('; ') || 'None identified'}`, 9, false, 4);
    addLine(`Risks: ${item.risks.join('; ') || 'None identified'}`, 9, false, 4);
    y += 2;
  }

  doc.save(input.fileName);
};
