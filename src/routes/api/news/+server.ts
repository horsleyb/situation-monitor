/**
 * GET /api/news?category=<category> — news articles via RSS feeds
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

const CATEGORY_FEEDS: Record<string, { url: string; source: string }[]> = {
	politics: [
		{ url: 'https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml', source: 'NYT' },
		{ url: 'https://feeds.bbci.co.uk/news/politics/rss.xml', source: 'BBC Politics' }
	],
	tech: [
		{ url: 'https://techcrunch.com/feed/', source: 'TechCrunch' },
		{ url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', source: 'BBC Tech' }
	],
	finance: [
		{ url: 'https://feeds.bbci.co.uk/news/business/rss.xml', source: 'BBC Business' },
		{ url: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml', source: 'NYT Business' }
	],
	gov: [
		{ url: 'https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml', source: 'NYT Politics' },
		{ url: 'https://www.theguardian.com/us-news/rss', source: 'Guardian US' }
	],
	ai: [
		{ url: 'https://arstechnica.com/ai/feed/', source: 'Ars Technica AI' },
		{ url: 'https://techcrunch.com/category/artificial-intelligence/feed/', source: 'TechCrunch AI' }
	],
	intel: [
		{ url: 'https://feeds.bbci.co.uk/news/world/rss.xml', source: 'BBC World' },
		{ url: 'https://www.theguardian.com/world/rss', source: 'Guardian World' }
	]
};

const ALL_CATEGORIES = Object.keys(CATEGORY_FEEDS);

interface Article { title: string; url: string; source: string; date: string }

function parseRss(xml: string, source: string): Article[] {
	const items: Article[] = [];
	const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/gi;
	const titleRe = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i;
	const linkRe = /<(?:link|guid[^>]*isPermaLink[^>]*>)(?:<!\[CDATA\[)?(https?:\/\/[^\s<]+)(?:\]\]>)?/i;
	const dateRe = /<pubDate>([\s\S]*?)<\/pubDate>/i;

	let m;
	while ((m = itemRe.exec(xml)) !== null) {
		const item = m[1];
		const title = titleRe.exec(item)?.[1]?.trim()
			.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>') ?? '';
		const url = linkRe.exec(item)?.[1]?.trim() ?? '';
		const date = dateRe.exec(item)?.[1]?.trim() ?? '';
		if (title && url) items.push({ title, url, source, date });
	}
	return items;
}

async function fetchFeed(url: string, source: string): Promise<Article[]> {
	try {
		const res = await fetch(url, {
			signal: AbortSignal.timeout(7000),
			headers: { 'User-Agent': 'Jarvis/2.0 RSS Reader' }
		});
		if (!res.ok) return [];
		return parseRss(await res.text(), source);
	} catch {
		return [];
	}
}

async function fetchCategory(category: string): Promise<Article[]> {
	const cacheKey = `rss:${category}`;
	const cached = getCached(cacheKey);
	if (cached) return cached as Article[];

	const feeds = CATEGORY_FEEDS[category] ?? [];
	const results = await Promise.all(feeds.map((f) => fetchFeed(f.url, f.source)));
	const articles = results.flat().slice(0, 10);
	setCached(cacheKey, articles);
	return articles;
}

const BASE_HEADERS = {
	'Content-Type': 'application/json',
	'X-Content-Type-Options': 'nosniff',
	'Access-Control-Allow-Origin': '*',
	// News refreshes every 5 minutes server-side; tell clients to revalidate after 1 min
	'Cache-Control': 'public, max-age=60, stale-while-revalidate=60'
};

export const GET: RequestHandler = async ({ url }) => {
	const category = url.searchParams.get('category')?.toLowerCase().trim();
	const headers = BASE_HEADERS;

	if (category) {
		if (!ALL_CATEGORIES.includes(category)) {
			throw error(400, `Unknown category. Valid: ${ALL_CATEGORIES.join(', ')}`);
		}
		const articles = await fetchCategory(category);
		return json(
			{ category, articles, count: articles.length, timestamp: new Date().toISOString() },
			{ headers }
		);
	}

	const result: Record<string, Article[]> = {};
	await Promise.all(
		ALL_CATEGORIES.map(async (cat) => {
			result[cat] = await fetchCategory(cat);
		})
	);

	return json({ categories: result, timestamp: new Date().toISOString() }, { headers });
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
