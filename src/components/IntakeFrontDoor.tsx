import { useEffect, useMemo, useState } from 'react';
import type { Rfp, RfpIngestJob } from '../types/domain';

interface IntakeFrontDoorProps {
  records: Rfp[];
  selectedRfpId: string;
  onSelectRfp: (rfpId: string) => void;
  onCreateRecord: (input: {
    title: string;
    organization: string;
    dueDate: string;
  }) => Promise<Rfp>;
  onStartIngest: (input: {
    title: string;
    organization: string;
    dueDate: string;
    fileName: string;
    fileType: string;
  }) => Promise<{ record: Rfp; job: RfpIngestJob }>;
  onPollIngestJob: (rfpId: string, jobId: string) => Promise<RfpIngestJob>;
  onApplyIngestDraft: (rfpId: string, jobId: string) => Promise<void>;
  onError: (message: string) => void;
}

const emptyCreateForm = {
  title: '',
  organization: '',
  dueDate: '',
};

const emptyIngestForm = {
  title: '',
  organization: '',
  dueDate: '',
  fileName: '',
  fileType: 'application/pdf',
};

const toReadableStatus = (status?: string) => {
  if (!status) {
    return 'Not started';
  }

  return status.charAt(0).toUpperCase() + status.slice(1);
};

export function IntakeFrontDoor({
  records,
  selectedRfpId,
  onSelectRfp,
  onCreateRecord,
  onStartIngest,
  onPollIngestJob,
  onApplyIngestDraft,
  onError,
}: IntakeFrontDoorProps) {
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [ingestForm, setIngestForm] = useState(emptyIngestForm);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [isSubmittingIngest, setIsSubmittingIngest] = useState(false);
  const [isApplyingDraft, setIsApplyingDraft] = useState(false);
  const [activeJob, setActiveJob] = useState<{ rfpId: string; job: RfpIngestJob } | null>(null);

  useEffect(() => {
    if (!activeJob) {
      return;
    }

    if (activeJob.job.status === 'ready' || activeJob.job.status === 'failed') {
      return;
    }

    const intervalId = window.setInterval(() => {
      void (async () => {
        try {
          const nextJob = await onPollIngestJob(activeJob.rfpId, activeJob.job.id);
          setActiveJob({ rfpId: activeJob.rfpId, job: nextJob });
        } catch (error) {
          onError(error instanceof Error ? error.message : 'Unable to refresh ingest job status.');
        }
      })();
    }, 1200);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeJob, onError, onPollIngestJob]);

  const selectedRecord = useMemo(
    () => records.find((record) => record.id === selectedRfpId) ?? records[0] ?? null,
    [records, selectedRfpId],
  );

  return (
    <section className="panel stack-lg">
      <header className="panel-header spread">
        <h3>Intake Front Door</h3>
        <span className="badge badge-info">Primary Owner</span>
      </header>

      <p className="muted">
        Create a new RFP record or ingest an existing document to generate draft Layer 1 variables.
      </p>

      <div className="intake-grid">
        <form
          className="stack-md intake-card"
          onSubmit={(event) => {
            event.preventDefault();

            void (async () => {
              setIsSubmittingCreate(true);

              try {
                const created = await onCreateRecord(createForm);
                onSelectRfp(created.id);
                setCreateForm(emptyCreateForm);
              } catch (error) {
                onError(error instanceof Error ? error.message : 'Unable to create RFP record.');
              } finally {
                setIsSubmittingCreate(false);
              }
            })();
          }}
        >
          <h4>Create RFP Doc</h4>
          <label>
            RFP title
            <input
              type="text"
              required
              value={createForm.title}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Organization
            <input
              type="text"
              required
              value={createForm.organization}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  organization: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Due date
            <input
              type="date"
              required
              value={createForm.dueDate}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  dueDate: event.target.value,
                }))
              }
            />
          </label>
          <button type="submit" disabled={isSubmittingCreate}>
            {isSubmittingCreate ? 'Creating...' : 'Create record'}
          </button>
        </form>

        <form
          className="stack-md intake-card"
          onSubmit={(event) => {
            event.preventDefault();

            void (async () => {
              setIsSubmittingIngest(true);

              try {
                const started = await onStartIngest(ingestForm);
                onSelectRfp(started.record.id);
                setActiveJob({ rfpId: started.record.id, job: started.job });
                setIngestForm(emptyIngestForm);
              } catch (error) {
                onError(error instanceof Error ? error.message : 'Unable to start ingest workflow.');
              } finally {
                setIsSubmittingIngest(false);
              }
            })();
          }}
        >
          <h4>Ingest Existing RFP Doc</h4>
          <label>
            RFP title
            <input
              type="text"
              required
              value={ingestForm.title}
              onChange={(event) =>
                setIngestForm((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Organization
            <input
              type="text"
              required
              value={ingestForm.organization}
              onChange={(event) =>
                setIngestForm((current) => ({
                  ...current,
                  organization: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Due date
            <input
              type="date"
              required
              value={ingestForm.dueDate}
              onChange={(event) =>
                setIngestForm((current) => ({
                  ...current,
                  dueDate: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Source file name
            <input
              type="text"
              required
              placeholder="example-rfp.pdf"
              value={ingestForm.fileName}
              onChange={(event) =>
                setIngestForm((current) => ({
                  ...current,
                  fileName: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Source file type
            <select
              value={ingestForm.fileType}
              onChange={(event) =>
                setIngestForm((current) => ({
                  ...current,
                  fileType: event.target.value,
                }))
              }
            >
              <option value="application/pdf">PDF</option>
              <option value="application/msword">DOC</option>
              <option value="application/vnd.openxmlformats-officedocument.wordprocessingml.document">DOCX</option>
              <option value="text/plain">TXT</option>
            </select>
          </label>
          <button type="submit" disabled={isSubmittingIngest}>
            {isSubmittingIngest ? 'Starting ingest...' : 'Create + ingest'}
          </button>
        </form>
      </div>

      {activeJob && (
        <section className="intake-job panel">
          <div className="panel-header spread">
            <h4>Ingest Job Status</h4>
            <span className="badge badge-neutral">{toReadableStatus(activeJob.job.status)}</span>
          </div>
          <p className="muted">
            Record: {records.find((record) => record.id === activeJob.rfpId)?.title ?? activeJob.rfpId}
          </p>
          <p className="muted">Source file: {activeJob.job.fileName}</p>
          {activeJob.job.status === 'ready' && (
            <>
              <div className="table-wrap">
                <table className="plain-table">
                  <thead>
                    <tr>
                      <th>Layer</th>
                      <th>Variable</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeJob.job.generatedL1Draft.map((criterion) => (
                      <tr key={criterion.id}>
                        <td>{criterion.layer}</td>
                        <td>{criterion.label}</td>
                        <td>{criterion.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="actions-row">
                <button
                  type="button"
                  disabled={isApplyingDraft}
                  onClick={() => {
                    void (async () => {
                      setIsApplyingDraft(true);

                      try {
                        await onApplyIngestDraft(activeJob.rfpId, activeJob.job.id);
                      } catch (error) {
                        onError(error instanceof Error ? error.message : 'Unable to apply generated Layer 1 draft.');
                      } finally {
                        setIsApplyingDraft(false);
                      }
                    })();
                  }}
                >
                  {isApplyingDraft ? 'Applying...' : 'Apply Layer 1 draft'}
                </button>
              </div>
            </>
          )}
          {activeJob.job.status === 'failed' && (
            <p className="muted">{activeJob.job.errorMessage ?? 'Ingest failed. Try another file.'}</p>
          )}
        </section>
      )}

      <section className="stack-md">
        <header className="panel-header spread">
          <h4>RFP Records</h4>
          <span className="badge">{records.length} records</span>
        </header>
        <div className="table-wrap">
          <table className="plain-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Organization</th>
                <th>Due</th>
                <th>Intake</th>
                <th>Status</th>
                <th>Open</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td>{record.title}</td>
                  <td>{record.organization || '-'}</td>
                  <td>{record.dueDate || '-'}</td>
                  <td>{record.intakeMethod || '-'}</td>
                  <td>{toReadableStatus(record.intakeStatus)}</td>
                  <td>
                    <button type="button" className="secondary-button" onClick={() => onSelectRfp(record.id)}>
                      {selectedRecord?.id === record.id ? 'Current' : 'Select'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
