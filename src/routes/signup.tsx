import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { authClient } from "#/lib/auth-client.ts";
import { getAuthState } from "#/lib/server/functions/auth-meta.ts";

export const Route = createFileRoute("/signup")({
	beforeLoad: async () => {
		const state = await getAuthState();
		if (state.user) throw redirect({ to: "/" });
		if (!state.registrationOpen) throw redirect({ to: "/login" });
	},
	component: SignupPage,
});

function SignupPage() {
	const navigate = useNavigate();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	async function onSubmit(event: React.FormEvent) {
		event.preventDefault();
		setBusy(true);
		setError(null);
		const result = await authClient.signUp.email({ name, email, password });
		setBusy(false);
		if (result.error) {
			setError(result.error.message ?? "Sign-up failed");
			return;
		}
		void navigate({ to: "/" });
	}

	return (
		<main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-6">
			<h1 className="text-2xl font-semibold tracking-tight logo">
				<img src="/bookm.svg" alt="Bookm logo" className="inline h-5 w-5" />
				Bookm
			</h1>
			<p className="mt-1 text-xs text-ink-secondary">Create your account.</p>
			<form onSubmit={onSubmit} className="mt-10 flex flex-col gap-4">
				<label className="flex flex-col gap-1">
					<span className="text-xs text-ink-secondary">Name</span>
					<input
						required
						value={name}
						onChange={(e) => setName(e.target.value)}
						className="border border-hairline bg-paper px-3 py-2 text-[15px] outline-none focus:border-accent"
					/>
				</label>
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
						minLength={8}
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
					{busy ? "Creating account…" : "Create account"}
				</button>
			</form>
		</main>
	);
}
