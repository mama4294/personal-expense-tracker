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
- Monthly paycheck detail per company, so one person can hold several jobs
- Cash Flow page with month-by-month savings and a Sankey of where the money went
- Monthly net worth snapshots, per-account and per-person, with editable history
- Spending, income, cash flow, net worth, and FI dashboards, each filterable by
  person or combined
- Financial independence progress against a configurable withdrawal rate
- Secure authentication with Auth.js

## Stack

- Next.js 16, React 19, TypeScript, Tailwind CSS 4
- PostgreSQL 16 + Prisma 7 (with the `pg` driver adapter)
- Recharts
- Auth.js (NextAuth v5)
- Docker Compose

## Local Development

No PostgreSQL or Docker installation is required — `embedded-postgres` is a dev
dependency that downloads a real PostgreSQL binary into `node_modules`.

1. Copy environment variables and set a real `AUTH_SECRET`:

```bash
cp .env.example .env
```

2. Install dependencies:

```bash
npm install
```

3. Start the local database. This runs in the **foreground** — leave the terminal
   open, as the cluster shuts down with the process:

```bash
npm run db:local
```

4. In a second terminal, apply migrations and seed demo data:

```bash
npm run db:deploy && npm run db:seed:demo
```

5. Run the development server:

```bash
npm run dev
```

Sign in as **`demo` / `demo1234`** (see [Testing locally with demo
data](#testing-locally-with-demo-data)).

The cluster lives in `.localdb/` (gitignored) on port 5432, with credentials
matching the default `DATABASE_URL` in `.env.example`, so nothing else needs
configuring. Data persists across restarts. To start over:

```bash
npm run db:local:reset
```

If port 5432 is already taken, use `LOCAL_DB_PORT=5433 npm run db:local` and
update `DATABASE_URL` in `.env` to match.

Prefer your own PostgreSQL, or Docker? Point `DATABASE_URL` at it and skip
`db:local` — `docker compose up db -d` also works.

## Testing locally with demo data

To click through the app without importing anything, seed a demo household:

```bash
npm run db:seed:demo
```

Sign in as **`demo` / `demo1234`**. That gives you two people (Alex and Sam),
four accounts covering every ownership shape (one each, one 50/50, one 60/40),
twelve months of transactions across ~18 categories, a year of income for both
people, and twelve monthly net worth snapshots — so every dashboard has
something to draw.

It also writes `demo-import.csv` in the project root, dated next month, for
trying the Import CSV flow. One row deliberately names an account that doesn't
exist so you can see the unknown-account warning in the preview.

To run the production build against it, with `npm run db:local` still going in
the other terminal:

```bash
npm run build && npm run start
```

Override the credentials with `DEMO_USERNAME` and `DEMO_PASSWORD` if you like.

The seed **refuses to run against a database that already has transactions**, so
it can't be pointed at real data by accident. If you genuinely want to add demo
data on top of what's there, set `DEMO_FORCE=1`.

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

## First run

Sign in with the seeded login — username `ADMIN_USERNAME`, password
`ADMIN_PASSWORD` (defaults `admin` / `changeme`), then:

1. **Settings → People** — add everyone expenses are split between. People carry
   split percentages and never sign in. Each one also picks a colour, used
   wherever a chart is showing that person.
2. **Settings → Accounts** — add each card or bank account, naming it exactly as
   it appears in your CSV exports, and set its default split.
3. **Settings → People → Companies** — add where each person works. Paychecks
   are recorded against a company; leaving a job means marking it *past*, which
   keeps the pay history and hides it from new paychecks.
4. **Settings → Logins** — add more logins if others need access. Every login
   sees all of the household's data.
5. **Settings → Profile** — change the seeded password. Re-seeding never
   overwrites a password changed in the app.

Every Settings tab follows the same shape: an **Add** button that opens a modal,
and a **⋯** menu on each row for edit, deactivate, merge, and delete. Nothing is
edited inline, so a mistyped rename can be cancelled and destructive actions
take a deliberate second click.

## Monthly Workflow

1. Download credit card CSV exports
2. On the Spending page, click **Import CSV** and pick the files (several at once
   is fine)
3. Review the preview — new versus duplicate rows, unknown accounts
4. Confirm the import
5. Enter the month's paycheck with **Add Paycheck** on the Income page
6. Enter the month's balances with **Add Balances** on the Net Worth page
7. Review the dashboards and FI progress

## Income and Cash Flow

Income is recorded two ways, and they must not overlap:

- **Paychecks** (Income → Add Paycheck) — one per person *per company* per
  month: annual salary, monthly gross, and the deductions (taxes, 401k, HSA,
  medical, dental and vision). Net income is derived, never stored: gross less
  every deduction. Someone working two jobs records two paychecks a month and
  cash flow adds them together.
- **Other income** — one-off money that isn't part of a paycheck: dividends,
  side work, gifts. Don't record salary here as well, or it will be counted
  twice.

The **Cash Flow** page rolls those up month by month against spending:

| Column | Meaning |
|---|---|
| Gross / Other | What was earned, before deductions |
| Net Income | Paycheck net + other income — what reached the bank |
| Expenses | Transactions for the month, as that person's share when filtered |
| Savings | Net income + 401k + HSA − expenses |

401k and HSA are added back because they're money saved before it was ever
spendable — it never appears in net income, so leaving it out would understate
what the household put away.

Pick any month to see a Sankey of it: income splits into taxes, retirement,
insurance and take-home; take-home splits into spending categories and whatever
went unspent.

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
  Each person owns a colour, chosen from a fixed eight-hue palette
  (`src/lib/colors.ts`) picked for separation on the card background and under
  colourblind simulation. Selecting a person on Spending, Net Worth, Cash Flow,
  or FI recolours that page's charts to match, and the by-person charts colour
  every bar by its owner. Semantic series — liabilities, taxes, expenses — keep
  their own colours regardless of who is selected.
- **Splits** are percentages that must total 100. An account carries a default
  split; a transaction can override it. Imported rows store no split of their
  own, so changing an account's split re-attributes its whole history.
- **Logins** are usernames and passwords. One login can cover a whole household,
  and every login sees all data — there is no per-login privacy boundary.

Net worth balances carry a person too: each account is attributed to one person
or left **Combined** for jointly held ones, so a couple can record separate 401k
and Roth balances alongside a shared mortgage and house.

Expenses with no account (cash, Venmo, a check) have no default to inherit, so
they need an explicit split; the form pre-fills an even one.

## Filtering by person

Spending, Cash Flow, Net Worth, and FI all carry a Combined / per-person toggle,
but "a person" means something slightly different depending on the data:

- **Spending and cash flow** use the split percentages, so a person sees their
  *share* of every shared transaction.
- **Net worth and FI** use account ownership, so a person sees the accounts they
  hold. Jointly held accounts belong to nobody in particular and are reported
  separately rather than divided by a rule the app would have to invent — both
  pages say how much is joint when you filter.

Either way, the parts reconcile: each person's figure plus anything joint adds
back up to Combined.

## FI Calculations

- **Annual spending** — trailing 12 months, excluding categories flagged
  *Excluded from FI* in Settings.
- **FI number** — annual spending ÷ withdrawal rate (default 4%).
- **Current investments** — Brokerage, 401k, Roth IRA, and HSA balances from the
  most recent net worth snapshot.
- **Historical progress** — each snapshot month is measured against the spending
  trailing *that* month, not against today's spending.
