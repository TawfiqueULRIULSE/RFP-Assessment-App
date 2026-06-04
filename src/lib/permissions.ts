import type { AppUser, Assessor, PanelReviewer, ScoreEntry } from '../types/domain';

const getAssessorById = (assessors: Assessor[], assessorId: string): Assessor | undefined =>
  assessors.find((assessor) => assessor.id === assessorId);

export const canEditScore = (user: AppUser, score: ScoreEntry, assessors: Assessor[]): boolean => {
  if (user.role === 'Primary Owner') {
    return true;
  }

  if (user.role === 'Assessor') {
    if (score.layer !== 'L1' || score.ownerId !== user.id) {
      return false;
    }

    const assessor = getAssessorById(assessors, user.id);
    return assessor?.assignedCriterionIds.includes(score.criterionId) ?? false;
  }

  return false;
};

export const canEditComment = (user: AppUser, score: ScoreEntry, assessors: Assessor[]): boolean => {
  if (user.role === 'Panel Reviewer') {
    return true;
  }

  return canEditScore(user, score, assessors);
};

export const canAddEvidence = (user: AppUser): boolean => user.role === 'Primary Owner';

export const canSubmitPanelValidation = (
  user: AppUser,
  panelReviewers: PanelReviewer[],
): boolean => user.role === 'Panel Reviewer' && panelReviewers.some((reviewer) => reviewer.id === user.id);
