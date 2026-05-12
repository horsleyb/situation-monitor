/**
 * GET /api/briefing — comprehensive situational snapshot for Jarvis
 * Aggregates top news (via RSS) + market data + economic indicators.
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
function setCached(key: string, data: unknown, ttl = CACHE_TTL): void {
	cache.set(key, { data, expires: Date.now() + ttl });
}

// ── RSS news ──────────────────────────────────────────────────────────────────

interface Article { title: string; url: string; source: string; date: string }

const CATEGORY_FEEDS: Record<string, { url: string; source: string }[]> = {
	politics: [
		{ url: 'https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml', source: 'NYT' },
		{ url: 'https://feeds.bbci.co.uk/news/politics/rss.xml', source: 'BBC' }
	],
	finance: [
		{ url: 'https://feeds.bbci.co.uk/news/business/rss.xml', source: 'BBC Business' },
		{ url: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml', source: 'NYT Business' }
	],
	ai: [
		{ url: 'https://arstechnica.com/ai/feed/', source: 'Ars Technica' },
		{ url: 'https://techcrunch.com/category/artificial-intelligence/feed/', source: 'TechCrunch' }
	],
	intel: [
		{ url: 'https://feeds.bbci.co.uk/news/world/rss.xml', source: 'BBC World' },
		{ url: 'https://www.theguardian.com/world/rss', source: 'Guardian' }
	]
};

function parseRss(xml: string, source: string): Article[] {
	const items: Article[] = [];
	const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/gi;
	const titleRe = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i;
	const linkRe = /<(?:link|guid[^>]*isPermaLink[^>]*>)(?:<!\[CDATA\[)?(https?:\/\/[^\s<]+)(?:\]\]>)?/i;
	const dateRe = /<pubDate>([\s\S]*?)<\/pubDate>/i;

	let m;
	while ((m = itemRe.exec(xml)) !== null) {
		const item = m[1];
		const title = titleRe.exec(item)?.[1]?.trim().replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>') ?? '';
		const url = linkRe.exec(item)?.[1]?.trim() ?? '';
		const date = dateRe.exec(item)?.[1]?.trim() ?? '';
		if (title && url) items.push({ title, url, source, date });
	}
	return items;
}

async function fetchRssFeed(url: string, source: string): Promise<Article[]> {
	try {
		const res = await fetch(url, {
			signal: AbortSignal.timeout(7000),
			headers: { 'User-Agent': 'Jarvis/2.0 RSS Reader' }
		});
		if (!res.ok) return [];
		const xml = await res.text();
		return parseRss(xml, source);
	} catch {
		return [];
	}
}

async function fetchCategoryNews(category: string, max = 4): Promise<Article[]> {
	const feeds = CATEGORY_FEEDS[category] ?? [];
	if (!feeds.length) return [];

	const cacheKey = `rss:${category}`;
	const cached = getCached(cacheKey);
	if (cached) return cached as Article[];

	const results = await Promise.all(feeds.map((f) => fetchRssFeed(f.url, f.source)));
	const merged = results.flat().slice(0, max);
	setCached(cacheKey, merged);
	return merged;
}

// ── Market data ───────────────────────────────────────────────────────────────

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
	} catch { return null; }
}

interface CryptoItem { symbol: string; name: string; price: number; change24h: number }
async function coinGeckoCrypto(): Promise<CryptoItem[]> {
	try {
		const res = await fetch(
			'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true',
			{ signal: AbortSignal.timeout(6000) }
		);
		if (!res.ok) return [];
		const d = await res.json();
		return [
			{ symbol: 'BTC', name: 'Bitcoin', price: d.bitcoin?.usd ?? 0, change24h: d.bitcoin?.usd_24h_change ?? 0 },
			{ symbol: 'ETH', name: 'Ethereum', price: d.ethereum?.usd ?? 0, change24h: d.ethereum?.usd_24h_change ?? 0 },
			{ symbol: 'SOL', name: 'Solana', price: d.solana?.usd ?? 0, change24h: d.solana?.usd_24h_change ?? 0 }
		];
	} catch { return []; }
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
	} catch { return { value: null, date: null }; }
}

// ── Handler ───────────────────────────────────────────────────────────────────

const BASE_HEADERS = {
	'Content-Type': 'application/json',
	'X-Content-Type-Options': 'nosniff',
	'Access-Control-Allow-Origin': '*',
	// Briefing is cached 5 min server-side; tell clients to revalidate after 1 min
	'Cache-Control': 'public, max-age=60, stale-while-revalidate=60'
};

export const GET: RequestHandler = async () => {
	const cached = getCached('briefing');
	if (cached) return json(cached, { headers: BASE_HEADERS });

	const [politics, finance, ai, intel, spy, dia, qqq, crypto, fedFunds, treasury10y] =
		await Promise.allSettled([
			fetchCategoryNews('politics', 4),
			fetchCategoryNews('finance', 4),
			fetchCategoryNews('ai', 4),
			fetchCategoryNews('intel', 3),
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
	return json(briefing, { headers: BASE_HEADERS });
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
