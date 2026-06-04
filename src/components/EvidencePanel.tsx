import { useState } from 'react';
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
    attachmentName: string;
    addedBy: string;
  }) => void;
}

export function EvidencePanel({ vendors, criteria, evidence, currentUser, canAdd, onAddEvidence }: EvidencePanelProps) {
  const [vendorId, setVendorId] = useState<string>(vendors[0]?.id ?? '');
  const [criterionId, setCriterionId] = useState<string>(criteria[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [attachmentName, setAttachmentName] = useState('');

  return (
    <section className="panel stack-md">
      <header className="panel-header">
        <h3>Evidence Layer</h3>
      </header>

      <form
        className="evidence-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canAdd) {
            return;
          }

          if (!title.trim() || !url.trim()) {
            return;
          }

          onAddEvidence({
            vendorId,
            criterionId,
            title: title.trim(),
            url: url.trim(),
            attachmentName: attachmentName.trim(),
            addedBy: currentUser.name,
          });

          setTitle('');
          setUrl('');
          setAttachmentName('');
        }}
      >
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
          Attachment name (optional)
          <input
            value={attachmentName}
            onChange={(event) => setAttachmentName(event.target.value)}
            placeholder="security-test-report.pdf"
            disabled={!canAdd}
          />
        </label>

        <button type="submit" disabled={!canAdd}>Attach evidence</button>
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
                <td>{item.attachmentName || '-'}</td>
                <td>{item.addedBy}</td>
                <td>{new Date(item.addedAt).toLocaleString()}</td>
              </tr>
            ))}
            {evidence.length === 0 && (
              <tr>
                <td colSpan={6}>No evidence attached yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
