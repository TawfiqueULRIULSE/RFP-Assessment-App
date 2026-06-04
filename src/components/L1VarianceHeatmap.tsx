import { useMemo } from 'react';
import type { Criterion, ScoreEntry, Vendor } from '../types/domain';
import { buildL1VarianceMatrix } from '../lib/insights';

interface L1VarianceHeatmapProps {
  vendors: Vendor[];
  criteria: Criterion[];
  scores: ScoreEntry[];
}

const getVarianceClass = (stdDev: number): string => {
  if (stdDev <= 4) {
    return 'heat-low';
  }

  if (stdDev <= 8) {
    return 'heat-medium';
  }

  return 'heat-high';
};

export function L1VarianceHeatmap({ vendors, criteria, scores }: L1VarianceHeatmapProps) {
  const l1Criteria = criteria.filter((criterion) => criterion.layer === 'L1');

  const matrix = useMemo(
    () =>
      buildL1VarianceMatrix({
        vendors,
        criteria,
        scores,
      }),
    [vendors, criteria, scores],
  );

  return (
    <section className="panel stack-md">
      <header className="panel-header">
        <h3>L1 Variance Heatmap (Assessor Spread)</h3>
      </header>

      <div className="table-wrap">
        <table className="plain-table">
          <thead>
            <tr>
              <th>Vendor</th>
              {l1Criteria.map((criterion) => (
                <th key={criterion.id}>{criterion.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vendors.map((vendor) => (
              <tr key={vendor.id}>
                <td>{vendor.name}</td>
                {l1Criteria.map((criterion) => {
                  const cell = matrix.find(
                    (item) => item.vendorId === vendor.id && item.criterionId === criterion.id,
                  );
                  const stdDev = cell?.stdDev ?? 0;

                  return (
                    <td key={criterion.id} className={getVarianceClass(stdDev)}>
                      {stdDev}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="heat-legend">
        <span className="heat-low">Low variance</span>
        <span className="heat-medium">Medium variance</span>
        <span className="heat-high">High variance</span>
      </div>
    </section>
  );
}
