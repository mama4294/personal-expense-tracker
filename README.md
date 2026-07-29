# Personal Finance Dashboard

Self-hosted household finance tracking: shared-expense splitting, CSV import,
net worth history, and financial-independence progress.

## Features

- One Spending page combining charts, the transaction list, import, and entry
- CSV import (multi-file upload or paste) with duplicate detection
- Click-to-drill-down from any category or account into the underlying expenses
- Any number of people, with configurable split percentages per account
- Username logins, managed in Settings, separate from the people being split
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

5. Sign in with the seeded login — username `ADMIN_USERNAME`, password
`ADMIN_PASSWORD` (defaults `admin` / `changeme`).

Then set the app up for your household:

1. **Settings → People** — add everyone expenses are split between. People carry
   split percentages and never sign in.
2. **Settings → Accounts** — add each card or bank account, naming it exactly as
   it appears in your CSV exports, and set its default split.
3. **Settings → Logins** — add more logins if others need access. Every login
   sees all of the household's data.
4. **Settings → Profile** — change the seeded password. Re-seeding never
   overwrites a password changed in the app.

## Production (Docker Compose)

Images are built by GitHub Actions on every push to `main` and published to
GHCR as `ghcr.io/mama4294/personal-expense-tracker/app` and `.../migrate`, so
the server only pulls — it never builds. Set `AUTH_SECRET`, `AUTH_URL`,
`POSTGRES_PASSWORD`, and the initial `ADMIN_USERNAME` / `ADMIN_PASSWORD` in
`.env`, then:

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
- `migrate` — one-shot container that runs `prisma migrate deploy` and seeds the
  first login plus the default categories, then exits. People and accounts are
  not seeded; you create those in Settings.
- `app` — the Next.js standalone server on port 3000, started only after
  `migrate` completes successfully.

`AUTH_SECRET` has no default, so compose fails fast rather than deploying with a
known secret. Put the app behind your reverse proxy for HTTPS —
`AUTH_TRUST_HOST` is already enabled for that.

Schema changes apply on rebuild: `docker compose up -d --build` reruns the
`migrate` service against the existing volume.

## Monthly Workflow

1. Download credit card CSV exports
2. On the Spending page, click **Import CSV** and pick the files (several at once
   is fine)
3. Review the preview — new versus duplicate rows, unknown accounts
4. Confirm the import
5. Enter the month's income on the Income page
6. Enter the month's balances on the Net Worth page
7. Review the dashboards and FI progress

## The Spending page

Importing, reviewing, and drilling into expenses all happen in one place:

- **Person** — a Combined / per-person toggle across the top.
- **Date range** — presets (this month, last month, last 3 months, year to date,
  last 12 months, last year, all time) that fill the from/to inputs, which stay
  editable for a custom range.
- **Drill-down** — click a category slice, a category row, or an account bar to
  filter the transaction list beneath. The charts deliberately keep their full
  scope while you drill, so the chart you clicked doesn't collapse to one slice.
  Active filters show as chips; click one to clear it.
- **Add Expense** and **Import CSV** are buttons on this page rather than
  separate screens.

With a single person selected, the charts and the transaction list total both
show that person's share, not the full household amount.

## CSV Format

| Date | Account | Description | Category | Tags | Amount |
|------|---------|-------------|----------|------|--------|
| 2026-07-01 | Credit Card - 9939 | Costco | Groceries | | 148.22 |

- `Account` is matched by exact name against the accounts in Settings. Unmatched
  names are flagged in the preview and import with no account attached, which
  means they fall back to an even split across active people.
- `Category` is matched case-insensitively; unknown categories are created.
- `Tags` is a comma-separated list.
- `Amount` is read as a magnitude, so both positive and negative export
  conventions record the same expense. Refunds and credits therefore import as
  spending — adjust those rows after import.
- Duplicate detection compares date, account, description, and amount, both
  against existing transactions and within the uploaded batch.

## People, splits, and logins

Three separate ideas, deliberately:

- **People** are who expenses are split between. They have no password. Adding,
  renaming, or deactivating them is a Settings change, not a schema change.
- **Splits** are percentages that must total 100. An account carries a default
  split; a transaction can override it. Imported rows store no split of their
  own, so changing an account's split re-attributes its whole history.
- **Logins** are usernames and passwords. One login can cover a whole household,
  and every login sees all data — there is no per-login privacy boundary.

Expenses with no account (cash, Venmo, a check) have no default to inherit, so
they need an explicit split; the form pre-fills an even one.

## FI Calculations

- **Annual spending** — trailing 12 months, excluding categories flagged
  *Excluded from FI* in Settings.
- **FI number** — annual spending ÷ withdrawal rate (default 4%).
- **Current investments** — Brokerage, 401k, Roth IRA, and HSA balances from the
  most recent net worth snapshot.
- **Historical progress** — each snapshot month is measured against the spending
  trailing *that* month, not against today's spending.
