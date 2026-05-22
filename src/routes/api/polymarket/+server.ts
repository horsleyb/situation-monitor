/**
 * GET /api/polymarket — active prediction markets via Polymarket CLOB API
 * Returns top 10 markets by volume, cached 5 minutes.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface PolymarketToken {
	token_id: string;
	outcome: string;
	price: number;
}

interface PolymarketMarket {
	condition_id: string;
	question: string;
	tokens: PolymarketToken[];
	volume: number;
	active: boolean;
	closed: boolean;
}

interface PolymarketResponse {
	data: PolymarketMarket[];
}

interface Prediction {
	id: string;
	question: string;
	yes: number;
	volume: string;
}

function formatVolume(n: number): string {
	if (!n || n <= 0) return '$0';
	if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M';
	if (n >= 1_000) return '$' + (n / 1_000).toFixed(0) + 'K';
	return '$' + Math.round(n).toString();
}

export const GET: RequestHandler = async () => {
	const headers = {
		'Cache-Control': 'public, max-age=300',
		'Access-Control-Allow-Origin': '*'
	};

	try {
		const res = await fetch('https://clob.polymarket.com/markets?active=true&limit=50', {
			signal: AbortSignal.timeout(10000),
			headers: { 'User-Agent': 'SituationMonitor/1.0' }
		});

		if (!res.ok) {
			console.error(`[polymarket] CLOB API returned ${res.status}`);
			return json({ data: [], error: `Upstream error: ${res.status}` }, { headers });
		}

		const raw: PolymarketResponse = await res.json();

		const markets: Prediction[] = (raw.data ?? [])
			.filter((m) => m.active && !m.closed && Array.isArray(m.tokens) && m.tokens.length > 0)
			.sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
			.slice(0, 10)
			.map((m) => {
				const yesToken = m.tokens.find((t) => t.outcome.toLowerCase() === 'yes');
				const yesPrice = yesToken ? yesToken.price : 0;
				return {
					id: m.condition_id,
					question: m.question,
					yes: Math.round(yesPrice * 100),
					volume: formatVolume(m.volume ?? 0)
				};
			});

		return json({ data: markets }, { headers });
	} catch (err) {
		console.error('[polymarket] Fetch failed:', err);
		return json({ data: [], error: String(err) }, { headers });
	}
};

export const OPTIONS: RequestHandler = async () =>
	new Response(null, {
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type'
		}
	});
