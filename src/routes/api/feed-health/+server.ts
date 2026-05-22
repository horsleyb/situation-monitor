/**
 * GET /api/feed-health — probe all configured RSS feeds and return health status
 * Results are cached for 5 minutes to avoid hammering feeds.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const PROBE_TIMEOUT_MS = 8000;

export interface FeedHealthResult {
	url: string;
	name: string;
	category: string;
	status: 'ok' | 'error';
	latencyMs: number | null;
	error: string | null;
	checkedAt: string;
}

export interface FeedHealthResponse {
	feeds: FeedHealthResult[];
	summary: {
		total: number;
		ok: number;
		error: number;
	};
	checkedAt: string;
}

// All feeds to probe (kept flat here so the server route is self-contained)
const ALL_FEEDS: { url: string; name: string; category: string }[] = [
	// politics
	{ url: 'https://feeds.bbci.co.uk/news/world/rss.xml', name: 'BBC World', category: 'politics' },
	{ url: 'https://feeds.npr.org/1001/rss.xml', name: 'NPR News', category: 'politics' },
	{ url: 'https://www.theguardian.com/world/rss', name: 'Guardian World', category: 'politics' },
	{
		url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
		name: 'NYT World',
		category: 'politics'
	},
	// tech
	{ url: 'https://hnrss.org/frontpage', name: 'Hacker News', category: 'tech' },
	{
		url: 'https://feeds.arstechnica.com/arstechnica/technology-lab',
		name: 'Ars Technica',
		category: 'tech'
	},
	{ url: 'https://www.theverge.com/rss/index.xml', name: 'The Verge', category: 'tech' },
	{
		url: 'https://www.technologyreview.com/feed/',
		name: 'MIT Tech Review',
		category: 'tech'
	},
	{ url: 'https://rss.arxiv.org/rss/cs.AI', name: 'ArXiv AI', category: 'tech' },
	{ url: 'https://openai.com/news/rss.xml', name: 'OpenAI Blog', category: 'tech' },
	// finance
	{
		url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html',
		name: 'CNBC',
		category: 'finance'
	},
	{
		url: 'https://feeds.marketwatch.com/marketwatch/topstories',
		name: 'MarketWatch',
		category: 'finance'
	},
	{
		url: 'https://finance.yahoo.com/news/rssindex',
		name: 'Yahoo Finance',
		category: 'finance'
	},
	{
		url: 'https://feeds.bbci.co.uk/news/business/rss.xml',
		name: 'BBC Business',
		category: 'finance'
	},
	{ url: 'https://www.ft.com/rss/home', name: 'FT', category: 'finance' },
	// gov
	{ url: 'https://www.whitehouse.gov/news/feed/', name: 'White House', category: 'gov' },
	{
		url: 'https://www.federalreserve.gov/feeds/press_all.xml',
		name: 'Federal Reserve',
		category: 'gov'
	},
	{ url: 'https://www.sec.gov/news/pressreleases.rss', name: 'SEC', category: 'gov' },
	{
		url: 'https://www.defense.gov/DesktopModules/ArticleCS/RSS.ashx?max=10&ContentType=1&Site=945',
		name: 'DoD News',
		category: 'gov'
	},
	// intel sources
	{ url: 'https://www.csis.org/analysis/feed', name: 'CSIS', category: 'intel' },
	{ url: 'https://www.brookings.edu/feed/', name: 'Brookings', category: 'intel' },
	{ url: 'https://www.cfr.org/rss.xml', name: 'CFR', category: 'intel' },
	{ url: 'https://www.defenseone.com/rss/all/', name: 'Defense One', category: 'intel' },
	{ url: 'https://warontherocks.com/feed/', name: 'War on Rocks', category: 'intel' },
	{ url: 'https://breakingdefense.com/feed/', name: 'Breaking Defense', category: 'intel' },
	{
		url: 'https://www.thedrive.com/the-war-zone/feed',
		name: 'The Drive War Zone',
		category: 'intel'
	},
	{ url: 'https://thediplomat.com/feed/', name: 'The Diplomat', category: 'intel' },
	{ url: 'https://www.al-monitor.com/rss', name: 'Al-Monitor', category: 'intel' },
	{ url: 'https://www.bellingcat.com/feed/', name: 'Bellingcat', category: 'intel' },
	{
		url: 'https://www.cisa.gov/uscert/ncas/alerts.xml',
		name: 'CISA Alerts',
		category: 'intel'
	},
	{ url: 'https://krebsonsecurity.com/feed/', name: 'Krebs Security', category: 'intel' }
];

interface CacheEntry {
	data: FeedHealthResponse;
	expires: number;
}
let cached: CacheEntry | null = null;

async function probeFeed(
	feed: (typeof ALL_FEEDS)[number]
): Promise<FeedHealthResult> {
	const start = Date.now();
	const checkedAt = new Date().toISOString();

	try {
		const res = await fetch(feed.url, {
			signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
			headers: { 'User-Agent': 'SituationMonitor/1.0 Feed Health Check' },
			method: 'HEAD' // lightweight - just check reachability
		});

		if (res.ok || res.status === 405) {
			// 405 = Method Not Allowed on HEAD → try GET
			if (res.status === 405) {
				const getRes = await fetch(feed.url, {
					signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
					headers: { 'User-Agent': 'SituationMonitor/1.0 Feed Health Check' }
				});
				const latencyMs = Date.now() - start;
				if (getRes.ok) {
					return { ...feed, status: 'ok', latencyMs, error: null, checkedAt };
				}
				return {
					...feed,
					status: 'error',
					latencyMs,
					error: `HTTP ${getRes.status}`,
					checkedAt
				};
			}
			return { ...feed, status: 'ok', latencyMs: Date.now() - start, error: null, checkedAt };
		}

		return {
			...feed,
			status: 'error',
			latencyMs: Date.now() - start,
			error: `HTTP ${res.status}`,
			checkedAt
		};
	} catch (err) {
		return {
			...feed,
			status: 'error',
			latencyMs: null,
			error: err instanceof Error ? err.message : 'Unknown error',
			checkedAt
		};
	}
}

export const GET: RequestHandler = async () => {
	// Return cached result if fresh
	if (cached && Date.now() < cached.expires) {
		return json(cached.data, {
			headers: { 'Cache-Control': 'public, max-age=300' }
		});
	}

	// Probe all feeds in parallel
	const results = await Promise.all(ALL_FEEDS.map((f) => probeFeed(f)));

	const ok = results.filter((r) => r.status === 'ok').length;
	const response: FeedHealthResponse = {
		feeds: results,
		summary: { total: results.length, ok, error: results.length - ok },
		checkedAt: new Date().toISOString()
	};

	cached = { data: response, expires: Date.now() + CACHE_TTL };

	return json(response, {
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Cache-Control': 'public, max-age=300'
		}
	});
};

export const OPTIONS: RequestHandler = async () =>
	new Response(null, {
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type'
		}
	});
