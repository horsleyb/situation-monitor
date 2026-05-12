/**
 * GET /api/weather?location=<city> — current weather via wttr.in (no API key needed)
 * location: city name, "zip code", "lat,lon", etc. Defaults to Chicago.
 * Cached 10 minutes per location.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const CACHE_TTL = 10 * 60 * 1000;

interface CacheEntry { data: unknown; expires: number }
const cache = new Map<string, CacheEntry>();
function getCached(key: string): unknown | null {
	const e = cache.get(key);
	return e && Date.now() < e.expires ? e.data : null;
}
function setCached(key: string, data: unknown): void {
	cache.set(key, { data, expires: Date.now() + CACHE_TTL });
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

const BASE_HEADERS = {
	'Content-Type': 'application/json',
	'X-Content-Type-Options': 'nosniff',
	'Access-Control-Allow-Origin': '*',
	// Weather is unlikely to change within 10 minutes
	'Cache-Control': 'public, max-age=600, stale-while-revalidate=120'
};

/** Sanitize the location param: allow letters, digits, spaces, commas, hyphens, dots, + */
function sanitizeLocation(raw: string): string {
	return raw
		.trim()
		.slice(0, 100) // hard length cap
		.replace(/[^a-zA-Z0-9 ,.\-+]/g, '');
}

export const GET: RequestHandler = async ({ url }) => {
	const rawLocation = url.searchParams.get('location') || 'Chicago';
	const location = sanitizeLocation(rawLocation) || 'Chicago';
	const headers = BASE_HEADERS;
	const cacheKey = `weather:${location.toLowerCase()}`;

	const cached = getCached(cacheKey);
	if (cached) return json(cached, { headers });

	try {
		const encodedLoc = encodeURIComponent(location);
		const res = await fetch(
			`https://wttr.in/${encodedLoc}?format=j1`,
			{
				signal: AbortSignal.timeout(8000),
				headers: { 'User-Agent': 'Jarvis/2.0 Weather' }
			}
		);

		if (!res.ok) {
			throw error(502, `Weather service returned ${res.status}`);
		}

		const raw = await res.json();
		const cc = raw.current_condition?.[0];
		const area = raw.nearest_area?.[0];

		if (!cc || !area) {
			throw error(502, 'Unexpected weather data format');
		}

		const areaName = area.areaName?.[0]?.value || location;
		const country = area.country?.[0]?.value || '';

		const forecast = (raw.weather || []).slice(0, 3).map((day: Record<string, unknown>) => {
			const hourly = (day.hourly as Record<string, unknown>[])?.[4] || {};
			return {
				date: day.date as string,
				high_f: parseInt(String(day.maxtempF || 0)),
				low_f: parseInt(String(day.mintempF || 0)),
				condition: ((hourly.weatherDesc as {value:string}[])?.[0]?.value) || '',
				rain_chance: parseInt(String((hourly as Record<string,unknown>).chanceofrain || 0)),
			};
		});

		const data: WeatherData = {
			location: areaName,
			country,
			temp_f: parseInt(String(cc.temp_F || 0)),
			temp_c: parseInt(String(cc.temp_C || 0)),
			feels_like_f: parseInt(String(cc.FeelsLikeF || 0)),
			feels_like_c: parseInt(String(cc.FeelsLikeC || 0)),
			humidity: parseInt(String(cc.humidity || 0)),
			wind_mph: parseInt(String(cc.windspeedMiles || 0)),
			wind_dir: cc.winddir16Point as string || '',
			condition: (cc.weatherDesc as {value:string}[])?.[0]?.value || WEATHER_CODES[parseInt(String(cc.weatherCode || 0))] || '',
			visibility_miles: parseInt(String(cc.visibility || 0)),
			uv_index: parseInt(String(cc.uvIndex || 0)),
			forecast,
			timestamp: new Date().toISOString(),
		};

		setCached(cacheKey, data);
		return json(data, { headers });

	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) throw err;
		throw error(502, `Weather fetch failed: ${err}`);
	}
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
