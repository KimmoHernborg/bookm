import {
	createFileRoute,
	Link,
	redirect,
	useNavigate,
} from "@tanstack/react-router";
import { useState } from "react";

import { authClient } from "#/lib/auth-client.ts";
import { getAuthState } from "#/lib/server/functions/auth-meta.ts";

export const Route = createFileRoute("/login")({
	beforeLoad: async () => {
		const state = await getAuthState();
		if (state.user) throw redirect({ to: "/" });
		return { registrationOpen: state.registrationOpen };
	},
	loader: ({ context }) => ({ registrationOpen: context.registrationOpen }),
	component: LoginPage,
});

function LoginPage() {
	const { registrationOpen } = Route.useLoaderData();
	const navigate = useNavigate();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	async function onSubmit(event: React.FormEvent) {
		event.preventDefault();
		setBusy(true);
		setError(null);
		const result = await authClient.signIn.email({ email, password });
		setBusy(false);
		if (result.error) {
			setError(result.error.message ?? "Sign-in failed");
			return;
		}
		void navigate({ to: "/" });
	}

	return (
		<main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-6">
			<h1 className="text-2xl font-semibold tracking-tight">Bookm</h1>
			<p className="mt-1 text-xs text-ink-secondary">
				AI-tagged bookmarking for tab hoarders.
			</p>
			<form onSubmit={onSubmit} className="mt-10 flex flex-col gap-4">
				<label className="flex flex-col gap-1">
					<span className="text-xs text-ink-secondary">Email</span>
					<input
						type="email"
						required
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						className="border border-hairline bg-paper px-3 py-2 text-[15px] outline-none focus:border-accent"
					/>
				</label>
				<label className="flex flex-col gap-1">
					<span className="text-xs text-ink-secondary">Password</span>
					<input
						type="password"
						required
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						className="border border-hairline bg-paper px-3 py-2 text-[15px] outline-none focus:border-accent"
					/>
				</label>
				{error ? <p className="text-xs text-ink-muted">{error}</p> : null}
				<button
					type="submit"
					disabled={busy}
					className="mt-2 bg-accent px-3 py-2 text-[15px] font-medium text-paper hover:bg-accent-hover disabled:opacity-60"
				>
					{busy ? "Signing in…" : "Sign in"}
				</button>
			</form>
			{registrationOpen ? (
				<p className="mt-6 text-xs text-ink-secondary">
					No account?{" "}
					<Link to="/signup" className="text-accent underline">
						Sign up
					</Link>
				</p>
			) : null}
		</main>
	);
}
