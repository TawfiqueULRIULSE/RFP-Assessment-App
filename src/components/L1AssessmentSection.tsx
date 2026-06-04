import { useEffect, useMemo, useState } from 'react';
import type {
  AppUser,
  Assessor,
  ConsolidatedCriterionScore,
  Criterion,
  Evidence,
  ScoreEntry,
  Vendor,
} from '../types/domain';
import { ScoringGrid } from './ScoringGrid';

interface L1AssessmentSectionProps {
  criteria: Criterion[];
  vendors: Vendor[];
  assessors: Assessor[];
  activeUser: AppUser;
  scores: ScoreEntry[];
  evidence: Evidence[];
  consolidatedScores: ConsolidatedCriterionScore[];
  canEditScore: (score: ScoreEntry) => boolean;
  canEditComment: (score: ScoreEntry) => boolean;
  onScoreChange: (scoreId: string, nextValue: number | null) => void;
  onCommentChange: (scoreId: string, nextComment: string) => void;
}

export function L1AssessmentSection({
  criteria,
  vendors,
  assessors,
  activeUser,
  scores,
  evidence,
  consolidatedScores,
  canEditScore,
  canEditComment,
  onScoreChange,
  onCommentChange,
}: L1AssessmentSectionProps) {
  const [selectedAssessorId, setSelectedAssessorId] = useState<string>(assessors[0]?.id ?? '');

  useEffect(() => {
    if (activeUser.role === 'Assessor') {
      setSelectedAssessorId(activeUser.id);
    }
  }, [activeUser]);

  const selectedAssessor = useMemo(
    () => assessors.find((assessor) => assessor.id === selectedAssessorId),
    [assessors, selectedAssessorId],
  );

  const l1Criteria = criteria.filter((criterion) => criterion.layer === 'L1');
  const isAssessorViewLocked = activeUser.role === 'Assessor';

  const visibleScores = scores.filter(
    (score) =>
      score.layer === 'L1' &&
      score.ownerId === selectedAssessorId &&
      l1Criteria.some((criterion) => criterion.id === score.criterionId),
  );

  return (
    <section className="stack-lg">
      <section className="panel">
        <header className="panel-header spread">
          <h3>L1 Technical Assessor Input</h3>
          <label className="inline-control">
            Active assessor
            <select
              value={selectedAssessorId}
              onChange={(event) => setSelectedAssessorId(event.target.value)}
              disabled={isAssessorViewLocked}
            >
              {assessors.map((assessor) => (
                <option key={assessor.id} value={assessor.id}>
                  {assessor.name} ({Math.round(assessor.weight * 100)}%)
                </option>
              ))}
            </select>
          </label>
        </header>
        <p className="muted">
          Each assessor scores only assigned criteria. Consolidation is weighted by assessor profile.
        </p>
      </section>

      <ScoringGrid
        title={`L1 Scores - ${selectedAssessor?.name ?? 'Assessor'}`}
        criteria={l1Criteria}
        vendors={vendors}
        scores={visibleScores}
        evidence={evidence}
        canEditScore={canEditScore}
        canEditComment={canEditComment}
        onScoreChange={onScoreChange}
        onCommentChange={onCommentChange}
      />

      <section className="panel">
        <header className="panel-header">
          <h3>Missing Assessor Detection</h3>
        </header>
        <div className="table-wrap">
          <table className="plain-table">
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Criterion</th>
                <th>Missing Assessors</th>
                <th>Consolidated Score</th>
              </tr>
            </thead>
            <tbody>
              {consolidatedScores.map((entry) => {
                const vendorName = vendors.find((vendor) => vendor.id === entry.vendorId)?.name ?? entry.vendorId;
                const criterionLabel =
                  l1Criteria.find((criterion) => criterion.id === entry.criterionId)?.label ?? entry.criterionId;

                return (
                  <tr key={`${entry.vendorId}|${entry.criterionId}`}>
                    <td>{vendorName}</td>
                    <td>{criterionLabel}</td>
                    <td>
                      {entry.missingAssessorIds.length === 0
                        ? 'None'
                        : entry.missingAssessorIds
                            .map(
                              (assessorId) =>
                                assessors.find((assessor) => assessor.id === assessorId)?.name ?? assessorId,
                            )
                            .join(', ')}
                    </td>
                    <td>{entry.score ?? '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
