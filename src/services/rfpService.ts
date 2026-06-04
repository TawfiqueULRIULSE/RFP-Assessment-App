import { apiRequest } from './api';
import type { Assessor, Criterion, PanelReviewer, Rfp, User, Vendor } from '../types/domain';

export interface RfpBundleResponse {
  rfps: Rfp[];
  vendors: Vendor[];
  criteria: Criterion[];
  assessors: User[];
  panelReviewers: PanelReviewer[];
  primaryOwner: User;
}

export const fetchRfpBundle = async (): Promise<RfpBundleResponse> => {
  return apiRequest<RfpBundleResponse>('/rfps');
};

export const toAssessorWithWeights = (
  baseAssessors: User[],
  weightSource: Assessor[],
): Assessor[] => {
  return baseAssessors.map((assessor) => {
    const source = weightSource.find((item) => item.id === assessor.id);
    return {
      id: assessor.id,
      name: assessor.name,
      weight: source?.weight ?? 0,
      assignedCriterionIds: source?.assignedCriterionIds ?? [],
    };
  });
};
