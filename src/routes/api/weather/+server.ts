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

const WEATHER_CODES: Record<number, string> = {
	113: 'Sunny', 116: 'Partly cloudy', 119: 'Cloudy', 122: 'Overcast',
	143: 'Mist', 176: 'Patchy rain', 179: 'Patchy snow', 182: 'Patchy sleet',
	185: 'Patchy freezing drizzle', 200: 'Thundery outbreaks', 227: 'Blowing snow',
	230: 'Blizzard', 248: 'Fog', 260: 'Freezing fog', 263: 'Light drizzle',
	266: 'Drizzle', 281: 'Freezing drizzle', 284: 'Heavy freezing drizzle',
	293: 'Light rain', 296: 'Light rain', 299: 'Moderate rain', 302: 'Moderate rain',
	305: 'Heavy rain', 308: 'Heavy rain', 311: 'Light sleet', 314: 'Moderate sleet',
	317: 'Light sleet', 320: 'Moderate snow', 323: 'Patchy light snow',
	326: 'Light snow', 329: 'Patchy moderate snow', 332: 'Moderate snow',
	335: 'Patchy heavy snow', 338: 'Heavy snow', 350: 'Ice pellets',
	353: 'Light rain shower', 356: 'Moderate rain shower', 359: 'Torrential rain',
	362: 'Light sleet shower', 365: 'Moderate sleet shower', 368: 'Light snow shower',
	371: 'Moderate snow shower', 374: 'Light ice pellet shower',
	377: 'Moderate ice pellet shower', 386: 'Patchy rain with thunder',
	389: 'Moderate/heavy rain with thunder', 392: 'Patchy snow with thunder',
	395: 'Moderate/heavy snow with thunder',
};

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

export const GET: RequestHandler = async ({ url }) => {
	const location = (url.searchParams.get('location') || 'Chicago').trim();
	const headers = { 'Access-Control-Allow-Origin': '*' };
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
			condition: (cc.weatherDesc as {value:string}[])?.[0]?.value || '',
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
			'Access-Control-Allow-Headers': 'Content-Type'
		}
	});
