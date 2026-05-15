/**
 * POST /api/digest — generate an opinionated daily situation brief using DGX Spark.
 *
 * Accepts: { headlines, correlations, markets }
 * Returns: DigestData JSON (or 503 on LLM failure)
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { DEFAULT_DGX_CONFIG } from '$lib/services/dgxService';
import type {
	DigestData,
	DigestTopSignal,
	DigestSection,
	DigestMarketContext
} from '$lib/stores/digest';

interface DigestRequest {
	headlines: string[];
	correlations: Array<{ name: string; level: string; sourceCount?: number; count?: number }>;
	markets: Array<{ symbol: string; name: string; changePercent: number }>;
}

const SYSTEM_PROMPT = `You are a geopolitical and market intelligence analyst producing a tight morning briefing.

Be direct and opinionated. Lead with the most important signal. Distinguish actionable developments from noise. Make calls — don't just list facts. A briefing that only summarizes is useless.

Return ONLY a valid JSON object with this exact structure:
{
  "topSignal": {
    "headline": "The single most important thing right now — max 15 words",
    "significance": "HIGH",
    "detail": "2-3 sentences: why it matters, what to watch, what changes if it escalates"
  },
  "overnight": [
    { "category": "Geopolitics", "summary": "One opinionated line on the most important development" },
    { "category": "Markets", "summary": "One line — direction and why" },
    { "category": "Technology", "summary": "One line if warranted" }
  ],
  "marketContext": {
    "direction": "RISK-OFF",
    "notes": ["Most notable market move in one line", "Second observation if meaningful"]
  },
  "watchToday": [
    "Specific event or threshold to monitor today",
    "Another specific watch item"
  ],
  "noiseFilter": [
    "Topic dominating coverage but not changing anything material",
    "Another noise item"
  ]
}

Rules:
- topSignal.significance: "HIGH" (systemic/major), "MEDIUM" (significant but contained), "LOW" (worth noting)
- marketContext.direction: "RISK-ON", "RISK-OFF", "MIXED", or "FLAT"
- overnight: 2-4 entries, only include a category if there is something genuinely worth saying
- watchToday: 1-3 items, specific and actionable
- noiseFilter: 1-3 items, explicitly call out what is loud but inconsequential
- Do NOT include any text outside the JSON object`;

function buildUserPrompt(req: DigestRequest): string {
	const parts: string[] = [];

	parts.push(`Generate a situation briefing from the following data.\n`);

	if (req.headlines.length > 0) {
		parts.push(`HEADLINES (${req.headlines.length} items):`);
		req.headlines.forEach((h, i) => parts.push(`${i}: ${h}`));
		parts.push('');
	}

	if (req.correlations.length > 0) {
		parts.push('KEY CORRELATIONS DETECTED:');
		req.correlations.forEach((c) => {
			const strength = c.sourceCount ?? c.count ?? 0;
			parts.push(`- ${c.name} — ${c.level} signal, ${strength} sources/mentions`);
		});
		parts.push('');
	}

	if (req.markets.length > 0) {
		parts.push('MARKET SNAPSHOT:');
		req.markets.forEach((m) => {
			const sign = m.changePercent >= 0 ? '+' : '';
			parts.push(`- ${m.name}: ${sign}${m.changePercent.toFixed(2)}%`);
		});
		parts.push('');
	}

	parts.push('Be opinionated. What actually matters right now?');
	return parts.join('\n');
}

function parseJsonResponse(raw: string): Record<string, unknown> | null {
	try {
		return JSON.parse(raw) as Record<string, unknown>;
	} catch {
		const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
		if (match?.[1]) {
			try {
				return JSON.parse(match[1]) as Record<string, unknown>;
			} catch {
				// fall through
			}
		}
		return null;
	}
}

const VALID_SIGNIFICANCE = new Set(['HIGH', 'MEDIUM', 'LOW']);
const VALID_DIRECTION = new Set(['RISK-ON', 'RISK-OFF', 'MIXED', 'FLAT']);

function validateDigest(raw: Record<string, unknown>, model: string): DigestData {
	const ts = raw.topSignal as Record<string, unknown> | undefined;
	const topSignal: DigestTopSignal = {
		headline:
			typeof ts?.headline === 'string' && ts.headline.trim()
				? ts.headline.trim()
				: 'No dominant signal detected',
		significance: VALID_SIGNIFICANCE.has(String(ts?.significance))
			? (ts!.significance as DigestTopSignal['significance'])
			: 'MEDIUM',
		detail:
			typeof ts?.detail === 'string' && ts.detail.trim()
				? ts.detail.trim()
				: 'Insufficient data to synthesize a signal.'
	};

	const overnight: DigestSection[] = Array.isArray(raw.overnight)
		? (raw.overnight as unknown[])
				.filter(
					(s): s is Record<string, unknown> =>
						typeof s === 'object' && s !== null && typeof (s as Record<string, unknown>).category === 'string'
				)
				.map((s) => ({
					category: String(s.category),
					summary: typeof s.summary === 'string' ? s.summary : ''
				}))
				.filter((s) => s.summary.length > 0)
		: [];

	const mc = raw.marketContext as Record<string, unknown> | undefined;
	const marketContext: DigestMarketContext = {
		direction: VALID_DIRECTION.has(String(mc?.direction))
			? (mc!.direction as DigestMarketContext['direction'])
			: 'FLAT',
		notes: Array.isArray(mc?.notes)
			? (mc!.notes as unknown[]).filter((n): n is string => typeof n === 'string')
			: []
	};

	const watchToday: string[] = Array.isArray(raw.watchToday)
		? (raw.watchToday as unknown[]).filter((w): w is string => typeof w === 'string')
		: [];

	const noiseFilter: string[] = Array.isArray(raw.noiseFilter)
		? (raw.noiseFilter as unknown[]).filter((n): n is string => typeof n === 'string')
		: [];

	return { topSignal, overnight, marketContext, watchToday, noiseFilter, generatedAt: Date.now(), model };
}

const REQUEST_TIMEOUT_MS = 30_000;

export const POST: RequestHandler = async ({ request }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	const req = body as DigestRequest;
	if (!req || !Array.isArray(req.headlines)) {
		throw error(400, 'Body must include headlines array');
	}

	const headlines = req.headlines.filter((h): h is string => typeof h === 'string' && h.trim().length > 0);
	const correlations = Array.isArray(req.correlations) ? req.correlations : [];
	const markets = Array.isArray(req.markets) ? req.markets : [];

	if (headlines.length === 0) {
		throw error(400, 'No usable headlines provided');
	}

	const config = { ...DEFAULT_DGX_CONFIG, enabled: true };
	const userPrompt = buildUserPrompt({ headlines, correlations, markets });

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

	let rawText: string | null = null;
	try {
		const res = await fetch(`${config.baseUrl}/chat/completions`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			signal: controller.signal,
			body: JSON.stringify({
				model: config.model,
				messages: [
					{ role: 'system', content: SYSTEM_PROMPT },
					{ role: 'user', content: userPrompt }
				],
				temperature: 0.3,
				max_tokens: 1024,
				response_format: { type: 'json_object' }
			})
		});

		if (!res.ok) {
			console.warn(`[Digest] DGX HTTP ${res.status}`);
			throw error(503, 'DGX endpoint returned an error');
		}

		const data = await res.json() as { choices: Array<{ message: { content: string } }>; model: string };
		rawText = data.choices?.[0]?.message?.content ?? null;
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) throw err;
		const msg = err instanceof Error ? err.message : String(err);
		console.warn('[Digest] Fetch error:', msg);
		throw error(503, 'DGX endpoint unavailable');
	} finally {
		clearTimeout(timer);
	}

	if (!rawText) {
		throw error(503, 'DGX returned empty response');
	}

	const parsed = parseJsonResponse(rawText);
	if (!parsed) {
		throw error(503, 'DGX response could not be parsed as JSON');
	}

	return json(validateDigest(parsed, config.model));
};
