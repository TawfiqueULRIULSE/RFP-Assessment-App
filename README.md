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
npm run dev
```

## Good next steps for GitHub Copilot
- Add auth and role-based access
- Add comments and panel validation workflow
- Replace localStorage with API + database
- Add export to Excel / PDF
- Add attachments/evidence per score
