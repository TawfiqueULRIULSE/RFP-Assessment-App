import { useMemo, useState } from 'react';
import type { Criterion, Evidence, ScoreEntry, Vendor } from '../types/domain';
import { buildVendorComparisonRows } from '../lib/insights';

interface VendorComparisonViewProps {
  vendors: Vendor[];
  criteria: Criterion[];
  scores: ScoreEntry[];
  evidence: Evidence[];
}

export function VendorComparisonView({ vendors, criteria, scores, evidence }: VendorComparisonViewProps) {
  const [vendorAId, setVendorAId] = useState<string>(vendors[0]?.id ?? '');
  const [vendorBId, setVendorBId] = useState<string>(vendors[1]?.id ?? vendors[0]?.id ?? '');

  const rows = useMemo(
    () =>
      buildVendorComparisonRows({
        vendorAId,
        vendorBId,
        criteria,
        scores,
        evidence,
      }),
    [vendorAId, vendorBId, criteria, scores, evidence],
  );

  return (
    <section className="panel stack-md">
      <header className="panel-header">
        <h3>Side-by-Side Vendor Comparison</h3>
      </header>

      <div className="comparison-selectors">
        <label className="inline-control">
          Vendor A
          <select value={vendorAId} onChange={(event) => setVendorAId(event.target.value)}>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name}
              </option>
            ))}
          </select>
        </label>

        <label className="inline-control">
          Vendor B
          <select value={vendorBId} onChange={(event) => setVendorBId(event.target.value)}>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="table-wrap">
        <table className="plain-table">
          <thead>
            <tr>
              <th>Criterion</th>
              <th>Vendor A Score</th>
              <th>Vendor B Score</th>
              <th>Delta (A-B)</th>
              <th>Comments (A/B)</th>
              <th>Evidence (A/B)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.criterionId}>
                <td>{row.criterionLabel}</td>
                <td>{row.vendorAScore ?? '-'}</td>
                <td>{row.vendorBScore ?? '-'}</td>
                <td>{row.delta ?? '-'}</td>
                <td>
                  {row.vendorACommentCount}/{row.vendorBCommentCount}
                </td>
                <td>
                  {row.vendorAEvidenceCount}/{row.vendorBEvidenceCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
