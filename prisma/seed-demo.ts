/**
 * Fills an empty database with a demo login and a year of believable data, so
 * the app can be run and clicked through locally without importing anything.
 *
 *   npm run db:seed:demo
 *
 * Refuses to run if the database already holds transactions, so it can't be
 * pointed at real data by accident. Override with DEMO_FORCE=1.
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { DEFAULT_CATEGORIES } from "../src/lib/utils";
import { PERSON_COLORS } from "../src/lib/colors";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const USERNAME = (process.env.DEMO_USERNAME ?? "demo").trim().toLowerCase();
const PASSWORD = process.env.DEMO_PASSWORD ?? "demo1234";

// Fixed seed so repeated runs produce the same numbers.
let randomState = 424242;
function random() {
  randomState = (randomState * 1103515245 + 12345) % 2147483648;
  return randomState / 2147483648;
}

function pick<T>(items: T[]): T {
  return items[Math.floor(random() * items.length)];
}

function between(low: number, high: number) {
  return Number((low + random() * (high - low)).toFixed(2));
}

function utcDate(year: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(year, monthIndex, day));
}

/** Recurring merchants per category, with a plausible amount range. */
const MERCHANTS: [string, string, number, number, number][] = [
  // category, merchant, low, high, times per month
  ["Rent", "Ridgeview Property Mgmt", 2350, 2350, 1],
  ["Groceries", "Costco", 120, 265, 2],
  ["Groceries", "Trader Joe's", 45, 130, 2],
  ["Restaurants", "Corner Bistro", 35, 95, 2],
  ["Restaurants", "Noodle House", 22, 48, 1],
  ["Gasoline", "Shell", 38, 72, 2],
  ["Utilities", "City Power", 95, 210, 1],
  ["Internet", "Fiberlink", 89, 89, 1],
  ["Cell Phone", "Mobile Co", 76, 76, 1],
  ["Gym", "Ridgeline Fitness", 65, 65, 1],
  ["Shopping", "Outfitters", 55, 240, 1],
  ["Entertainment", "Roxy Cinema", 28, 70, 1],
  ["Dog", "Northside Vet", 45, 220, 1],
  ["Car Insurance/Payment", "Insurance Co", 142, 142, 1],
  ["House Maintenance", "Hardware Depot", 30, 260, 1],
  ["Personal", "Barber Shop", 30, 55, 1],
];

// Occasional larger one-offs, so the charts have visible spikes.
const OCCASIONAL: [string, string, number, number][] = [
  ["Travel", "Skyline Air", 320, 780],
  ["Travel", "Harbor Hotel", 180, 460],
  ["Insurance/Med", "Family Clinic", 60, 340],
  ["Property Tax", "County Treasurer", 900, 1400],
  ["Home Insurance", "Homestead Mutual", 380, 520],
  ["Car Maintenance", "Auto Works", 90, 620],
];

async function main() {
  const existingTransactions = await db.transaction.count();
  if (existingTransactions > 0 && !process.env.DEMO_FORCE) {
    throw new Error(
      `This database already has ${existingTransactions} transactions. ` +
        "Refusing to add demo data on top of real data. " +
        "Point DATABASE_URL at an empty database, or set DEMO_FORCE=1 if you " +
        "are certain.",
    );
  }

  // --- login ---------------------------------------------------------------
  await db.user.upsert({
    where: { username: USERNAME },
    update: { name: "Demo Household", password: await bcrypt.hash(PASSWORD, 12) },
    create: {
      username: USERNAME,
      name: "Demo Household",
      password: await bcrypt.hash(PASSWORD, 12),
    },
  });

  // --- categories and settings --------------------------------------------
  for (const name of DEFAULT_CATEGORIES) {
    await db.category.upsert({ where: { name }, update: {}, create: { name } });
  }
  await db.appSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { withdrawalRate: 0.04 },
  });

  const categories = await db.category.findMany();
  const categoryByName = new Map(categories.map((c) => [c.name, c.id]));

  // Exercise the FI exclusion setting on one category.
  await db.category.updateMany({
    where: { name: "Property Tax" },
    data: { excludedFromFi: true },
  });

  // --- people --------------------------------------------------------------
  const alex = await db.person.upsert({
    where: { name: "Alex" },
    update: { color: PERSON_COLORS[0].value },
    create: { name: "Alex", sortOrder: 0, color: PERSON_COLORS[0].value },
  });
  const sam = await db.person.upsert({
    where: { name: "Sam" },
    update: { color: PERSON_COLORS[1].value },
    create: { name: "Sam", sortOrder: 1, color: PERSON_COLORS[1].value },
  });

  // --- accounts, covering every ownership shape ----------------------------
  const accountSpecs = [
    {
      name: "Checking - 1234",
      nickname: "Everyday Checking",
      splits: [{ personId: alex.id, percent: 100 }],
    },
    {
      name: "Credit Card - 5678",
      nickname: "Sam's Amex",
      splits: [{ personId: sam.id, percent: 100 }],
    },
    {
      name: "Shared Visa - 9012",
      nickname: "Joint Card",
      splits: [
        { personId: alex.id, percent: 50 },
        { personId: sam.id, percent: 50 },
      ],
    },
    {
      // Left without a nickname on purpose, so the fallback to the CSV name is
      // visible in the demo too.
      name: "Travel Card - 3456",
      splits: [
        { personId: alex.id, percent: 60 },
        { personId: sam.id, percent: 40 },
      ],
    },
  ];

  const accounts = [];
  for (const spec of accountSpecs) {
    const account = await db.account.upsert({
      where: { name: spec.name },
      update: { nickname: "nickname" in spec ? spec.nickname : null },
      create: {
        name: spec.name,
        nickname: "nickname" in spec ? spec.nickname : null,
        splits: { create: spec.splits },
      },
    });
    accounts.push(account);
  }

  const accountIds = accounts.map((account) => account.id);
  const sharedAccountId =
    accounts.find((account) => account.name === "Shared Visa - 9012")?.id ??
    accountIds[0];

  // --- twelve months of transactions --------------------------------------
  const now = new Date();
  let created = 0;

  for (let monthsBack = 11; monthsBack >= 0; monthsBack -= 1) {
    const month = utcDate(now.getUTCFullYear(), now.getUTCMonth() - monthsBack, 1);
    const year = month.getUTCFullYear();
    const monthIndex = month.getUTCMonth();

    const rows: {
      date: Date;
      amount: number;
      description: string;
      category: string;
      tags: string[];
    }[] = [];

    for (const [category, merchant, low, high, perMonth] of MERCHANTS) {
      for (let n = 0; n < perMonth; n += 1) {
        rows.push({
          date: utcDate(year, monthIndex, 1 + Math.floor(random() * 27)),
          amount: between(low, high),
          description: merchant,
          category,
          tags: [],
        });
      }
    }

    // Roughly one one-off per month.
    const [category, merchant, low, high] = pick(OCCASIONAL);
    rows.push({
      date: utcDate(year, monthIndex, 1 + Math.floor(random() * 27)),
      amount: between(low, high),
      description: merchant,
      category,
      tags: category === "Travel" ? ["Vacation"] : [],
    });

    // One guaranteed property tax bill, so the "excluded from FI" setting has
    // something to exclude and annual spending differs from total spending.
    if (monthsBack === 4) {
      rows.push({
        date: utcDate(year, monthIndex, 12),
        amount: 4180,
        description: "County Treasurer",
        category: "Property Tax",
        tags: [],
      });
    }

    for (const row of rows) {
      // Housing and utilities go on the shared card, the way a couple splitting
      // a household usually handles them; everything else is scattered.
      const accountId =
        row.category === "Rent" || row.category === "Utilities"
          ? sharedAccountId
          : pick(accountIds);

      const transaction = await db.transaction.create({
        data: {
          date: row.date,
          amount: row.amount,
          description: row.description,
          categoryId: categoryByName.get(row.category),
          accountId,
          isManual: false,
          // Imported rows carry no splits of their own; they inherit the
          // account's, which is what makes re-assigning an account retroactive.
        },
      });

      for (const tagName of row.tags) {
        const tag = await db.tag.upsert({
          where: { name: tagName },
          update: {},
          create: { name: tagName },
        });
        await db.transactionTag.create({
          data: { transactionId: transaction.id, tagId: tag.id },
        });
      }

      created += 1;
    }
  }

  // A couple of account-less cash entries with an uneven override, so the
  // "Manual" account and the override badge both appear.
  for (const monthsBack of [0, 2]) {
    const month = utcDate(now.getUTCFullYear(), now.getUTCMonth() - monthsBack, 14);
    await db.transaction.create({
      data: {
        date: month,
        amount: 185.5,
        description: "Farmers market (cash)",
        notes: "Split unevenly this month",
        categoryId: categoryByName.get("Groceries"),
        isManual: true,
        splits: {
          create: [
            { personId: alex.id, percent: 25 },
            { personId: sam.id, percent: 75 },
          ],
        },
      },
    });
    created += 1;
  }

  // --- other income --------------------------------------------------------
  // Deliberately NOT salary: salary lives in MonthlyIncome, and recording it in
  // both places would double-count it in cash flow.
  for (let monthsBack = 11; monthsBack >= 0; monthsBack -= 1) {
    const month = now.getUTCMonth() - monthsBack;

    // Dividends land quarterly.
    if (monthsBack % 3 === 0) {
      await db.income.create({
        data: {
          date: utcDate(now.getUTCFullYear(), month, 20),
          source: "Brokerage",
          description: "Quarterly dividends",
          amount: between(310, 640),
          personId: alex.id,
        },
      });
    }

    // An occasional side job.
    if (monthsBack % 4 === 1) {
      await db.income.create({
        data: {
          date: utcDate(now.getUTCFullYear(), month, 8),
          source: "Freelance",
          description: "Design work",
          amount: between(450, 1200),
          personId: sam.id,
        },
      });
    }
  }

  // --- companies and paychecks ---------------------------------------------
  // Sam works two jobs, so their month has two paychecks — the case a single
  // paycheck-per-person model couldn't represent.
  const companySpecs = [
    { person: alex, name: "Northwind Corp" },
    { person: sam, name: "Lakeside Studio" },
    { person: sam, name: "Bridge Coffee" },
  ];

  const companies: Record<string, string> = {};
  for (const spec of companySpecs) {
    const company = await db.company.upsert({
      where: { personId_name: { personId: spec.person.id, name: spec.name } },
      update: {},
      create: { name: spec.name, personId: spec.person.id },
    });
    companies[spec.name] = company.id;
  }

  // Deductions as realistic fractions of gross, so net income and the Sankey
  // both look like a real payslip.
  const jobs = [
    {
      person: alex,
      company: "Northwind Corp",
      annualSalary: 132_000,
      monthlyGross: 11_000,
      hsa: 150,
      medical: 310,
      bonusMonths: true,
    },
    {
      person: sam,
      company: "Lakeside Studio",
      annualSalary: 66_000,
      monthlyGross: 5_500,
      hsa: 250,
      medical: 205,
      bonusMonths: false,
    },
    {
      person: sam,
      company: "Bridge Coffee",
      annualSalary: 12_000,
      monthlyGross: 1_000,
      hsa: 0,
      medical: 0,
      bonusMonths: false,
    },
  ];

  for (let monthsBack = 11; monthsBack >= 0; monthsBack -= 1) {
    const month = utcDate(now.getUTCFullYear(), now.getUTCMonth() - monthsBack, 1);

    for (const job of jobs) {
      const bonus =
        job.bonusMonths && (monthsBack === 6 || monthsBack === 0) ? 2_150 : 0;
      const gross = job.monthlyGross + bonus;
      const companyId = companies[job.company];

      const existing = await db.monthlyIncome.findFirst({
        where: { month, personId: job.person.id, companyId },
      });
      if (existing) continue;

      await db.monthlyIncome.create({
        data: {
          month,
          personId: job.person.id,
          companyId,
          annualSalary: job.annualSalary,
          grossIncome: gross,
          taxes: Number((gross * 0.24).toFixed(2)),
          retirement401k: Number((job.monthlyGross * 0.08).toFixed(2)),
          hsa: job.hsa,
          medical: job.medical,
          dentalVision: job.medical > 0 ? 48 : 0,
        },
      });
    }
  }

  // --- net worth snapshots -------------------------------------------------
  // Investments compound gently; the mortgage pays down. This gives the Net
  // Worth and FI dashboards a real twelve-point history.
  let brokerage = 168_000;
  let retirement = 322_000;
  let roth = 121_000;
  let hsa = 24_500;
  let checking = 14_200;
  let savings = 38_000;
  let crypto = 9_400;
  let mortgage = 441_000;
  let carLoan = 22_800;
  let cardBalance = 2_400;

  for (let monthsBack = 11; monthsBack >= 0; monthsBack -= 1) {
    const month = utcDate(now.getUTCFullYear(), now.getUTCMonth() - monthsBack, 1);

    brokerage = Math.round(brokerage * (1 + between(0.002, 0.019)) + 900);
    retirement = Math.round(retirement * (1 + between(0.001, 0.017)) + 1500);
    roth = Math.round(roth * (1 + between(0.001, 0.018)) + 500);
    hsa = Math.round(hsa * (1 + between(0.001, 0.01)) + 150);
    checking = Math.round(checking + between(-1800, 2200));
    savings = Math.round(savings + between(-400, 1400));
    crypto = Math.round(crypto * (1 + between(-0.09, 0.14)));
    mortgage = Math.round(mortgage - between(780, 940));
    carLoan = Math.max(0, Math.round(carLoan - between(410, 470)));
    cardBalance = Math.round(between(900, 4200));

    // Retirement accounts belong to individuals; the house, joint savings, and
    // the mortgage are held together (personId null = Combined).
    await db.netWorthSnapshot.upsert({
      where: { month },
      update: {},
      create: {
        month,
        balances: {
          create: [
            { assetType: "BROKERAGE", amount: brokerage, personId: alex.id },
            {
              assetType: "FOUR_O_ONE_K",
              amount: Math.round(retirement * 0.6),
              personId: alex.id,
            },
            {
              assetType: "FOUR_O_ONE_K",
              amount: Math.round(retirement * 0.4),
              personId: sam.id,
            },
            { assetType: "ROTH_IRA", amount: Math.round(roth * 0.55), personId: alex.id },
            { assetType: "ROTH_IRA", amount: Math.round(roth * 0.45), personId: sam.id },
            { assetType: "HSA", amount: hsa, personId: sam.id },
            { assetType: "CHECKING", amount: checking },
            { assetType: "SAVINGS", amount: savings },
            { assetType: "CRYPTO", amount: crypto, personId: alex.id },
            { assetType: "HOME_VALUE", amount: 615_000 },
            { liabilityType: "MORTGAGE", amount: mortgage },
            { liabilityType: "CAR_LOAN", amount: carLoan, personId: sam.id },
            { liabilityType: "CREDIT_CARD", amount: cardBalance, personId: alex.id },
          ],
        },
      },
    });
  }

  // --- a CSV to try the import flow with -----------------------------------
  // Dated next month so every row counts as new rather than a duplicate.
  const importMonth = utcDate(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  const sampleRows = [
    "Date,Account,Description,Category,Tags,Amount",
    ...[
      ["Costco", "Groceries", "", 212.44],
      ["Corner Bistro", "Restaurants", "", 64.1],
      ["Skyline Air", "Travel", "Vacation", 512.0],
      ["Shell", "Gasoline", "", 51.87],
      ["Unlisted Card Co", "Misc", "", 25.0],
    ].map(([description, category, tags, amount], index) => {
      const day = String(3 + index * 4).padStart(2, "0");
      const date = `${importMonth.getUTCFullYear()}-${String(importMonth.getUTCMonth() + 1).padStart(2, "0")}-${day}`;
      // The last row deliberately names an account that does not exist, so the
      // preview's "unknown account" warning can be seen.
      const account = index === 4 ? "Mystery Card - 0000" : "Shared Visa - 9012";
      return `${date},${account},${description},${category},${tags},${amount}`;
    }),
  ].join("\n");

  writeFileSync("demo-import.csv", `${sampleRows}\n`, "utf8");

  const totals = await db.transaction.aggregate({ _sum: { amount: true } });

  console.log("Demo data ready.");
  console.log(`  login:        ${USERNAME} / ${PASSWORD}`);
  console.log(`  people:       Alex, Sam`);
  console.log(`  accounts:     ${accountSpecs.length}`);
  console.log(`  transactions: ${created} (${Number(totals._sum.amount ?? 0).toFixed(2)} total)`);
  console.log(`  companies:    ${companySpecs.length} (Sam works two jobs)`);
  console.log(`  income:       36 monthly paychecks + a few other-income entries`);
  console.log(`  net worth:    12 monthly snapshots`);
  console.log("  sample CSV:   demo-import.csv (try Import CSV on the Spending page)");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
