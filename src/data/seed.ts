import type {
  AppUser,
  Assessor,
  Criterion,
  Evidence,
  PanelReviewer,
  PanelValidationEntry,
  Rfp,
  ScoreEntry,
  User,
  Vendor,
} from '../types/domain';

const nowIso = new Date().toISOString();

export const currentRfp: Rfp = {
  id: 'rfp-2026-network-modernization',
  title: '2026 Network Modernization RFP',
  createdAt: nowIso,
  primaryOwnerId: 'owner-1',
};

export const primaryOwner: User = {
  id: 'owner-1',
  name: 'Avery Khan',
};

export const assessors: Assessor[] = [
  {
    id: 'assessor-1',
    name: 'Maya Patel',
    weight: 0.4,
    assignedCriterionIds: ['l1-architecture', 'l1-security', 'l1-delivery'],
  },
  {
    id: 'assessor-2',
    name: 'Jon Lee',
    weight: 0.35,
    assignedCriterionIds: ['l1-architecture', 'l1-security', 'l1-delivery'],
  },
  {
    id: 'assessor-3',
    name: 'Rita Chen',
    weight: 0.25,
    assignedCriterionIds: ['l1-architecture', 'l1-security', 'l1-delivery'],
  },
];

export const panelReviewers: PanelReviewer[] = [
  { id: 'panel-1', name: 'Nadia Brooks' },
  { id: 'panel-2', name: 'Imran Sadiq' },
];

export const vendors: Vendor[] = [
  { id: 'vendor-northstar', name: 'Northstar Systems' },
  { id: 'vendor-quanta', name: 'Quanta Grid' },
  { id: 'vendor-apex', name: 'Apex Dynamics' },
];

export const criteria: Criterion[] = [
  {
    id: 'l1-architecture',
    layer: 'L1',
    label: 'Architecture Quality',
    description: 'Scalability, resilience, and technical fit.',
  },
  {
    id: 'l1-security',
    layer: 'L1',
    label: 'Security Posture',
    description: 'Security controls and compliance readiness.',
  },
  {
    id: 'l1-delivery',
    layer: 'L1',
    label: 'Delivery Plan',
    description: 'Execution practicality, staffing, and timeline.',
  },
  {
    id: 'l2-commercial',
    layer: 'L2',
    label: 'Commercial Terms',
    description: 'Commercial flexibility and contractual alignment.',
  },
  {
    id: 'l3-familiarity',
    layer: 'L3',
    label: 'Domain Familiarity',
    description: 'Institutional familiarity and prior outcomes.',
  },
];

const newScoreId = () => `score-${Math.random().toString(36).slice(2, 10)}`;

const l1Scores = assessors.flatMap((assessor) =>
  vendors.flatMap((vendor) =>
    criteria
      .filter((criterion) => criterion.layer === 'L1')
      .map<ScoreEntry>((criterion) => ({
        id: newScoreId(),
        rfpId: currentRfp.id,
        vendorId: vendor.id,
        criterionId: criterion.id,
        layer: 'L1',
        ownerId: assessor.id,
        value: null,
        comment: '',
        updatedAt: nowIso,
      })),
  ),
);

const ownerScores: ScoreEntry[] = vendors.flatMap((vendor) =>
  criteria
    .filter((criterion) => criterion.layer !== 'L1')
    .map((criterion) => ({
      id: newScoreId(),
      rfpId: currentRfp.id,
      vendorId: vendor.id,
      criterionId: criterion.id,
      layer: criterion.layer,
      ownerId: primaryOwner.id,
      value: null,
      comment: '',
      updatedAt: nowIso,
    })),
);

export const initialScores: ScoreEntry[] = [...l1Scores, ...ownerScores];

export const initialEvidence: Evidence[] = [];

export const initialPanelValidations: PanelValidationEntry[] = [];

export const appUsers: AppUser[] = [
  { id: primaryOwner.id, name: primaryOwner.name, role: 'Primary Owner' },
  ...assessors.map((assessor) => ({
    id: assessor.id,
    name: assessor.name,
    role: 'Assessor' as const,
  })),
  ...panelReviewers.map((reviewer) => ({
    id: reviewer.id,
    name: reviewer.name,
    role: 'Panel Reviewer' as const,
  })),
];
