import type { PanelValidationDecision, PanelValidationEntry } from '../types/domain';
import { apiRequest } from './api';

interface PanelValidationListResponse {
  validations: PanelValidationEntry[];
}

interface PanelValidationCreateResponse {
  validation: PanelValidationEntry;
}

export const fetchPanelValidations = async (rfpId: string): Promise<PanelValidationEntry[]> => {
  const response = await apiRequest<PanelValidationListResponse>(
    `/panel-validations?rfpId=${encodeURIComponent(rfpId)}`,
  );
  return response.validations;
};

export const createPanelValidation = async (input: {
  rfpId: string;
  vendorId: string;
  decision: PanelValidationDecision;
  comment: string;
}): Promise<PanelValidationEntry> => {
  const response = await apiRequest<PanelValidationCreateResponse>('/panel-validations', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  return response.validation;
};
