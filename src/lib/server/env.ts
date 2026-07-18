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

// Optional generic OIDC provider (e.g. PocketID, Authelia, Authentik) for
// self-hosters who want SSO. Inert unless all three required vars are set —
// no auth.ts branching happens otherwise.
const oidcIssuer = process.env.OIDC_ISSUER_URL?.trim().replace(/\/$/, "");
const oidcClientId = process.env.OIDC_CLIENT_ID?.trim();
const oidcClientSecret = process.env.OIDC_CLIENT_SECRET?.trim();

export const oidcEnabled = Boolean(
	oidcIssuer && oidcClientId && oidcClientSecret,
);

export const oidc = oidcEnabled
	? {
			issuer: oidcIssuer as string,
			// PocketID / Authelia / Authentik all expose OIDC discovery here.
			discoveryUrl: `${oidcIssuer}/.well-known/openid-configuration`,
			clientId: oidcClientId as string,
			clientSecret: oidcClientSecret as string,
			providerId: process.env.OIDC_PROVIDER_ID?.trim() || "oidc",
			providerName: process.env.OIDC_PROVIDER_NAME?.trim() || "Single Sign-On",
			scopes: (process.env.OIDC_SCOPES?.trim() || "openid profile email").split(
				/\s+/,
			),
		}
	: null;

// Per-model override for extraction length. The env var is the
// floor/default; entries here override per model.
export const EXTRACTION_MAX_CHARS_BY_MODEL: Record<string, number> = {
	// 'google/gemini-flash-1.5': 12000,
};

export function extractionMaxCharsFor(model: string): number {
	return EXTRACTION_MAX_CHARS_BY_MODEL[model] ?? env.extractionMaxChars;
}
