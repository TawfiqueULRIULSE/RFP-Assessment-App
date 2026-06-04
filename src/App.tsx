import { useEffect, useMemo, useState } from 'react';
import { ConfigPanel } from './components/ConfigPanel';
import { EvidencePanel } from './components/EvidencePanel';
import { L1AssessmentSection } from './components/L1AssessmentSection';
import { L1VarianceHeatmap } from './components/L1VarianceHeatmap';
import { PanelValidationView } from './components/PanelValidationView';
import { AuditTimeline } from './components/AuditTimeline';
import { ResultsPanel } from './components/ResultsPanel';
import { ScoringGrid } from './components/ScoringGrid';
import { VendorComparisonView } from './components/VendorComparisonView';
import { DEFAULT_APP_CONFIG } from './config/defaults';
import {
  appUsers as seedAppUsers,
  assessors as seedAssessors,
  criteria as seedCriteria,
  currentRfp as seedCurrentRfp,
  initialEvidence as seedEvidence,
  initialPanelValidations,
  initialScores as seedScores,
  panelReviewers as seedPanelReviewers,
  primaryOwner as seedPrimaryOwner,
  vendors as seedVendors,
} from './data/seed';
import { canAddEvidence, canEditComment, canEditScore, canSubmitPanelValidation } from './lib/permissions';
import { exportRankingCsv, exportWorkbook } from './lib/export';
import { deriveExecutiveSummary } from './lib/reporting';
import {
  calculateVendorScores,
  consolidateL1,
  hasCloseScoreDiscussionFlagByThreshold,
} from './lib/scoring';
import { appendBenchmarkSnapshot } from './lib/storage';
import { fetchBenchmarks, saveBenchmarks } from './services/benchmarkService';
import { fetchScoreAuditEvents } from './services/auditService';
import { fetchComments } from './services/commentService';
import { fetchAppConfig, updateAppConfig } from './services/configService';
import { createEvidence, fetchEvidence } from './services/evidenceService';
import { fetchAuthUsers, loginAsUser, logoutSession, restoreSession } from './services/authService';
import { createPanelValidation, fetchPanelValidations } from './services/panelValidationService';
import { fetchRfpBundle, toAssessorWithWeights } from './services/rfpService';
import { fetchScores, updateScore } from './services/scoreService';
import type {
  AppUser,
  AppConfig,
  Assessor,
  CommentEntry,
  Criterion,
  Evidence,
  HistoricalBenchmarkRecord,
  PanelValidationDecision,
  PanelValidationEntry,
  PanelReviewer,
  Rfp,
  ScoreAuditEvent,
  ScoreEntry,
  User,
  Vendor,
} from './types/domain';

type AppTab = 'overview' | 'l1' | 'l2l3' | 'results' | 'audit';

function App() {
  const [currentRfp, setCurrentRfp] = useState<Rfp>(seedCurrentRfp);
  const [vendors, setVendors] = useState<Vendor[]>(seedVendors);
  const [criteria, setCriteria] = useState<Criterion[]>(seedCriteria);
  const [assessors, setAssessors] = useState<Assessor[]>(seedAssessors);
  const [panelReviewers, setPanelReviewers] = useState<PanelReviewer[]>(seedPanelReviewers);
  const [primaryOwner, setPrimaryOwner] = useState<User>(seedPrimaryOwner);
  const [appUsers, setAppUsers] = useState<AppUser[]>(seedAppUsers);
  const [scores, setScores] = useState<ScoreEntry[]>(seedScores);
  const [evidence, setEvidence] = useState<Evidence[]>(seedEvidence);
  const [comments, setComments] = useState<CommentEntry[]>([]);
  const [historicalBenchmark, setHistoricalBenchmark] = useState<HistoricalBenchmarkRecord[]>([]);
  const [activeUser, setActiveUser] = useState<AppUser | null>(null);
  const [loginUserId, setLoginUserId] = useState<string>(seedAppUsers[0]?.id ?? '');
  const [panelValidations, setPanelValidations] = useState<PanelValidationEntry[]>(initialPanelValidations);
  const [scoreAuditEvents, setScoreAuditEvents] = useState<ScoreAuditEvent[]>([]);
  const [appConfig, setAppConfig] = useState<AppConfig>(DEFAULT_APP_CONFIG);
  const [activeTab, setActiveTab] = useState<AppTab>('overview');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    const initializeAuth = async () => {
      setIsLoading(true);
      setApiError(null);

      try {
        const users = await fetchAuthUsers();
        setAppUsers(users);
        setLoginUserId(users[0]?.id ?? '');

        const restoredUser = await restoreSession();
        if (restoredUser) {
          setActiveUser(restoredUser);
        }
      } catch {
        setApiError('Authentication service unavailable. Start it with npm run dev:api.');
      } finally {
        setIsLoading(false);
      }
    };

    void initializeAuth();
  }, []);

  useEffect(() => {
    if (!activeUser) {
      return;
    }

    const load = async () => {
      setIsLoading(true);
      setApiError(null);

      try {
        const bundle = await fetchRfpBundle();
        const nextRfp = bundle.rfps[0] ?? seedCurrentRfp;
        const nextAssessors = toAssessorWithWeights(bundle.assessors, seedAssessors);
        const nextAppUsers: AppUser[] = [
          { id: bundle.primaryOwner.id, name: bundle.primaryOwner.name, role: 'Primary Owner' },
          ...nextAssessors.map((assessor) => ({
            id: assessor.id,
            name: assessor.name,
            role: 'Assessor' as const,
          })),
          ...bundle.panelReviewers.map((reviewer) => ({
            id: reviewer.id,
            name: reviewer.name,
            role: 'Panel Reviewer' as const,
          })),
        ];

        const [loadedScores, loadedEvidence, loadedComments, loadedBenchmarks, loadedPanelValidations] = await Promise.all([
          fetchScores(nextRfp.id),
          fetchEvidence(nextRfp.id),
          fetchComments(nextRfp.id),
          fetchBenchmarks(nextRfp.id),
          fetchPanelValidations(nextRfp.id),
        ]);
        const loadedConfig = await fetchAppConfig();
        const loadedAuditEvents = await fetchScoreAuditEvents(nextRfp.id);

        setCurrentRfp(nextRfp);
        setVendors(bundle.vendors);
        setCriteria(bundle.criteria);
        setAssessors(nextAssessors);
        setPanelReviewers(bundle.panelReviewers);
        setPrimaryOwner(bundle.primaryOwner);
        setAppUsers(nextAppUsers);
        setScores(loadedScores);
        setEvidence(loadedEvidence);
        setComments(loadedComments);
        setHistoricalBenchmark(loadedBenchmarks);
        setPanelValidations(loadedPanelValidations);
        setScoreAuditEvents(loadedAuditEvents);
        setAppConfig(loadedConfig);
      } catch {
        setApiError('Mock API unavailable. Start it with npm run dev:api.');
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [activeUser]);

  const consolidatedL1 = useMemo(() => consolidateL1(scores, criteria, vendors, assessors), [scores, criteria, vendors, assessors]);

  const vendorScores = useMemo(
    () => calculateVendorScores(scores, criteria, vendors, assessors, appConfig),
    [scores, criteria, vendors, assessors, appConfig],
  );

  const closeScoreFlag = useMemo(
    () => hasCloseScoreDiscussionFlagByThreshold(vendorScores, appConfig.closeScoreThreshold),
    [vendorScores, appConfig.closeScoreThreshold],
  );

  const executiveSummary = useMemo(
    () =>
      deriveExecutiveSummary({
        vendors,
        criteria,
        vendorScores,
        scores,
        comments,
      }),
    [vendors, criteria, vendorScores, scores, comments],
  );

  const ownerScores = useMemo(
    () => scores.filter((score) => score.layer !== 'L1' && score.ownerId === primaryOwner.id),
    [scores, primaryOwner.id],
  );

  const upsertScoreValue = (scoreId: string, nextValue: number | null) => {
    if (!activeUser) {
      return;
    }

    const target = scores.find((entry) => entry.id === scoreId);
    if (!target || !canEditScore(activeUser, target, assessors)) {
      return;
    }

    const previousValue = target.value;

    setScores((current) =>
      current.map((entry) =>
        entry.id === scoreId
          ? {
              ...entry,
              value: nextValue,
              updatedAt: new Date().toISOString(),
            }
          : entry,
      ),
    );

    void (async () => {
      try {
        const updated = await updateScore(scoreId, { value: nextValue });
        setScores((current) => current.map((entry) => (entry.id === scoreId ? updated.score : entry)));
        setScoreAuditEvents((current) => [...current, updated.auditEvent]);
      } catch (error) {
        setApiError(error instanceof Error ? error.message : 'Unable to persist score update.');
        setScores((current) =>
          current.map((entry) =>
            entry.id === scoreId
              ? {
                  ...entry,
                  value: previousValue,
                }
              : entry,
          ),
        );
      }
    })();
  };

  const upsertScoreComment = (scoreId: string, nextComment: string) => {
    if (!activeUser) {
      return;
    }

    const target = scores.find((entry) => entry.id === scoreId);
    if (!target || !canEditComment(activeUser, target, assessors)) {
      return;
    }

    const previousComment = target.comment;

    setScores((current) =>
      current.map((entry) =>
        entry.id === scoreId
          ? {
              ...entry,
              comment: nextComment,
              updatedAt: new Date().toISOString(),
            }
          : entry,
      ),
    );

    void (async () => {
      try {
        const updated = await updateScore(scoreId, { comment: nextComment });
        setScores((current) => current.map((entry) => (entry.id === scoreId ? updated.score : entry)));
        setScoreAuditEvents((current) => [...current, updated.auditEvent]);
      } catch (error) {
        setApiError(error instanceof Error ? error.message : 'Unable to persist comment update.');
        setScores((current) =>
          current.map((entry) =>
            entry.id === scoreId
              ? {
                  ...entry,
                  comment: previousComment,
                }
              : entry,
          ),
        );
      }
    })();
  };

  const addEvidence = (input: {
    vendorId: string;
    criterionId: string;
    title: string;
    url: string;
    attachmentName: string;
    addedBy: string;
  }) => {
    if (!activeUser) {
      return;
    }

    if (!canAddEvidence(activeUser)) {
      return;
    }

    void (async () => {
      try {
        const created = await createEvidence({
          rfpId: currentRfp.id,
          vendorId: input.vendorId,
          criterionId: input.criterionId,
          title: input.title,
          url: input.url,
          attachmentName: input.attachmentName,
          addedBy: input.addedBy,
        });

        setEvidence((current) => [...current, created]);
      } catch (error) {
        setApiError(error instanceof Error ? error.message : 'Unable to persist evidence item.');
      }
    })();
  };

  const submitPanelValidation = (input: {
    vendorId: string;
    decision: PanelValidationDecision;
    comment: string;
  }) => {
    if (!activeUser) {
      return;
    }

    if (!canSubmitPanelValidation(activeUser, panelReviewers)) {
      return;
    }

    void (async () => {
      try {
        const createdValidation = await createPanelValidation({
          rfpId: currentRfp.id,
          vendorId: input.vendorId,
          decision: input.decision,
          comment: input.comment,
        });

        setPanelValidations((current) => [...current, createdValidation]);
      } catch (error) {
        setApiError(error instanceof Error ? error.message : 'Unable to persist panel validation.');
      }
    })();
  };

  const saveBenchmarkSnapshot = () => {
    const nextSnapshot = appendBenchmarkSnapshot(
      historicalBenchmark,
      currentRfp.id,
      currentRfp.title,
      vendors,
      vendorScores,
    );

    setHistoricalBenchmark(nextSnapshot);

    void (async () => {
      try {
        const saved = await saveBenchmarks(currentRfp.id, nextSnapshot);
        setHistoricalBenchmark(saved);
      } catch (error) {
        setApiError(error instanceof Error ? error.message : 'Unable to persist benchmark snapshot.');
      }
    })();
  };

  const l2l3Criteria = criteria.filter((criterion) => criterion.layer !== 'L1');

  const saveConfig = (nextConfig: AppConfig) => {
    setAppConfig(nextConfig);

    void (async () => {
      try {
        const persisted = await updateAppConfig(nextConfig);
        setAppConfig(persisted);
      } catch (error) {
        setApiError(error instanceof Error ? error.message : 'Unable to persist config changes.');
      }
    })();
  };

  const exportExcelReport = () => {
    exportWorkbook({
      fileName: `${currentRfp.title.replace(/\s+/g, '_')}_report.xlsx`,
      vendors,
      criteria,
      scores,
      comments,
      evidence,
      vendorScores,
      executiveSummary,
    });
  };

  const exportCsvRanking = () => {
    exportRankingCsv({
      fileName: `${currentRfp.title.replace(/\s+/g, '_')}_ranking.csv`,
      vendors,
      vendorScores,
    });
  };

  const handleLogin = () => {
    if (!loginUserId) {
      return;
    }

    void (async () => {
      setIsLoading(true);
      setApiError(null);

      try {
        const user = await loginAsUser(loginUserId);
        setActiveUser(user);
        setActiveTab('overview');
      } catch (error) {
        setApiError(error instanceof Error ? error.message : 'Unable to sign in.');
      } finally {
        setIsLoading(false);
      }
    })();
  };

  const handleLogout = () => {
    void (async () => {
      setIsLoading(true);

      try {
        await logoutSession();
      } finally {
        setActiveUser(null);
        setIsLoading(false);
      }
    })();
  };

  return (
    <main className="app-shell">
      <header className="hero">
        <h1>RFP Scoring App</h1>
        <p>{currentRfp.title}</p>
        <div className="hero-meta">
          <span>
            Layer Weights: L1 {Math.round(appConfig.layerWeights.L1 * 100)}%, L2 {Math.round(appConfig.layerWeights.L2 * 100)}%, L3 {Math.round(appConfig.layerWeights.L3 * 100)}%
          </span>
          <span>Close score threshold: {Math.round(appConfig.closeScoreThreshold * 100)}%</span>
          <span>Signed in: {activeUser?.name ?? 'Not signed in'}</span>
          <span>Role: {activeUser?.role ?? '-'}</span>
          <span>Persisted comments: {comments.length}</span>
        </div>
        <div className="actor-switch">
          {activeUser ? (
            <button type="button" className="secondary-button" onClick={handleLogout}>
              Sign out
            </button>
          ) : (
            <div className="action-group">
              <label className="inline-control">
                Sign in as
                <select value={loginUserId} onChange={(event) => setLoginUserId(event.target.value)}>
                  {appUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} - {user.role}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={handleLogin} disabled={!loginUserId || isLoading}>
                Sign in
              </button>
            </div>
          )}
        </div>
      </header>

      {isLoading && <section className="panel">Loading data from mock API...</section>}
      {apiError && <section className="panel error-banner">{apiError}</section>}

      {!activeUser && !isLoading && (
        <section className="panel">
          Sign in to continue. The app now uses API-backed sessions instead of simulated role switching.
        </section>
      )}

      {activeUser && (
        <>
          <section className="panel">
            <div className="tab-row">
              <button type="button" className={activeTab === 'overview' ? 'tab-active' : ''} onClick={() => setActiveTab('overview')}>Overview</button>
              <button type="button" className={activeTab === 'l1' ? 'tab-active' : ''} onClick={() => setActiveTab('l1')}>L1</button>
              <button type="button" className={activeTab === 'l2l3' ? 'tab-active' : ''} onClick={() => setActiveTab('l2l3')}>L2/L3</button>
              <button type="button" className={activeTab === 'results' ? 'tab-active' : ''} onClick={() => setActiveTab('results')}>Results</button>
              <button type="button" className={activeTab === 'audit' ? 'tab-active' : ''} onClick={() => setActiveTab('audit')}>Audit</button>
            </div>
          </section>

          {activeTab === 'overview' && (
            <>
              <ConfigPanel activeUser={activeUser} config={appConfig} onSave={saveConfig} />
              <VendorComparisonView vendors={vendors} criteria={criteria} scores={scores} evidence={evidence} />
              <L1VarianceHeatmap vendors={vendors} criteria={criteria} scores={scores} />
            </>
          )}

          {activeTab === 'l1' && (
            <>
              <L1AssessmentSection
                criteria={criteria}
                vendors={vendors}
                assessors={assessors}
                activeUser={activeUser}
                scores={scores}
                evidence={evidence}
                consolidatedScores={consolidatedL1}
                canEditScore={(score) => canEditScore(activeUser, score, assessors)}
                canEditComment={(score) => canEditComment(activeUser, score, assessors)}
                onScoreChange={upsertScoreValue}
                onCommentChange={upsertScoreComment}
              />
              <L1VarianceHeatmap vendors={vendors} criteria={criteria} scores={scores} />
            </>
          )}

          {activeTab === 'l2l3' && (
            <>
              <ScoringGrid
                title="L2 Commercial + L3 Familiarity (Primary Owner)"
                criteria={l2l3Criteria}
                vendors={vendors}
                scores={ownerScores}
                evidence={evidence}
                canEditScore={(score) => canEditScore(activeUser, score, assessors)}
                canEditComment={(score) => canEditComment(activeUser, score, assessors)}
                onScoreChange={upsertScoreValue}
                onCommentChange={upsertScoreComment}
              />

              <PanelValidationView
                vendors={vendors}
                criteria={criteria}
                ownerScores={ownerScores}
                activeUser={activeUser}
                canSubmit={canSubmitPanelValidation(activeUser, panelReviewers)}
                panelReviewers={panelReviewers}
                validations={panelValidations}
                onSubmitValidation={submitPanelValidation}
              />

              <EvidencePanel
                vendors={vendors}
                criteria={criteria}
                evidence={evidence}
                currentUser={activeUser}
                canAdd={canAddEvidence(activeUser)}
                onAddEvidence={addEvidence}
              />
            </>
          )}

          {activeTab === 'results' && (
            <>
              <section className="panel actions-row">
                <button type="button" onClick={saveBenchmarkSnapshot}>
                  Save benchmark snapshot
                </button>
              </section>

              <ResultsPanel
                vendors={vendors}
                vendorScores={vendorScores}
                executiveSummary={executiveSummary}
                closeScoreFlag={closeScoreFlag}
                historicalBenchmark={historicalBenchmark}
                onExportExcel={exportExcelReport}
                onExportCsv={exportCsvRanking}
              />
            </>
          )}

          {activeTab === 'audit' && (
            <AuditTimeline
              events={scoreAuditEvents}
              vendors={vendors}
              criteria={criteria}
              users={appUsers}
            />
          )}
        </>
      )}
    </main>
  );
}

export default App;
