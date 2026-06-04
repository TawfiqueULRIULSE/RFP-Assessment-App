import type { HistoricalBenchmarkRecord } from '../types/domain';
import { apiRequest } from './api';

interface BenchmarksResponse {
  benchmarks: HistoricalBenchmarkRecord[];
}

export const fetchBenchmarks = async (rfpId: string): Promise<HistoricalBenchmarkRecord[]> => {
  const response = await apiRequest<BenchmarksResponse>(`/rfps/${encodeURIComponent(rfpId)}/benchmarks`);
  return response.benchmarks;
};

export const saveBenchmarks = async (
  rfpId: string,
  benchmarks: HistoricalBenchmarkRecord[],
): Promise<HistoricalBenchmarkRecord[]> => {
  const response = await apiRequest<BenchmarksResponse>(`/rfps/${encodeURIComponent(rfpId)}/benchmarks`, {
    method: 'POST',
    body: JSON.stringify({ benchmarks }),
  });

  return response.benchmarks;
};
