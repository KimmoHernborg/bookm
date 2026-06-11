import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import { env } from "#/lib/server/env.ts";
import * as schema from "./schema.ts";

function createDb() {
	const file = resolve(env.databaseUrl);
	mkdirSync(dirname(file), { recursive: true });
	const sqlite = new Database(file);
	sqlite.pragma("journal_mode = WAL");
	sqlite.pragma("foreign_keys = ON");
	sqlite.pragma("busy_timeout = 5000");
	const instance = drizzle(sqlite, { schema });
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
