/**
 * GET /api/markets — live market snapshot
 * Returns: major indices (via Finnhub ETF proxies), crypto (CoinGecko), FRED indicators.
 * Markets cached 60s, economic indicators cached 5 min.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const FINNHUB_KEY = process.env.VITE_FINNHUB_API_KEY ?? '';
const FRED_KEY = process.env.VITE_FRED_API_KEY ?? '';

interface CacheEntry { data: unknown; expires: number }
const cache = new Map<string, CacheEntry>();

function getCached(key: string): unknown | null {
	const e = cache.get(key);
	return e && Date.now() < e.expires ? e.data : null;
}
function setCached(key: string, data: unknown, ttlMs: number): void {
	cache.set(key, { data, expires: Date.now() + ttlMs });
}

interface Quote { symbol: string; label: string; price: number; change: number; changePercent: number }

const INDEX_MAP = [
	{ symbol: '^GSPC', etf: 'SPY', label: 'S&P 500' },
	{ symbol: '^DJI', etf: 'DIA', label: 'Dow Jones' },
	{ symbol: '^IXIC', etf: 'QQQ', label: 'NASDAQ' },
	{ symbol: '^RUT', etf: 'IWM', label: 'Russell 2000' }
];

async function finnhubQuote(symbol: string): Promise<{ c: number; d: number; dp: number } | null> {
	if (!FINNHUB_KEY) return null;
	try {
		const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`;
		const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
		if (!res.ok) return null;
		const d = await res.json();
		if (d.c === 0 && d.pc === 0) return null;
		return d;
	} catch {
		return null;
	}
}

async function fetchIndices(): Promise<Quote[]> {
	const cached = getCached('markets:indices');
	if (cached) return cached as Quote[];

	const results = await Promise.all(
		INDEX_MAP.map(async ({ symbol, etf, label }) => {
			const q = await finnhubQuote(etf);
			return {
				symbol,
				label,
				price: q?.c ?? NaN,
				change: q?.d ?? NaN,
				changePercent: q?.dp ?? NaN
			};
		})
	);

	setCached('markets:indices', results, 60_000);
	return results;
}

interface CryptoItem { symbol: string; name: string; price: number; change24h: number }

async function fetchCrypto(): Promise<CryptoItem[]> {
	const cached = getCached('markets:crypto');
	if (cached) return cached as CryptoItem[];

	try {
		const url = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true';
		const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
		if (!res.ok) return [];
		const d = await res.json();
		const result: CryptoItem[] = [
			{ symbol: 'BTC', name: 'Bitcoin', price: d.bitcoin?.usd ?? 0, change24h: d.bitcoin?.usd_24h_change ?? 0 },
			{ symbol: 'ETH', name: 'Ethereum', price: d.ethereum?.usd ?? 0, change24h: d.ethereum?.usd_24h_change ?? 0 },
			{ symbol: 'SOL', name: 'Solana', price: d.solana?.usd ?? 0, change24h: d.solana?.usd_24h_change ?? 0 }
		];
		setCached('markets:crypto', result, 60_000);
		return result;
	} catch {
		return [];
	}
}

interface FredValue { name: string; unit: string; value: number | null; date: string | null }

async function fredSeries(seriesId: string, name: string, unit: string): Promise<FredValue> {
	const cacheKey = `fred:${seriesId}`;
	const cached = getCached(cacheKey);
	if (cached) return cached as FredValue;

	if (!FRED_KEY) return { name, unit, value: null, date: null };
	try {
		const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${FRED_KEY}&file_type=json&sort_order=desc&limit=1`;
		const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
		if (!res.ok) return { name, unit, value: null, date: null };
		const d = await res.json();
		const obs = d.observations?.[0];
		const raw = obs?.value;
		const val = raw === '.' || raw == null ? null : parseFloat(raw);
		const result = { name, unit, value: isNaN(val as number) ? null : val, date: obs?.date ?? null };
		setCached(cacheKey, result, 5 * 60_000);
		return result;
	} catch {
		return { name, unit, value: null, date: null };
	}
}

const BASE_HEADERS = {
	'Content-Type': 'application/json',
	'X-Content-Type-Options': 'nosniff',
	'Access-Control-Allow-Origin': '*',
	// Market indices cached 60s server-side; advise clients to revalidate after 1 min
	'Cache-Control': 'public, max-age=60, stale-while-revalidate=30'
};

export const GET: RequestHandler = async () => {
	const headers = BASE_HEADERS;

	const [indices, crypto, fedFunds, treasury10y] = await Promise.all([
		fetchIndices(),
		fetchCrypto(),
		fredSeries('FEDFUNDS', 'Fed Funds Rate', '%'),
		fredSeries('DGS10', '10Y Treasury', '%')
	]);

	return json(
		{
			timestamp: new Date().toISOString(),
			indices,
			crypto,
			economy: { fedFundsRate: fedFunds, treasury10Y: treasury10y },
			hasFinnhub: Boolean(FINNHUB_KEY),
			hasFred: Boolean(FRED_KEY)
		},
		{ headers }
	);
};

export const OPTIONS: RequestHandler = async () =>
	new Response(null, {
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
			'X-Content-Type-Options': 'nosniff'
		}
	});
