import type {
  ExecutiveSummaryItem,
  HistoricalBenchmarkRecord,
  Vendor,
  VendorLayerScores,
} from '../types/domain';

interface ResultsPanelProps {
  vendors: Vendor[];
  vendorScores: VendorLayerScores[];
  executiveSummary: ExecutiveSummaryItem[];
  closeScoreFlag: boolean;
  historicalBenchmark: HistoricalBenchmarkRecord[];
  onExportExcel: () => void;
  onExportCsv: () => void;
}

export function ResultsPanel({
  vendors,
  vendorScores,
  executiveSummary,
  closeScoreFlag,
  historicalBenchmark,
  onExportExcel,
  onExportCsv,
}: ResultsPanelProps) {
  const ranked = [...vendorScores].sort((a, b) => b.riskAdjustedScore - a.riskAdjustedScore);

  return (
    <section className="stack-lg">
      <section className="panel">
        <header className="panel-header spread">
          <h3>Results</h3>
          <div className="action-group">
            <button type="button" onClick={onExportExcel}>Export Excel</button>
            <button type="button" className="secondary-button" onClick={onExportCsv}>Export CSV</button>
            <div className={closeScoreFlag ? 'badge badge-warning' : 'badge'}>
              {closeScoreFlag ? 'Close score discussion required' : 'Score spread is clear'}
            </div>
          </div>
        </header>

        <div className="table-wrap">
          <table className="plain-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Vendor</th>
                <th>L1</th>
                <th>L2</th>
                <th>L3</th>
                <th>Weighted Total</th>
                <th>Confidence</th>
                <th>Risk Adjusted</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((score, index) => (
                <tr key={score.vendorId}>
                  <td>{index + 1}</td>
                  <td>{vendors.find((vendor) => vendor.id === score.vendorId)?.name ?? score.vendorId}</td>
                  <td>{score.l1Score}</td>
                  <td>{score.l2Score}</td>
                  <td>{score.l3Score}</td>
                  <td>{score.weightedTotal}</td>
                  <td>{score.confidence}</td>
                  <td>{score.riskAdjustedScore}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h3>Executive Summary</h3>
        </header>

        <div className="table-wrap">
          <table className="plain-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Vendor</th>
                <th>Key Strengths</th>
                <th>Key Risks</th>
              </tr>
            </thead>
            <tbody>
              {executiveSummary.map((item) => (
                <tr key={item.vendorId}>
                  <td>{item.rank}</td>
                  <td>{item.vendorName}</td>
                  <td>{item.strengths.join(', ') || 'No standout strengths detected'}</td>
                  <td>{item.risks.join(', ') || 'No major risks detected'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h3>Historical Benchmarking</h3>
        </header>

        <div className="table-wrap">
          <table className="plain-table">
            <thead>
              <tr>
                <th>Recorded</th>
                <th>RFP</th>
                <th>Vendor</th>
                <th>Weighted Total</th>
                <th>Confidence</th>
                <th>Risk Adjusted</th>
              </tr>
            </thead>
            <tbody>
              {historicalBenchmark.slice(-12).reverse().map((entry) => (
                <tr key={`${entry.recordedAt}|${entry.vendorId}`}>
                  <td>{new Date(entry.recordedAt).toLocaleString()}</td>
                  <td>{entry.rfpTitle}</td>
                  <td>{entry.vendorName}</td>
                  <td>{entry.weightedTotal}</td>
                  <td>{entry.confidence}</td>
                  <td>{entry.riskAdjustedScore}</td>
                </tr>
              ))}
              {historicalBenchmark.length === 0 && (
                <tr>
                  <td colSpan={6}>No benchmark snapshots yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
