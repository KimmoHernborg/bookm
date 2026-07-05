import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Settings, Shield } from "lucide-react";

import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "#/components/ui/avatar.tsx";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu.tsx";
import { authClient } from "#/lib/auth-client.ts";
import type { SessionUser } from "#/lib/server/session.ts";
import { gravatarUrl, initialsFor } from "#/lib/shared/avatar.ts";

export function UserMenu({ user }: { user: SessionUser }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					aria-label="Account menu"
					className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent"
				>
					<Avatar>
						<AvatarImage
							src={gravatarUrl(user.avatarHash, 64)}
							alt=""
							referrerPolicy="no-referrer"
						/>
						<AvatarFallback>
							{initialsFor(user.name, user.email)}
						</AvatarFallback>
					</Avatar>
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuLabel>
					<div className="text-[13px] font-medium text-ink">{user.name}</div>
					<div className="truncate text-xs text-ink-muted">{user.email}</div>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem asChild>
					<Link to="/settings">
						<Settings />
						Settings
					</Link>
				</DropdownMenuItem>
				{user.isAdmin ? (
					<DropdownMenuItem asChild>
						<Link to="/admin">
							<Shield />
							Admin
						</Link>
					</DropdownMenuItem>
				) : null}
				<DropdownMenuSeparator />
				<DropdownMenuItem
					onSelect={async () => {
						await authClient.signOut();
						queryClient.clear();
						await navigate({ to: "/login" });
					}}
				>
					<LogOut />
					Sign out
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
