import { useMemo, useState } from 'react';
import type { Criterion, Evidence, ScoreEntry, Vendor } from '../types/domain';

interface ScoringGridProps {
  title: string;
  criteria: Criterion[];
  vendors: Vendor[];
  scores: ScoreEntry[];
  evidence: Evidence[];
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
  canEditScore,
  canEditComment,
  onScoreChange,
  onCommentChange,
}: ScoringGridProps) {
  const [expandedCommentCells, setExpandedCommentCells] = useState<Record<string, boolean>>({});

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
                  const scoreEditable = canEditScore(score);
                  const commentEditable = canEditComment(score);

                  return (
                    <td key={vendor.id}>
                      <div className="cell-stack">
                        <input
                          className="score-input"
                          type="number"
                          min={0}
                          max={100}
                          value={score.value ?? ''}
                          disabled={!scoreEditable}
                          onChange={(event) => {
                            const raw = event.target.value;
                            if (raw === '') {
                              onScoreChange(score.id, null);
                              return;
                            }

                            const next = Number(raw);
                            if (Number.isFinite(next)) {
                              const normalized = Math.max(0, Math.min(100, next));
                              onScoreChange(score.id, normalized);
                            }
                          }}
                        />

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
                            placeholder="Add context, concerns, or rationale"
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
