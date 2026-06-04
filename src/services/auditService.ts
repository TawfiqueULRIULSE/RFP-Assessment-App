import type { ScoreAuditEvent } from '../types/domain';
import { apiRequest } from './api';

interface AuditResponse {
  events: ScoreAuditEvent[];
}

export const fetchScoreAuditEvents = async (rfpId: string): Promise<ScoreAuditEvent[]> => {
  const response = await apiRequest<AuditResponse>(`/audit?rfpId=${encodeURIComponent(rfpId)}`);
  return response.events;
};
