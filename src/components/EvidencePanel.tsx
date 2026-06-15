import { useRef, useState } from 'react';
import { evidenceDownloadUrl } from '../services/evidenceService';
import { buildAuthHeaders } from '../services/api';
import type { Criterion, Evidence, User, Vendor } from '../types/domain';

interface EvidencePanelProps {
  vendors: Vendor[];
  criteria: Criterion[];
  evidence: Evidence[];
  currentUser: User;
  canAdd: boolean;
  onAddEvidence: (input: {
    vendorId: string;
    criterionId: string;
    title: string;
    url: string;
    addedBy: string;
    file?: File;
    onProgress?: (percent: number) => void;
  }) => Promise<void>;
  onDeleteEvidence?: (evidenceId: string) => Promise<void>;
}

export function EvidencePanel({ vendors, criteria, evidence, currentUser, canAdd, onAddEvidence, onDeleteEvidence }: EvidencePanelProps) {
  const [vendorId, setVendorId] = useState<string>(vendors[0]?.id ?? '');
  const [criterionId, setCriterionId] = useState<string>(criteria[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.png', '.jpg', '.jpeg'];
  const MAX_FILE_SIZE_MB = 10;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setSelectedFile(null);
      return;
    }

    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setFormError(`Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
      setSelectedFile(null);
      event.target.value = '';
      return;
    }

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setFormError(`File exceeds the ${MAX_FILE_SIZE_MB} MB size limit.`);
      setSelectedFile(null);
      event.target.value = '';
      return;
    }

    setFormError(null);
    setSelectedFile(file);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canAdd || isSubmitting) return;
    if (!title.trim() || !url.trim()) return;

    setFormError(null);
    setIsSubmitting(true);
    setUploadProgress(null);

    try {
      await onAddEvidence({
        vendorId,
        criterionId,
        title: title.trim(),
        url: url.trim(),
        addedBy: currentUser.name,
        file: selectedFile ?? undefined,
        onProgress: selectedFile ? setUploadProgress : undefined,
      });

      setTitle('');
      setUrl('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to add evidence.');
    } finally {
      setIsSubmitting(false);
      setUploadProgress(null);
    }
  };

  const handleDelete = async (evidenceId: string) => {
    if (!onDeleteEvidence) return;
    try {
      await onDeleteEvidence(evidenceId);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to delete evidence.');
    }
  };

  const handleDownload = async (item: Evidence) => {
    try {
      const response = await fetch(evidenceDownloadUrl(item.id), {
        headers: buildAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error(`Download failed (${response.status})`);
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = item.attachmentName || 'attachment';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Download failed.');
    }
  };

  return (
    <section className="panel stack-md">
      <header className="panel-header">
        <h3>Evidence Layer</h3>
      </header>

      <form className="evidence-form" onSubmit={(e) => { void handleSubmit(e); }}>
        <label>
          Vendor
          <select value={vendorId} onChange={(event) => setVendorId(event.target.value)} disabled={!canAdd}>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Criterion
          <select value={criterionId} onChange={(event) => setCriterionId(event.target.value)} disabled={!canAdd}>
            {criteria.map((criterion) => (
              <option key={criterion.id} value={criterion.id}>
                {criterion.layer}: {criterion.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Evidence title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Evaluation workbook"
            disabled={!canAdd}
          />
        </label>

        <label>
          Link URL
          <input
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://..."
            disabled={!canAdd}
          />
        </label>

        <label>
          Attachment (optional — PDF, DOCX, PNG, JPG, max 10 MB)
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.png,.jpg,.jpeg"
            onChange={handleFileChange}
            disabled={!canAdd}
          />
        </label>

        {selectedFile && (
          <p className="muted">Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)</p>
        )}

        {uploadProgress !== null && (
          <div className="upload-progress">
            <div className="upload-progress-bar" style={{ width: `${uploadProgress}%` }} />
            <span>{uploadProgress}%</span>
          </div>
        )}

        {formError && <p className="error-message">{formError}</p>}

        <button type="submit" disabled={!canAdd || isSubmitting}>
          {isSubmitting ? 'Uploading…' : 'Attach evidence'}
        </button>
      </form>

      {!canAdd && <p className="muted">Only Primary Owner can add evidence in this phase.</p>}

      <div className="table-wrap">
        <table className="plain-table">
          <thead>
            <tr>
              <th>Vendor</th>
              <th>Criterion</th>
              <th>Evidence</th>
              <th>Attachment</th>
              <th>Added By</th>
              <th>Added At</th>
              {canAdd && onDeleteEvidence && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {evidence.map((item) => (
              <tr key={item.id}>
                <td>{vendors.find((vendor) => vendor.id === item.vendorId)?.name ?? item.vendorId}</td>
                <td>{criteria.find((criterion) => criterion.id === item.criterionId)?.label ?? item.criterionId}</td>
                <td>
                  <a href={item.url} target="_blank" rel="noreferrer">
                    {item.title}
                  </a>
                </td>
                <td>
                  {item.hasAttachment ? (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => { void handleDownload(item); }}
                    >
                      {item.attachmentName || 'Download'}
                    </button>
                  ) : (
                    item.attachmentName || '-'
                  )}
                </td>
                <td>{item.addedBy}</td>
                <td>{new Date(item.addedAt).toLocaleString()}</td>
                {canAdd && onDeleteEvidence && (
                  <td>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => { void handleDelete(item.id); }}
                    >
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {evidence.length === 0 && (
              <tr>
                <td colSpan={canAdd && onDeleteEvidence ? 7 : 6}>No evidence attached yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
