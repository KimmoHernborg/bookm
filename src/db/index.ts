import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

import { env } from "#/lib/server/env.ts";
import * as schema from "./schema.ts";

function createDb() {
	const file = resolve(env.databaseUrl);
	mkdirSync(dirname(file), { recursive: true });
	const sqlite = new Database(file);
	sqlite.run("PRAGMA journal_mode = WAL");
	sqlite.run("PRAGMA foreign_keys = ON");
	sqlite.run("PRAGMA busy_timeout = 5000");
	const instance = drizzle({ client: sqlite, schema });
	migrate(instance, { migrationsFolder: resolve("./drizzle") });
	return instance;
}

// Single connection across dev-server module reloads.
const globalForDb = globalThis as unknown as {
	__bookmDb?: ReturnType<typeof createDb>;
};

if (!globalForDb.__bookmDb) {
	globalForDb.__bookmDb = createDb();
}
export const db = globalForDb.__bookmDb;
