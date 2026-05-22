/**
 * POST /api/dgx — server-side proxy to the DGX Spark vLLM endpoint.
 *
 * The browser cannot call 192.168.68.118 directly (CORS + private network).
 * This route forwards the request from the SvelteKit Node server, which has
 * no such restriction.
 *
 * Request body: { headlines: string[] }
 * Response:     LlmAnalysis JSON  (or 503 on failure)
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { analyzeNewsWithLLM, DEFAULT_DGX_CONFIG } from '$lib/services/dgxService';

const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type'
};

export const OPTIONS: RequestHandler = async () =>
	new Response(null, { headers: CORS_HEADERS });

export const POST: RequestHandler = async ({ request }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	if (
		!body ||
		typeof body !== 'object' ||
		!Array.isArray((body as Record<string, unknown>).headlines)
	) {
		throw error(400, 'Body must be { headlines: string[] }');
	}

	const headlines = ((body as Record<string, unknown>).headlines as unknown[]).filter(
		(h): h is string => typeof h === 'string' && h.trim().length > 0
	);

	if (headlines.length === 0) {
		return json({ clusters: [], analyzedAt: Date.now(), model: DEFAULT_DGX_CONFIG.model }, { headers: CORS_HEADERS });
	}

	// Always enabled=true here — the client only calls this when the toggle is on
	const config = { ...DEFAULT_DGX_CONFIG, enabled: true };
	const result = await analyzeNewsWithLLM(headlines, config);

	if (!result) {
		throw error(503, 'DGX endpoint unavailable or returned no usable analysis');
	}

	return json(result, { headers: CORS_HEADERS });
};
