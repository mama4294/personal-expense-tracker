import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { DEFAULT_CATEGORIES } from "../src/lib/utils";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const username = (process.env.ADMIN_USERNAME ?? "admin").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "changeme";
  const displayName = process.env.ADMIN_NAME ?? "Household";

  // Only the initial create sets a password — re-seeding must not clobber a
  // password that has since been changed in the app.
  await db.user.upsert({
    where: { username },
    update: { name: displayName },
    create: {
      username,
      name: displayName,
      password: await bcrypt.hash(password, 12),
    },
  });

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

  // People and accounts are deliberately not seeded: they are specific to the
  // household and are created from Settings after the first sign-in.
  console.log(`Seed complete. Sign in as "${username}".`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
