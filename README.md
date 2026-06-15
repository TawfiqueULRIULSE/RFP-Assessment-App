# RFP Scoring App

Starter app for scoring RFPs with three layers:
- Layer 1 Technical (55%)
- Layer 2 Commercial (30%)
- Layer 3 Familiarity (15%)

## Features
- Create reusable RFPs
- Add vendors, assessors, and technical criteria
- Auto-create L1 scoring shells per assessor
- Weighted-average L1 consolidation
- Primary-owner scoring for L2 and L3
- Missing assessor callouts
- Confidence score
- Risk-adjusted score
- Historical benchmarking
- Discussion flag for close scores

## Run locally
```bash
npm install
npm run db:seed   # initialise demo data (safe to re-run)
npm run dev
```

## Database

The API uses **SQLite** for local development. The database file is created
automatically on first startup (or by running `npm run db:seed`).

| Environment variable | Default | Description |
|---|---|---|
| `DB_PATH` | `rfp_app.db` (repo root) | Path to the SQLite database file |
| `PORT` | `4000` | Port the API server listens on |

### Commands

```bash
# Create/update all tables (idempotent — safe to re-run)
npm run db:migrate

# Seed demo RFP data (skips if demo data already exists)
npm run db:seed
```

### Production (PostgreSQL)

For production deployments, replace the `better-sqlite3` driver with a
PostgreSQL client (e.g. [`pg`](https://node-postgres.com/)) and update
`server/db.js` to connect via the `DATABASE_URL` environment variable:

```
DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<dbname>
```

## Good next steps for GitHub Copilot
- Add auth and role-based access
- Add comments and panel validation workflow
- Add export to Excel / PDF
- Add attachments/evidence per score
