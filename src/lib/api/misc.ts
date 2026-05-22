/**
 * Miscellaneous API functions for specialized panels
 * Note: Some of these use mock data as the original APIs require authentication
 */

export interface Prediction {
	id: string;
	question: string;
	yes: number;
	volume: string;
}

export interface WhaleTransaction {
	coin: string;
	amount: number;
	usd: number;
	hash: string;
}

export interface Contract {
	agency: string;
	description: string;
	vendor: string;
	amount: number;
}

export interface Layoff {
	company: string;
	count: number;
	title: string;
	date: string;
}

/**
 * Format a raw dollar volume number as a human-readable string.
 * e.g. 8100000 → "$8.1M", 450000 → "$450K"
 */
export function formatVolume(n: number): string {
	if (!n || n <= 0) return '$0';
	if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M';
	if (n >= 1_000) return '$' + (n / 1_000).toFixed(0) + 'K';
	return '$' + Math.round(n).toString();
}

/**
 * Fetch Polymarket predictions via the server-side proxy (/api/polymarket).
 * The proxy fetches from clob.polymarket.com and avoids CORS issues.
 */
export async function fetchPolymarket(): Promise<Prediction[]> {
	try {
		const res = await fetch('/api/polymarket');
		if (!res.ok) {
			console.error(`[fetchPolymarket] proxy returned ${res.status}`);
			return [];
		}
		const body: { data: Prediction[]; error?: string } = await res.json();
		if (body.error) {
			console.warn('[fetchPolymarket] upstream error:', body.error);
		}
		return Array.isArray(body.data) ? body.data : [];
	} catch (err) {
		console.error('[fetchPolymarket] failed:', err);
		return [];
	}
}

/**
 * Fetch whale transactions
 * Note: Would use Whale Alert API - returning sample data
 */
export async function fetchWhaleTransactions(): Promise<WhaleTransaction[]> {
	// Sample whale transaction data
	return [
		{ coin: 'BTC', amount: 1500, usd: 150000000, hash: '0x1a2b...3c4d' },
		{ coin: 'ETH', amount: 25000, usd: 85000000, hash: '0x5e6f...7g8h' },
		{ coin: 'BTC', amount: 850, usd: 85000000, hash: '0x9i0j...1k2l' },
		{ coin: 'SOL', amount: 500000, usd: 75000000, hash: '0x3m4n...5o6p' },
		{ coin: 'ETH', amount: 15000, usd: 51000000, hash: '0x7q8r...9s0t' }
	];
}

/**
 * Fetch government contracts
 * Note: Would use USASpending.gov API - returning sample data
 */
export async function fetchGovContracts(): Promise<Contract[]> {
	// Sample government contract data
	return [
		{
			agency: 'DOD',
			description: 'Advanced radar systems development and integration',
			vendor: 'Raytheon',
			amount: 2500000000
		},
		{
			agency: 'NASA',
			description: 'Artemis program lunar lander support services',
			vendor: 'SpaceX',
			amount: 1800000000
		},
		{
			agency: 'DHS',
			description: 'Border security technology modernization',
			vendor: 'Palantir',
			amount: 450000000
		},
		{
			agency: 'VA',
			description: 'Electronic health records system upgrade',
			vendor: 'Oracle Cerner',
			amount: 320000000
		},
		{
			agency: 'DOE',
			description: 'Clean energy grid infrastructure',
			vendor: 'General Electric',
			amount: 275000000
		}
	];
}

export interface WeatherData {
	location: string;
	country: string;
	temp_f: number;
	temp_c: number;
	feels_like_f: number;
	feels_like_c: number;
	humidity: number;
	wind_mph: number;
	wind_dir: string;
	condition: string;
	visibility_miles: number;
	uv_index: number;
	forecast: Array<{ date: string; high_f: number; low_f: number; condition: string; rain_chance: number }>;
	timestamp: string;
}

export async function fetchWeather(location = 'Chicago'): Promise<WeatherData> {
	const res = await fetch(`/api/weather?location=${encodeURIComponent(location)}`);
	if (!res.ok) throw new Error(`Weather fetch failed: ${res.status}`);
	return res.json() as Promise<WeatherData>;
}

export interface FeedHealthResult {
	url: string;
	name: string;
	category: string;
	status: 'ok' | 'error';
	latencyMs: number | null;
	error: string | null;
	checkedAt: string;
}

export interface FeedHealthSummary {
	total: number;
	ok: number;
	error: number;
}

export interface FeedHealthData {
	feeds: FeedHealthResult[];
	summary: FeedHealthSummary;
	checkedAt: string;
}

export async function fetchFeedHealth(): Promise<FeedHealthData> {
	const res = await fetch('/api/feed-health');
	if (!res.ok) throw new Error(`Feed health check failed: HTTP ${res.status}`);
	return res.json() as Promise<FeedHealthData>;
}

/**
 * Fetch layoffs data
 * Note: Would use layoffs.fyi API or similar - returning sample data
 */
export async function fetchLayoffs(): Promise<Layoff[]> {
	const now = new Date();
	const formatDate = (daysAgo: number) => {
		const d = new Date(now);
		d.setDate(d.getDate() - daysAgo);
		return d.toISOString();
	};

	return [
		{ company: 'Meta', count: 1200, title: 'Restructuring engineering teams', date: formatDate(2) },
		{ company: 'Amazon', count: 850, title: 'AWS division optimization', date: formatDate(5) },
		{
			company: 'Salesforce',
			count: 700,
			title: 'Post-acquisition consolidation',
			date: formatDate(8)
		},
		{
			company: 'Intel',
			count: 1500,
			title: 'Manufacturing pivot restructure',
			date: formatDate(12)
		},
		{ company: 'Snap', count: 500, title: 'Cost reduction initiative', date: formatDate(15) }
	];
}
