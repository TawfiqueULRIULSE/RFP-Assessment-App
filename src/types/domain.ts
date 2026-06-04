export type LayerId = 'L1' | 'L2' | 'L3';

export interface LayerConfig {
  id: LayerId;
  label: string;
  weight: number;
}

export interface Criterion {
  id: string;
  layer: LayerId;
  label: string;
  description: string;
}

export interface Vendor {
  id: string;
  name: string;
}

export interface User {
  id: string;
  name: string;
}

export type Role = 'Primary Owner' | 'Assessor' | 'Panel Reviewer';

export interface AppUser extends User {
  role: Role;
}

export interface Assessor extends User {
  weight: number;
  assignedCriterionIds: string[];
}

export interface PanelReviewer extends User {}

export interface Rfp {
  id: string;
  title: string;
  createdAt: string;
  primaryOwnerId: string;
}

export interface ScoreEntry {
  id: string;
  rfpId: string;
  vendorId: string;
  criterionId: string;
  layer: LayerId;
  ownerId: string;
  value: number | null;
  comment: string;
  updatedAt: string;
}

export interface Evidence {
  id: string;
  rfpId: string;
  vendorId: string;
  criterionId: string;
  title: string;
  url: string;
  attachmentName: string;
  addedBy: string;
  addedAt: string;
}

export interface CommentEntry {
  id: string;
  rfpId: string;
  vendorId: string;
  criterionId: string;
  scope: string;
  text: string;
  authorId: string;
  authorRole: string;
  createdAt: string;
}

export interface ConsolidatedCriterionScore {
  vendorId: string;
  criterionId: string;
  score: number | null;
  missingAssessorIds: string[];
}

export interface VendorLayerScores {
  vendorId: string;
  l1Score: number;
  l2Score: number;
  l3Score: number;
  weightedTotal: number;
  confidence: number;
  riskAdjustedScore: number;
}

export interface HistoricalBenchmarkRecord {
  rfpId: string;
  rfpTitle: string;
  vendorId: string;
  vendorName: string;
  weightedTotal: number;
  confidence: number;
  riskAdjustedScore: number;
  recordedAt: string;
}

export interface ExecutiveSummaryItem {
  vendorId: string;
  vendorName: string;
  rank: number;
  weightedTotal: number;
  riskAdjustedScore: number;
  strengths: string[];
  risks: string[];
}

export type PanelValidationDecision = 'approved' | 'commented';

export interface PanelValidationEntry {
  id: string;
  rfpId: string;
  vendorId: string;
  reviewerId: string;
  decision: PanelValidationDecision;
  comment: string;
  createdAt: string;
}

export interface ScoreAuditEvent {
  id: string;
  rfpId: string;
  scoreId: string;
  vendorId: string;
  criterionId: string;
  changedById: string;
  changedByRole: string;
  oldValue: number | null;
  newValue: number | null;
  oldComment: string;
  newComment: string;
  changedAt: string;
}

export interface AppConfig {
  layerWeights: {
    L1: number;
    L2: number;
    L3: number;
  };
  closeScoreThreshold: number;
  confidenceBaseline: number;
  confidenceVarianceImpact: number;
  riskAdjustmentFloor: number;
  riskAdjustmentScale: number;
}
