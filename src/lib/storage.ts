import type { HistoricalBenchmarkRecord, VendorLayerScores, Vendor } from '../types/domain';

export const appendBenchmarkSnapshot = (
  existing: HistoricalBenchmarkRecord[],
  rfpId: string,
  rfpTitle: string,
  vendors: Vendor[],
  vendorScores: VendorLayerScores[],
): HistoricalBenchmarkRecord[] => {
  const snapshot = vendorScores.map((score) => ({
    rfpId,
    rfpTitle,
    vendorId: score.vendorId,
    vendorName: vendors.find((vendor) => vendor.id === score.vendorId)?.name ?? score.vendorId,
    weightedTotal: score.weightedTotal,
    confidence: score.confidence,
    riskAdjustedScore: score.riskAdjustedScore,
    recordedAt: new Date().toISOString(),
  }));

  return [...existing, ...snapshot].slice(-1000);
};
