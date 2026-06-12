import { z } from "zod";

import { CONTENT_TYPES } from "#/db/schema.ts";
import { env } from "./env.ts";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const LLM_TIMEOUT_MS = 60_000;

export const llmOutputSchema = z.object({
	title: z.string(),
	summary: z.string(),
	description: z.string(),
	tags: z.array(z.string()).min(1).max(10),
	content_type: z.enum(CONTENT_TYPES),
	language: z.string(),
	reading_time_minutes: z.number().nullable(),
});

export type LlmOutput = z.infer<typeof llmOutputSchema>;

// Hand-written (rather than derived) so it exactly matches what
// OpenAI-style strict structured output requires: every property listed in
// `required`, additionalProperties false.
const responseJsonSchema = {
	type: "object",
	properties: {
		title: {
			type: "string",
			description: "Cleaned-up page title with site-name suffix stripped",
		},
		summary: { type: "string", description: "One sentence" },
		description: {
			type: "string",
			description: "2-4 sentences describing what is in the page",
		},
		tags: {
			type: "array",
			items: { type: "string" },
			description: "3-7 tags, prefer the user's existing tags",
		},
		content_type: { type: "string", enum: [...CONTENT_TYPES] },
		language: { type: "string", description: "ISO 639-1 code" },
		reading_time_minutes: { type: ["number", "null"] },
	},
	required: [
		"title",
		"summary",
		"description",
		"tags",
		"content_type",
		"language",
		"reading_time_minutes",
	],
	additionalProperties: false,
} as const;

export type LlmRequest = {
	url: string;
	title: string | null;
	content: string | null;
	extractionQuality: "full" | "low";
	contentTypeHint: string | null;
	existingTags: Array<string>;
	model: string;
};

function buildPrompt(req: LlmRequest): string {
	const parts = [
		`URL: ${req.url}`,
		req.title ? `Title: ${req.title}` : null,
		req.contentTypeHint ? `Content type hint: ${req.contentTypeHint}` : null,
		req.content
			? `Page content (extracted, may be truncated):\n${req.content}`
			: "Page content could not be fetched. Infer everything from the URL and title alone.",
	];
	return parts.filter(Boolean).join("\n\n");
}

function systemPrompt(existingTags: Array<string>): string {
	const tagList =
		existingTags.length > 0
			? `The user's existing tags, most used first: ${existingTags.join(", ")}.
Reuse these tags wherever they fit. Only invent a new tag when none of the existing ones apply.`
			: "The user has no tags yet; choose precise, reusable tags.";
	return `You are a librarian cataloguing a bookmark for later retrieval.
Given a web page, produce a cleaned-up title (strip the site-name suffix), a one-sentence summary, a 2-4 sentence description of what is in the page, 3-7 lowercase topic tags, the content type, the page language (ISO 639-1), and an estimated reading time in minutes (null for videos/tools where it does not apply).

${tagList}

Tags must be short topic words or phrases (e.g. "react", "self-hosting", "machine-learning"), never full sentences.`;
}

export async function generateBookmarkMetadata(
	req: LlmRequest,
): Promise<LlmOutput> {
	if (!env.openrouterApiKey) {
		throw new Error("OPENROUTER_API_KEY is not set; cannot run tagging");
	}
	const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
		method: "POST",
		headers: {
			authorization: `Bearer ${env.openrouterApiKey}`,
			"content-type": "application/json",
		},
		body: JSON.stringify({
			model: req.model,
			messages: [
				{ role: "system", content: systemPrompt(req.existingTags) },
				{ role: "user", content: buildPrompt(req) },
			],
			response_format: {
				type: "json_schema",
				json_schema: {
					name: "bookmark_metadata",
					strict: true,
					schema: responseJsonSchema,
				},
			},
		}),
		signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
	});

	if (!res.ok) {
		const body = await res.text().catch(() => "");
		throw new Error(`LLM call failed: ${res.status} ${body.slice(0, 500)}`);
	}

	const data = (await res.json()) as {
		choices?: Array<{ message?: { content?: string } }>;
	};
	const content = data.choices?.[0]?.message?.content;
	if (!content) {
		throw new Error("LLM response had no content");
	}
	return llmOutputSchema.parse(JSON.parse(content));
}
