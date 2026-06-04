import type { Evidence } from '../types/domain';
import { apiRequest } from './api';

interface EvidenceResponse {
  evidence: Evidence[];
}

interface CreateEvidenceResponse {
  evidence: Evidence;
}

export const fetchEvidence = async (rfpId: string): Promise<Evidence[]> => {
  const response = await apiRequest<EvidenceResponse>(`/evidence?rfpId=${encodeURIComponent(rfpId)}`);
  return response.evidence;
};

export const createEvidence = async (input: {
  rfpId: string;
  vendorId: string;
  criterionId: string;
  title: string;
  url: string;
  attachmentName: string;
  addedBy: string;
}): Promise<Evidence> => {
  const response = await apiRequest<CreateEvidenceResponse>('/evidence', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  return response.evidence;
};
