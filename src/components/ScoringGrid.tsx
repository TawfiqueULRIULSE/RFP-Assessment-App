import { useMemo, useState } from 'react';
import type { Criterion, Evidence, ScoreEntry, Vendor } from '../types/domain';

interface ScoringGridProps {
  title: string;
  criteria: Criterion[];
  vendors: Vendor[];
  scores: ScoreEntry[];
  evidence: Evidence[];
  scoreCommentThreshold: number;
  canEditScore: (score: ScoreEntry) => boolean;
  canEditComment: (score: ScoreEntry) => boolean;
  onScoreChange: (scoreId: string, nextValue: number | null) => void;
  onCommentChange: (scoreId: string, nextComment: string) => void;
}

const makeCellKey = (scoreId: string) => `cell-${scoreId}`;

export function ScoringGrid({
  title,
  criteria,
  vendors,
  scores,
  evidence,
  scoreCommentThreshold,
  canEditScore,
  canEditComment,
  onScoreChange,
  onCommentChange,
}: ScoringGridProps) {
  const [expandedCommentCells, setExpandedCommentCells] = useState<Record<string, boolean>>({});
  const [scoreErrors, setScoreErrors] = useState<Record<string, string>>({});

  const scoreByCompositeKey = useMemo(() => {
    const index = new Map<string, ScoreEntry>();
    for (const score of scores) {
      index.set(`${score.criterionId}|${score.vendorId}`, score);
    }
    return index;
  }, [scores]);

  const evidenceByCompositeKey = useMemo(() => {
    const index = new Map<string, Evidence[]>();
    for (const item of evidence) {
      const key = `${item.criterionId}|${item.vendorId}`;
      const existing = index.get(key) ?? [];
      existing.push(item);
      index.set(key, existing);
    }
    return index;
  }, [evidence]);

  return (
    <section className="panel">
      <header className="panel-header">
        <h3>{title}</h3>
      </header>

      <div className="table-wrap">
        <table className="score-grid">
          <thead>
            <tr>
              <th>Criterion</th>
              {vendors.map((vendor) => (
                <th key={vendor.id}>{vendor.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {criteria.map((criterion) => (
              <tr key={criterion.id}>
                <td>
                  <div className="criterion-label">{criterion.label}</div>
                  <div className="criterion-description">{criterion.description}</div>
                </td>

                {vendors.map((vendor) => {
                  const score = scoreByCompositeKey.get(`${criterion.id}|${vendor.id}`);
                  const evidenceItems = evidenceByCompositeKey.get(`${criterion.id}|${vendor.id}`) ?? [];

                  if (!score) {
                    return <td key={vendor.id}>-</td>;
                  }

                  const cellKey = makeCellKey(score.id);
                  const isExpanded = expandedCommentCells[cellKey] ?? false;
                  const isLocked = score.locked === true;
                  const scoreEditable = !isLocked && canEditScore(score);
                  const commentEditable = !isLocked && canEditComment(score);
                  const scoreError = scoreErrors[score.id];
                  const needsComment =
                    score.value !== null &&
                    score.value < scoreCommentThreshold &&
                    !score.comment.trim();

                  return (
                    <td key={vendor.id}>
                      <div className="cell-stack">
                        <input
                          className={`score-input${scoreError ? ' input-error' : ''}`}
                          type="number"
                          min={0}
                          max={100}
                          value={score.value ?? ''}
                          disabled={!scoreEditable}
                          title={isLocked ? 'This score is locked after panel approval' : undefined}
                          onChange={(event) => {
                            const raw = event.target.value;
                            if (raw === '') {
                              setScoreErrors((current) => {
                                const next = { ...current };
                                delete next[score.id];
                                return next;
                              });
                              onScoreChange(score.id, null);
                              return;
                            }

                            const next = Number(raw);
                            if (!Number.isFinite(next)) {
                              setScoreErrors((current) => ({
                                ...current,
                                [score.id]: 'Score must be a valid number.',
                              }));
                              return;
                            }

                            if (next < 0 || next > 100) {
                              setScoreErrors((current) => ({
                                ...current,
                                [score.id]: 'Score must be between 0 and 100.',
                              }));
                              return;
                            }

                            setScoreErrors((current) => {
                              const updated = { ...current };
                              delete updated[score.id];
                              return updated;
                            });

                            if (next < scoreCommentThreshold) {
                              setExpandedCommentCells((current) => ({
                                ...current,
                                [cellKey]: true,
                              }));
                            }

                            onScoreChange(score.id, next);
                          }}
                        />
                        {scoreError && (
                          <span className="validation-error" role="alert">
                            {scoreError}
                          </span>
                        )}
                        {isLocked && (
                          <span
                            className="locked-badge"
                            title="This score is locked after panel approval"
                          >
                            🔒 Locked
                          </span>
                        )}
                        {needsComment && !isLocked && (
                          <span className="validation-warning" role="alert">
                            A comment is required for scores below {scoreCommentThreshold}.
                          </span>
                        )}

                        <button
                          type="button"
                          className="inline-link"
                          onClick={() =>
                            setExpandedCommentCells((current) => ({
                              ...current,
                              [cellKey]: !isExpanded,
                            }))
                          }
                        >
                          {isExpanded ? 'Hide comment' : 'Add/View comment'}
                        </button>

                        {isExpanded && (
                          <textarea
                            className="comment-input"
                            value={score.comment}
                            placeholder={
                              needsComment
                                ? `Comment required for scores below ${scoreCommentThreshold}`
                                : 'Add context, concerns, or rationale'
                            }
                            onChange={(event) => onCommentChange(score.id, event.target.value)}
                            rows={3}
                            disabled={!commentEditable}
                          />
                        )}

                        <div className="evidence-meta">Evidence items: {evidenceItems.length}</div>
                        {evidenceItems.length > 0 && (
                          <ul className="compact-list">
                            {evidenceItems.map((item) => (
                              <li key={item.id}>
                                <a href={item.url} target="_blank" rel="noreferrer">
                                  {item.title}
                                </a>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
