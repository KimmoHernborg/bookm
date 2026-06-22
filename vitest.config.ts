import { defineConfig } from "vitest/config";

// Standalone config so tests don't load the app's Vite plugins
// (nitro, TanStack Start, devtools), which aren't needed for unit tests
// and prevent the vitest process from exiting cleanly.
export default defineConfig({
	resolve: { tsconfigPaths: true },
	test: {
		environment: "node",
	},
});
