/**
 * GET /api/briefing — comprehensive situational snapshot for Jarvis
 * Aggregates top news + market data + economic indicators.
 * Cached 5 minutes in memory.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const FINNHUB_KEY = process.env.VITE_FINNHUB_API_KEY ?? '';
const FRED_KEY = process.env.VITE_FRED_API_KEY ?? '';
const CACHE_TTL = 5 * 60 * 1000;

interface CacheEntry { data: unknown; expires: number }
const cache = new Map<string, CacheEntry>();

function getCached(key: string): unknown | null {
	const e = cache.get(key);
	return e && Date.now() < e.expires ? e.data : null;
}
function setCached(key: string, data: unknown): void {
	cache.set(key, { data, expires: Date.now() + CACHE_TTL });
}

interface NewsArticle { title: string; url: string; source: string; date: string }
async function gdeltNews(query: string, max = 5): Promise<NewsArticle[]> {
	try {
		const q = encodeURIComponent(`${query} sourcelang:english`);
		const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${q}&timespan=24h&mode=artlist&maxrecords=${max}&format=json&sort=date`;
		const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
		if (!res.ok) return [];
		const d = await res.json();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return (d.articles ?? []).map((a: any) => ({
			title: a.title ?? '',
			url: a.url ?? '',
			source: a.domain ?? '',
			date: a.seendate ?? ''
		}));
	} catch {
		return [];
	}
}

interface Quote { price: number; change: number; changePercent: number }
async function finnhubQuote(symbol: string): Promise<Quote | null> {
	if (!FINNHUB_KEY) return null;
	try {
		const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`;
		const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
		if (!res.ok) return null;
		const d = await res.json();
		if (d.c === 0 && d.pc === 0) return null;
		return { price: d.c, change: d.d, changePercent: d.dp };
	} catch {
		return null;
	}
}

interface CryptoItem { symbol: string; name: string; price: number; change24h: number }
async function coinGeckoCrypto(): Promise<CryptoItem[]> {
	try {
		const url = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true';
		const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
		if (!res.ok) return [];
		const d = await res.json();
		return [
			{ symbol: 'BTC', name: 'Bitcoin', price: d.bitcoin?.usd ?? 0, change24h: d.bitcoin?.usd_24h_change ?? 0 },
			{ symbol: 'ETH', name: 'Ethereum', price: d.ethereum?.usd ?? 0, change24h: d.ethereum?.usd_24h_change ?? 0 },
			{ symbol: 'SOL', name: 'Solana', price: d.solana?.usd ?? 0, change24h: d.solana?.usd_24h_change ?? 0 }
		];
	} catch {
		return [];
	}
}

interface FredValue { value: number | null; date: string | null }
async function fredSeries(seriesId: string): Promise<FredValue> {
	if (!FRED_KEY) return { value: null, date: null };
	try {
		const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${FRED_KEY}&file_type=json&sort_order=desc&limit=1`;
		const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
		if (!res.ok) return { value: null, date: null };
		const d = await res.json();
		const obs = d.observations?.[0];
		const raw = obs?.value;
		const val = raw === '.' || raw == null ? null : parseFloat(raw);
		return { value: isNaN(val as number) ? null : val, date: obs?.date ?? null };
	} catch {
		return { value: null, date: null };
	}
}

export const GET: RequestHandler = async () => {
	const cached = getCached('briefing');
	if (cached) return json(cached, { headers: { 'Access-Control-Allow-Origin': '*' } });

	const [politics, finance, ai, intel, spy, dia, qqq, crypto, fedFunds, treasury10y] =
		await Promise.allSettled([
			gdeltNews('(politics OR government OR election OR congress)', 4),
			gdeltNews('(finance OR "stock market" OR economy OR banking)', 4),
			gdeltNews('("artificial intelligence" OR "machine learning" OR AI)', 4),
			gdeltNews('(intelligence OR security OR military OR defense)', 3),
			finnhubQuote('SPY'),
			finnhubQuote('DIA'),
			finnhubQuote('QQQ'),
			coinGeckoCrypto(),
			fredSeries('FEDFUNDS'),
			fredSeries('DGS10')
		]);

	const ok = <T>(r: PromiseSettledResult<T>, fallback: T): T =>
		r.status === 'fulfilled' ? r.value : fallback;

	const briefing = {
		timestamp: new Date().toISOString(),
		news: {
			politics: ok(politics, []),
			finance: ok(finance, []),
			ai: ok(ai, []),
			intel: ok(intel, [])
		},
		markets: {
			indices: {
				sp500: { label: 'S&P 500', ...ok(spy, null) },
				dow: { label: 'Dow Jones', ...ok(dia, null) },
				nasdaq: { label: 'NASDAQ', ...ok(qqq, null) }
			},
			crypto: ok(crypto, [])
		},
		economy: {
			fedFundsRate: { name: 'Fed Funds Rate', unit: '%', ...ok(fedFunds, { value: null, date: null }) },
			treasury10Y: { name: '10Y Treasury', unit: '%', ...ok(treasury10y, { value: null, date: null }) }
		}
	};

	setCached('briefing', briefing);
	return json(briefing, { headers: { 'Access-Control-Allow-Origin': '*' } });
};

export const OPTIONS: RequestHandler = async () =>
	new Response(null, {
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type'
		}
	});
