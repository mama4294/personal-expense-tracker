# Personal Finance Dashboard

Self-hosted personal finance tracking for Matthew and Genevieve.

## Features

- CSV import (multi-file upload or paste) with duplicate detection
- Account ownership and configurable shared-expense splits
- Manual expenses, editable transactions, tags, and notes
- Search and filter by date, card, person, category, tag, and amount range
- Manual income entry with monthly and annual trends
- Monthly net worth snapshots with editable history
- Spending, income, net worth, and FI dashboards
- Financial independence progress against a configurable withdrawal rate
- Secure authentication with Auth.js

## Stack

- Next.js 16, React 19, TypeScript, Tailwind CSS 4
- PostgreSQL 16 + Prisma 7 (with the `pg` driver adapter)
- Recharts
- Auth.js (NextAuth v5)
- Docker Compose

## Local Development

1. Copy environment variables and set a real `AUTH_SECRET`:

```bash
cp .env.example .env
```

2. Start PostgreSQL (any local Postgres works; this uses the compose service):

```bash
docker compose up db -d
```

3. Install dependencies, apply migrations, and seed:

```bash
npm install
npm run db:deploy
npm run db:seed
```

4. Run the development server:

```bash
npm run dev
```

5. Sign in with the seeded users:

- `matthew@finance.local`
- `genevieve@finance.local`

Their initial passwords come from `MATTHEW_PASSWORD` and `GENEVIEVE_PASSWORD`.
Change them under Settings → Profile; re-seeding does not overwrite a changed
password.

## Production (Docker Compose)

Images are built by GitHub Actions on every push to `main` and published to
GHCR as `ghcr.io/mama4294/personal-expense-tracker/app` and `.../migrate`, so
the server only pulls — it never builds. Set `AUTH_SECRET`, `AUTH_URL`,
`POSTGRES_PASSWORD`, and the two initial user passwords in `.env`, then:

```bash
docker compose up -d
```

To build from source instead — before the first CI run, or if GHCR is
unreachable — add the build overlay:

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

`IMAGE_TAG` defaults to `latest`; set it to a commit SHA in `.env` to pin or
roll back.

The stack runs three services:

- `db` — PostgreSQL with a named volume for persistence. No host port is
  published; add a `ports` entry if you want to reach it from your LAN.
- `migrate` — one-shot container that runs `prisma migrate deploy` and seeds
  users, default categories, and default accounts, then exits.
- `app` — the Next.js standalone server on port 3000, started only after
  `migrate` completes successfully.

`AUTH_SECRET` has no default, so compose fails fast rather than deploying with a
known secret. Put the app behind your reverse proxy for HTTPS —
`AUTH_TRUST_HOST` is already enabled for that.

Schema changes apply on rebuild: `docker compose up -d --build` reruns the
`migrate` service against the existing volume.

## Monthly Workflow

1. Download credit card CSV exports
2. Upload them on the Import page (several files at once is fine)
3. Review the preview — new versus duplicate rows, unknown accounts
4. Confirm the import
5. Enter the month's income on the Income page
6. Enter the month's balances on the Net Worth page
7. Review the dashboards and FI progress

## CSV Format

| Date | Account | Description | Category | Tags | Amount |
|------|---------|-------------|----------|------|--------|
| 2026-07-01 | Credit Card - 9939 | Costco | Groceries | | 148.22 |

- `Account` is matched by exact name against the accounts in Settings. Unmatched
  names are flagged in the preview and import as shared with no card attached.
- `Category` is matched case-insensitively; unknown categories are created.
- `Tags` is a comma-separated list.
- `Amount` is read as a magnitude, so both positive and negative export
  conventions record the same expense. Refunds and credits therefore import as
  spending — adjust those rows after import.
- Duplicate detection compares date, account, description, and amount, both
  against existing transactions and within the uploaded batch.

## FI Calculations

- **Annual spending** — trailing 12 months, excluding categories flagged
  *Excluded from FI* in Settings.
- **FI number** — annual spending ÷ withdrawal rate (default 4%).
- **Current investments** — Brokerage, 401k, Roth IRA, and HSA balances from the
  most recent net worth snapshot.
- **Historical progress** — each snapshot month is measured against the spending
  trailing *that* month, not against today's spending.
