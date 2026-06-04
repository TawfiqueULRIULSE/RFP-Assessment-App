import { useMemo, useState } from 'react';
import type {
  AppUser,
  Criterion,
  PanelReviewer,
  PanelValidationEntry,
  PanelValidationDecision,
  ScoreEntry,
  Vendor,
} from '../types/domain';

interface PanelValidationViewProps {
  vendors: Vendor[];
  criteria: Criterion[];
  ownerScores: ScoreEntry[];
  activeUser: AppUser;
  canSubmit: boolean;
  panelReviewers: PanelReviewer[];
  validations: PanelValidationEntry[];
  onSubmitValidation: (input: {
    vendorId: string;
    decision: PanelValidationDecision;
    comment: string;
  }) => void;
}

type VendorValidationState = 'Pending' | 'In Review' | 'Needs Discussion' | 'Approved';

const statusClassByState: Record<VendorValidationState, string> = {
  Pending: 'badge-neutral',
  'In Review': 'badge-info',
  'Needs Discussion': 'badge-warning',
  Approved: 'badge',
};

const getVendorScore = (ownerScores: ScoreEntry[], vendorId: string, criterionId: string): ScoreEntry | undefined =>
  ownerScores.find((score) => score.vendorId === vendorId && score.criterionId === criterionId);

export function PanelValidationView({
  vendors,
  criteria,
  ownerScores,
  activeUser,
  canSubmit,
  panelReviewers,
  validations,
  onSubmitValidation,
}: PanelValidationViewProps) {
  const [commentDraftByVendor, setCommentDraftByVendor] = useState<Record<string, string>>({});
  const activeReviewerName =
    panelReviewers.find((reviewer) => reviewer.id === activeUser.id)?.name ?? activeUser.name;

  const vendorStatus = useMemo(() => {
    const byVendor = new Map<
      string,
      {
        status: VendorValidationState;
        latestByReviewer: Array<{ reviewerName: string; decision: PanelValidationDecision; createdAt: string }>;
        history: Array<{
          reviewerName: string;
          decision: PanelValidationDecision;
          comment: string;
          createdAt: string;
        }>;
        lastUpdatedAt: string | null;
      }
    >();

    for (const vendor of vendors) {
      const entries = validations
        .filter((entry) => entry.vendorId === vendor.id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

      const latestByReviewerMap = new Map<string, PanelValidationEntry>();
      for (const entry of entries) {
        latestByReviewerMap.set(entry.reviewerId, entry);
      }

      const latestByReviewer = Array.from(latestByReviewerMap.values())
        .map((entry) => ({
          reviewerName:
            panelReviewers.find((reviewer) => reviewer.id === entry.reviewerId)?.name ?? entry.reviewerId,
          decision: entry.decision,
          createdAt: entry.createdAt,
        }))
        .sort((a, b) => a.reviewerName.localeCompare(b.reviewerName));

      const history = [...entries]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((entry) => ({
          reviewerName:
            panelReviewers.find((reviewer) => reviewer.id === entry.reviewerId)?.name ?? entry.reviewerId,
          decision: entry.decision,
          comment: entry.comment,
          createdAt: entry.createdAt,
        }));

      const approvals = latestByReviewer.filter((entry) => entry.decision === 'approved').length;
      const hasCommented = latestByReviewer.some((entry) => entry.decision === 'commented');
      let status: VendorValidationState = 'Pending';

      if (latestByReviewer.length === 0) {
        status = 'Pending';
      } else if (approvals === panelReviewers.length && panelReviewers.length > 0) {
        status = 'Approved';
      } else if (hasCommented) {
        status = 'Needs Discussion';
      } else {
        status = 'In Review';
      }

      const lastUpdatedAt = entries[entries.length - 1]?.createdAt ?? null;

      byVendor.set(vendor.id, {
        status,
        latestByReviewer,
        history,
        lastUpdatedAt,
      });
    }

    return byVendor;
  }, [panelReviewers, validations, vendors]);

  const l2L3Criteria = criteria.filter((criterion) => criterion.layer === 'L2' || criterion.layer === 'L3');

  return (
    <section className="panel stack-md">
      <header className="panel-header spread">
        <h3>Panel Validation (L2 & L3)</h3>
        <span className="muted">Reviewer: {activeReviewerName}</span>
      </header>

      <p className="muted">Panel can only approve or comment. Scores are read-only in this validation step.</p>
  {!canSubmit && <p className="muted">Switch to a Panel Reviewer role to submit validation actions.</p>}

      <div className="table-wrap">
        <table className="plain-table">
          <thead>
            <tr>
              <th>Vendor</th>
              {l2L3Criteria.map((criterion) => (
                <th key={criterion.id}>{criterion.layer} Score</th>
              ))}
              <th>Validation Status</th>
              <th>Validation History</th>
              <th>Panel Action</th>
            </tr>
          </thead>
          <tbody>
            {vendors.map((vendor) => {
              const statusInfo = vendorStatus.get(vendor.id);
              const status = statusInfo?.status ?? 'Pending';
              const commentDraft = commentDraftByVendor[vendor.id] ?? '';

              return (
                <tr key={vendor.id}>
                  <td>{vendor.name}</td>

                  {l2L3Criteria.map((criterion) => {
                    const score = getVendorScore(ownerScores, vendor.id, criterion.id);
                    return (
                      <td key={criterion.id}>
                        <div className="cell-stack">
                          <strong>{score?.value ?? '-'}</strong>
                          <span className="criterion-description">{score?.comment || 'No owner comment.'}</span>
                        </div>
                      </td>
                    );
                  })}

                  <td>
                    <span className={`badge ${statusClassByState[status]}`}>{status}</span>
                    <div className="timestamp-meta">
                      Last update:{' '}
                      {statusInfo?.lastUpdatedAt
                        ? new Date(statusInfo.lastUpdatedAt).toLocaleString()
                        : 'Not reviewed'}
                    </div>
                  </td>

                  <td>
                    {statusInfo?.history.length ? (
                      <ul className="compact-list">
                        {statusInfo.history.map((entry) => (
                          <li key={`${vendor.id}-${entry.reviewerName}-${entry.createdAt}`}>
                            {entry.reviewerName}: {entry.decision}
                            {entry.comment ? ` - ${entry.comment}` : ''} ({new Date(entry.createdAt).toLocaleString()})
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="criterion-description">No panel activity yet.</span>
                    )}
                  </td>

                  <td>
                    <div className="cell-stack">
                      <textarea
                        className="comment-input"
                        value={commentDraft}
                        rows={3}
                        placeholder="Panel validation note"
                        disabled={!canSubmit}
                        onChange={(event) =>
                          setCommentDraftByVendor((current) => ({
                            ...current,
                            [vendor.id]: event.target.value,
                          }))
                        }
                      />

                      <div className="action-group">
                        <button
                          type="button"
                          disabled={!canSubmit}
                          onClick={() => {
                            onSubmitValidation({
                              vendorId: vendor.id,
                              decision: 'approved',
                              comment: commentDraft.trim(),
                            });
                            setCommentDraftByVendor((current) => ({ ...current, [vendor.id]: '' }));
                          }}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="secondary-button"
                          disabled={!canSubmit}
                          onClick={() => {
                            onSubmitValidation({
                              vendorId: vendor.id,
                              decision: 'commented',
                              comment: commentDraft.trim(),
                            });
                            setCommentDraftByVendor((current) => ({ ...current, [vendor.id]: '' }));
                          }}
                        >
                          Comment
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
