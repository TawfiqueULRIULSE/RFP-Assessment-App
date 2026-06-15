# RFP Scoring App

A multi-layer RFP scoring application with role-based access control.

- Layer 1 Technical (55%)
- Layer 2 Commercial (30%)
- Layer 3 Familiarity (15%)

## Features

- **Authentication & roles** — Primary Owner, Assessor, and Panel Reviewer login
- **RFP management** — Create and select reusable RFPs
- **Vendor & assessor management** — Add vendors, assessors, and technical criteria
- **L1 assessment** — Auto-create L1 scoring shells per assessor; weighted-average consolidation
- **L2 / L3 scoring** — Primary-owner scoring for commercial and familiarity layers
- **Panel validation workflow** — Panel reviewers approve or flag vendor scores
- **Evidence & comments** — Attach evidence links and discussion comments per score
- **Scoring config** — Configurable layer weights, confidence baseline, and risk adjustment
- **Confidence & risk-adjusted score** — Composite scoring with variance-based confidence
- **Historical benchmarking** — Snapshot and compare scores across RFPs
- **Close-score discussion flag** — Automatic flag when vendors are within threshold
- **Export** — Excel workbook and CSV ranking export

## Run locally

```bash
npm install
npm run dev
```

The frontend runs on <http://localhost:5173> and the API on <http://localhost:4000>.

## Available scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start frontend (Vite) + API (Express) concurrently |
| `npm run build` | Type-check and build production bundle |
| `npm run typecheck` | Run TypeScript type-checking without emitting files |
| `npm run lint` | Lint source files with ESLint |
| `npm run preview` | Preview the production build locally |

## Roadmap

- Replace in-memory API with a persistent database
- Real RFP document ingestion (PDF / DOCX parsing)
- Automated test suite (unit + integration)
- PDF export for executive summary
