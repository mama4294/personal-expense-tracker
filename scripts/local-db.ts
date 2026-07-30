/**
 * Runs a throwaway PostgreSQL server for local development, so the app can be
 * worked on without installing Postgres or Docker.
 *
 *   npm run db:local          start it (stays in the foreground — leave it open)
 *   npm run db:local:reset    delete the data directory and start fresh
 *
 * The cluster is shut down when this process exits, which is why it runs in the
 * foreground rather than daemonising. Credentials and port match the default
 * DATABASE_URL in .env.example, so no extra configuration is needed.
 */
import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import EmbeddedPostgres from "embedded-postgres";

const DATA_DIR = resolve(process.cwd(), ".localdb");
const PORT = Number(process.env.LOCAL_DB_PORT ?? 5432);
const USER = "finance";
const PASSWORD = "finance";
const DATABASE = "finance";

const url = `postgresql://${USER}:${PASSWORD}@localhost:${PORT}/${DATABASE}`;

function createServer() {
  return new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: USER,
    password: PASSWORD,
    port: PORT,
    persistent: true,
  });
}

async function start() {
  const fresh = !existsSync(DATA_DIR);
  const server = createServer();

  if (fresh) {
    console.log(`Initialising a new cluster in ${DATA_DIR} …`);
    await server.initialise();
  }

  await server.start();

  if (fresh) {
    await server.createDatabase(DATABASE);
  }

  console.log("");
  console.log(`PostgreSQL is running on port ${PORT}.`);
  console.log(`  DATABASE_URL="${url}"`);
  console.log("");
  if (fresh) {
    console.log("Next, in a second terminal:");
    console.log("  npm run db:deploy && npm run db:seed:demo && npm run dev");
    console.log("");
  }
  console.log("Leave this running. Press Ctrl-C to stop.");

  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    console.log(`\nReceived ${signal}, stopping PostgreSQL …`);
    try {
      await server.stop();
    } catch (error) {
      console.error("Could not stop cleanly:", error);
    }
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  // Hold the process open; the cluster dies with it.
  await new Promise(() => {});
}

async function reset() {
  if (existsSync(DATA_DIR)) {
    console.log(`Removing ${DATA_DIR} …`);
    rmSync(DATA_DIR, { recursive: true, force: true });
  }
  console.log("Data directory cleared. Starting a fresh cluster.");
  await start();
}

const command = process.argv[2] ?? "start";

const run = command === "reset" ? reset : start;

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  if (/EADDRINUSE|already in use/i.test(message)) {
    console.error(
      `\nSomething is already listening on port ${PORT}. Stop it, or run with ` +
        "a different port:\n  LOCAL_DB_PORT=5433 npm run db:local\n" +
        "(remember to update DATABASE_URL in .env to match)",
    );
  }
  process.exit(1);
});
