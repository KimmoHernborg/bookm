function intEnv(value: string | undefined, fallback: number): number {
	const parsed = Number.parseInt(value ?? "", 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const env = {
	databaseUrl: process.env.DATABASE_URL ?? "./data/bookm.db",
	dataDir: process.env.DATA_DIR ?? "./data",
	// Canonicalized to match Better Auth, which lowercases emails on sign-up
	// and lookup. Keeps the admin bootstrap lookup (init.ts) in sync with the
	// stored row regardless of how ADMIN_EMAIL is cased.
	adminEmail: process.env.ADMIN_EMAIL?.trim().toLowerCase(),
	registrationOpen: process.env.REGISTRATION_OPEN === "true",
	openrouterApiKey: process.env.OPENROUTER_API_KEY,
	openrouterDefaultModel:
		process.env.OPENROUTER_DEFAULT_MODEL ?? "openrouter/free",
	extractionMaxChars: intEnv(process.env.EXTRACTION_MAX_CHARS, 8000),
	jobConcurrency: intEnv(process.env.JOB_CONCURRENCY, 3),
};

// Per-model override for extraction length. The env var is the
// floor/default; entries here override per model.
export const EXTRACTION_MAX_CHARS_BY_MODEL: Record<string, number> = {
	// 'google/gemini-flash-1.5': 12000,
};

export function extractionMaxCharsFor(model: string): number {
	return EXTRACTION_MAX_CHARS_BY_MODEL[model] ?? env.extractionMaxChars;
}
