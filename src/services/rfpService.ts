import { apiRequest } from './api';
import type {
  Assessor,
  Criterion,
  PanelReviewer,
  Rfp,
  RfpIngestDraftCriterion,
  RfpIngestJob,
  User,
  Vendor,
} from '../types/domain';

export interface RfpBundleResponse {
  rfps: Rfp[];
  vendors: Vendor[];
  criteria: Criterion[];
  assessors: User[];
  panelReviewers: PanelReviewer[];
  primaryOwner: User;
}

interface RfpRecordsResponse {
  records: Rfp[];
}

interface RfpRecordResponse {
  record: Rfp;
}

interface RfpIngestJobResponse {
  job: RfpIngestJob;
}

interface ApplyL1DraftResponse {
  criteria: RfpIngestDraftCriterion[];
}

export const fetchRfpBundle = async (rfpId?: string): Promise<RfpBundleResponse> => {
  const params = rfpId ? `?rfpId=${encodeURIComponent(rfpId)}` : '';
  return apiRequest<RfpBundleResponse>(`/rfps${params}`);
};

export const fetchRfpRecords = async (): Promise<Rfp[]> => {
  const response = await apiRequest<RfpRecordsResponse>('/rfp-records');
  return response.records;
};

export const createRfpRecord = async (input: {
  title: string;
  organization: string;
  dueDate: string;
}): Promise<Rfp> => {
  const response = await apiRequest<RfpRecordResponse>('/rfp-records', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  return response.record;
};

export const fetchRfpRecordDetail = async (rfpId: string): Promise<Rfp> => {
  const response = await apiRequest<RfpRecordResponse>(`/rfp-records/${encodeURIComponent(rfpId)}`);
  return response.record;
};

export const startRfpIngestJob = async (
  rfpId: string,
  input: { fileName: string; fileType: string },
): Promise<RfpIngestJob> => {
  const response = await apiRequest<RfpIngestJobResponse>(
    `/rfp-records/${encodeURIComponent(rfpId)}/ingest-jobs`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );

  return response.job;
};

export const fetchRfpIngestJob = async (rfpId: string, jobId: string): Promise<RfpIngestJob> => {
  const response = await apiRequest<RfpIngestJobResponse>(
    `/rfp-records/${encodeURIComponent(rfpId)}/ingest-jobs/${encodeURIComponent(jobId)}`,
  );
  return response.job;
};

export const applyRfpL1Draft = async (rfpId: string, jobId: string): Promise<RfpIngestDraftCriterion[]> => {
  const response = await apiRequest<ApplyL1DraftResponse>(
    `/rfp-records/${encodeURIComponent(rfpId)}/ingest-jobs/${encodeURIComponent(jobId)}/apply-l1-draft`,
    {
      method: 'POST',
    },
  );

  return response.criteria;
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
