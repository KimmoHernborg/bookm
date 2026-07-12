import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { ThemeModeSwitcher } from "#/components/theme-mode-switcher.tsx";
import {
	getShowcase,
	type ShowcaseBookmark,
} from "#/lib/server/functions/showcase.ts";

export const Route = createFileRoute("/s/$token")({
	loader: async ({ params }) => {
		const showcase = await getShowcase({ data: { token: params.token } });
		if (!showcase) throw notFound();
		return showcase;
	},
	head: ({ loaderData }) => ({
		meta: [
			// Link-only sharing: keep showcases (and the 404 render) unindexed.
			{ name: "robots", content: "noindex" },
			...(loaderData
				? [{ title: `${loaderData.ownerName}'s starred bookmarks — Bookm` }]
				: []),
		],
	}),
	notFoundComponent: ShowcaseNotFound,
	component: ShowcasePage,
});

function ShowcasePage() {
	const { ownerName, groups } = Route.useLoaderData();

	return (
		<div className="min-h-screen">
			<header className="border-b border-hairline">
				<div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
					<Link
						to="/"
						className="text-[15px] font-semibold tracking-tight logo"
					>
						<img src="/bookm.svg" alt="Bookm logo" className="inline h-5 w-5" />
						Bookm
					</Link>
					<ThemeModeSwitcher />
				</div>
			</header>
			<main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
				<h1 className="text-xl font-semibold tracking-tight">
					{ownerName}'s starred bookmarks
				</h1>
				{groups.length === 0 ? (
					<p className="mt-8 text-sm text-ink-secondary">
						Nothing starred yet.
					</p>
				) : (
					<div className="mt-8 flex flex-col gap-8">
						{groups.map((group) => (
							// Category names are unique per user; the prefix keeps a
							// category literally named "uncategorized" from colliding
							// with the null group.
							<section
								key={
									group.category != null
										? `c:${group.category}`
										: "uncategorized"
								}
							>
								<h2 className="text-[11px] font-semibold tracking-widest uppercase text-ink-secondary">
									{group.category ?? "Uncategorized"}
								</h2>
								<div className="mt-1 mb-2 border-t border-hairline" />
								<ul>
									{group.bookmarks.map((item) => (
										<ShowcaseRow key={item.id} item={item} />
									))}
								</ul>
							</section>
						))}
					</div>
				)}
			</main>
		</div>
	);
}

function ShowcaseRow({ item }: { item: ShowcaseBookmark }) {
	return (
		<li className="-mx-2 px-2 py-1 hover:bg-surface">
			<div className="flex items-baseline gap-2">
				<span className="relative min-w-0 flex-1 truncate">
					<a
						href={item.url}
						target="_blank"
						rel="noreferrer"
						aria-describedby={
							item.description ? `showcase-desc-${item.id}` : undefined
						}
						className="peer text-[15px] font-[450] text-ink hover:text-accent focus-visible:text-accent focus-visible:outline-none"
					>
						{item.title || item.url}
					</a>
					{item.description ? (
						<span
							id={`showcase-desc-${item.id}`}
							role="tooltip"
							className="pointer-events-none absolute top-full left-0 z-20 mt-1 hidden w-max max-w-[min(36rem,calc(100vw-3rem))] border border-hairline bg-paper px-3 py-2 text-[13px] leading-relaxed text-ink-secondary whitespace-normal shadow-sm peer-hover:block peer-focus-visible:block"
						>
							{item.description}
						</span>
					) : null}
				</span>
				<span className="hidden shrink-0 text-xs text-ink-secondary min-[480px]:inline">
					{item.domain}
				</span>
			</div>
		</li>
	);
}

function ShowcaseNotFound() {
	return (
		<main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-4 sm:px-6">
			<h1 className="text-2xl font-semibold tracking-tight logo">
				<img src="/bookm.svg" alt="Bookm logo" className="inline h-5 w-5" />
				Bookm
			</h1>
			<p className="mt-4 text-sm text-ink">This link doesn't exist.</p>
			<p className="mt-1 text-xs text-ink-secondary">
				The showcase may have been disabled, or the address was mistyped.
			</p>
		</main>
	);
}
