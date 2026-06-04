import type { ScoreEntry } from '../types/domain';
import type { ScoreAuditEvent } from '../types/domain';
import { apiRequest } from './api';

interface ScoresResponse {
  scores: ScoreEntry[];
}

interface ScoreResponse {
  score: ScoreEntry;
  auditEvent: ScoreAuditEvent;
}

export const fetchScores = async (rfpId: string): Promise<ScoreEntry[]> => {
  const response = await apiRequest<ScoresResponse>(`/scores?rfpId=${encodeURIComponent(rfpId)}`);
  return response.scores;
};

export const updateScore = async (
  scoreId: string,
  update: { value?: number | null; comment?: string },
): Promise<{ score: ScoreEntry; auditEvent: ScoreAuditEvent }> => {
  const response = await apiRequest<ScoreResponse>(`/scores/${encodeURIComponent(scoreId)}`, {
    method: 'PUT',
    body: JSON.stringify(update),
  });

  return {
    score: response.score,
    auditEvent: response.auditEvent,
  };
};
