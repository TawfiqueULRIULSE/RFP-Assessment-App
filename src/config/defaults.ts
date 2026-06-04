import type { AppConfig, LayerConfig } from '../types/domain';

export const LAYERS: LayerConfig[] = [
  { id: 'L1', label: 'Technical', weight: 0.55 },
  { id: 'L2', label: 'Commercial', weight: 0.3 },
  { id: 'L3', label: 'Familiarity', weight: 0.15 },
];

export const CLOSE_SCORE_THRESHOLD = 0.03;

export const CONFIDENCE_BASELINE = 100;

export const DEFAULT_APP_CONFIG: AppConfig = {
  layerWeights: {
    L1: 0.55,
    L2: 0.3,
    L3: 0.15,
  },
  closeScoreThreshold: CLOSE_SCORE_THRESHOLD,
  confidenceBaseline: CONFIDENCE_BASELINE,
  confidenceVarianceImpact: 0.4,
  riskAdjustmentFloor: 0.7,
  riskAdjustmentScale: 0.3,
};

export const SCORE_MIN = 0;
export const SCORE_MAX = 100;
