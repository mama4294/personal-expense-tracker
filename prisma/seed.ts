import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { DEFAULT_CATEGORIES } from "../src/lib/utils";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const matthewPassword = process.env.MATTHEW_PASSWORD ?? "changeme";
  const genevievePassword = process.env.GENEVIEVE_PASSWORD ?? "changeme";

  const users = [
    {
      name: "Matthew",
      email: "matthew@finance.local",
      password: await bcrypt.hash(matthewPassword, 12),
    },
    {
      name: "Genevieve",
      email: "genevieve@finance.local",
      password: await bcrypt.hash(genevievePassword, 12),
    },
  ];

  for (const user of users) {
    // Only the initial create sets a password — re-seeding must not clobber a
    // password the user has since changed in the app.
    await db.user.upsert({
      where: { email: user.email },
      update: { name: user.name },
      create: user,
    });
  }

  for (const name of DEFAULT_CATEGORIES) {
    await db.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  await db.appSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { withdrawalRate: 0.04 },
  });

  const defaultAccounts = [
    { name: "Checking - 8803", owner: "MATTHEW" as const },
    { name: "Credit Card - 9939", owner: "MATTHEW" as const },
    { name: "Credit Card - Ending in 2836", owner: "MATTHEW" as const },
    {
      name: "Venture X - Ending in 4344",
      owner: "SHARED" as const,
      matthewSplitPercent: 50,
      genevieveSplitPercent: 50,
    },
    {
      name: "American Express Gold - Ending in 1006",
      owner: "SHARED" as const,
      matthewSplitPercent: 50,
      genevieveSplitPercent: 50,
    },
  ];

  for (const account of defaultAccounts) {
    // Leave existing accounts alone; ownership and splits are managed in the app.
    await db.account.upsert({
      where: { name: account.name },
      update: {},
      create: {
        name: account.name,
        owner: account.owner,
        matthewSplitPercent: account.matthewSplitPercent ?? 100,
        genevieveSplitPercent: account.genevieveSplitPercent ?? 0,
      },
    });
  }

  console.log("Seed complete");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
