import { useEffect, useState } from 'react';
import type { AppConfig, AppUser } from '../types/domain';

interface ConfigPanelProps {
  activeUser: AppUser;
  config: AppConfig;
  onSave: (nextConfig: AppConfig) => void;
}

const toNumber = (value: string, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export function ConfigPanel({ activeUser, config, onSave }: ConfigPanelProps) {
  const [draft, setDraft] = useState<AppConfig>(config);

  useEffect(() => {
    setDraft(config);
  }, [config]);

  const canEdit = activeUser.role === 'Primary Owner';

  return (
    <section className="panel stack-md">
      <header className="panel-header">
        <h3>Scoring Config</h3>
      </header>

      <form
        className="config-grid"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canEdit) {
            return;
          }

          onSave(draft);
        }}
      >
        <label>
          L1 Weight
          <input
            type="number"
            step="0.01"
            value={draft.layerWeights.L1}
            disabled={!canEdit}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                layerWeights: {
                  ...current.layerWeights,
                  L1: toNumber(event.target.value, current.layerWeights.L1),
                },
              }))
            }
          />
        </label>

        <label>
          L2 Weight
          <input
            type="number"
            step="0.01"
            value={draft.layerWeights.L2}
            disabled={!canEdit}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                layerWeights: {
                  ...current.layerWeights,
                  L2: toNumber(event.target.value, current.layerWeights.L2),
                },
              }))
            }
          />
        </label>

        <label>
          L3 Weight
          <input
            type="number"
            step="0.01"
            value={draft.layerWeights.L3}
            disabled={!canEdit}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                layerWeights: {
                  ...current.layerWeights,
                  L3: toNumber(event.target.value, current.layerWeights.L3),
                },
              }))
            }
          />
        </label>

        <label>
          Close Score Threshold
          <input
            type="number"
            step="0.001"
            value={draft.closeScoreThreshold}
            disabled={!canEdit}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                closeScoreThreshold: toNumber(event.target.value, current.closeScoreThreshold),
              }))
            }
          />
        </label>

        <label>
          Confidence Baseline
          <input
            type="number"
            value={draft.confidenceBaseline}
            disabled={!canEdit}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                confidenceBaseline: toNumber(event.target.value, current.confidenceBaseline),
              }))
            }
          />
        </label>

        <label>
          Confidence Variance Impact
          <input
            type="number"
            step="0.01"
            value={draft.confidenceVarianceImpact}
            disabled={!canEdit}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                confidenceVarianceImpact: toNumber(event.target.value, current.confidenceVarianceImpact),
              }))
            }
          />
        </label>

        <label>
          Risk Adjustment Floor
          <input
            type="number"
            step="0.01"
            value={draft.riskAdjustmentFloor}
            disabled={!canEdit}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                riskAdjustmentFloor: toNumber(event.target.value, current.riskAdjustmentFloor),
              }))
            }
          />
        </label>

        <label>
          Risk Adjustment Scale
          <input
            type="number"
            step="0.01"
            value={draft.riskAdjustmentScale}
            disabled={!canEdit}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                riskAdjustmentScale: toNumber(event.target.value, current.riskAdjustmentScale),
              }))
            }
          />
        </label>

        <button type="submit" disabled={!canEdit}>Save config</button>
      </form>

      {!canEdit && <p className="muted">Only Primary Owner can edit scoring configuration.</p>}
    </section>
  );
}
