/**
 * GET /api/news?category=<category> — news articles from GDELT
 * category: politics | tech | finance | gov | ai | intel  (omit for all)
 * Cached 5 minutes per category.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

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

const CATEGORY_QUERIES: Record<string, string> = {
	politics: '(politics OR government OR election OR congress)',
	tech: '(technology OR software OR startup OR "silicon valley")',
	finance: '(finance OR "stock market" OR economy OR banking)',
	gov: '("federal government" OR "white house" OR congress OR regulation)',
	ai: '("artificial intelligence" OR "machine learning" OR AI OR ChatGPT)',
	intel: '(intelligence OR security OR military OR defense)'
};

const ALL_CATEGORIES = Object.keys(CATEGORY_QUERIES);

interface Article { title: string; url: string; source: string; date: string }

async function fetchCategory(category: string): Promise<Article[]> {
	const query = CATEGORY_QUERIES[category];
	if (!query) return [];

	const cacheKey = `news:${category}`;
	const cached = getCached(cacheKey);
	if (cached) return cached as Article[];

	try {
		const q = encodeURIComponent(`${query} sourcelang:english`);
		const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${q}&timespan=24h&mode=artlist&maxrecords=10&format=json&sort=date`;
		const res = await fetch(url, { signal: AbortSignal.timeout(7000) });
		if (!res.ok) return [];
		const d = await res.json();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const articles: Article[] = (d.articles ?? []).map((a: any) => ({
			title: a.title ?? '',
			url: a.url ?? '',
			source: a.domain ?? '',
			date: a.seendate ?? ''
		}));
		setCached(cacheKey, articles);
		return articles;
	} catch {
		return [];
	}
}

export const GET: RequestHandler = async ({ url }) => {
	const category = url.searchParams.get('category')?.toLowerCase();

	const headers = { 'Access-Control-Allow-Origin': '*' };

	if (category) {
		if (!ALL_CATEGORIES.includes(category)) {
			throw error(400, `Unknown category. Valid: ${ALL_CATEGORIES.join(', ')}`);
		}
		const articles = await fetchCategory(category);
		return json({ category, articles, count: articles.length, timestamp: new Date().toISOString() }, { headers });
	}

	// Fetch all categories with 500ms stagger to avoid GDELT rate limits
	const result: Record<string, Article[]> = {};
	for (let i = 0; i < ALL_CATEGORIES.length; i++) {
		if (i > 0) await new Promise((r) => setTimeout(r, 500));
		result[ALL_CATEGORIES[i]] = await fetchCategory(ALL_CATEGORIES[i]);
	}

	return json({ categories: result, timestamp: new Date().toISOString() }, { headers });
};

export const OPTIONS: RequestHandler = async () =>
	new Response(null, {
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type'
		}
	});
