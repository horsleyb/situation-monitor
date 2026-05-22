/**
 * SvelteKit server hooks
 * - Rate limiting: 60 req/min per IP for /api/* routes (sliding window, in-memory)
 */
import type { Handle } from '@sveltejs/kit';

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 60;

// Map<ip, timestamp[]>
const requestLog = new Map<string, number[]>();

function getClientIp(request: Request): string {
	// Trust X-Forwarded-For when behind a proxy (Docker / reverse proxy)
	const forwarded = request.headers.get('x-forwarded-for');
	if (forwarded) return forwarded.split(',')[0].trim();
	// Fall back to a sentinel — shouldn't reach here in practice
	return 'unknown';
}

function isRateLimited(ip: string): boolean {
	const now = Date.now();
	const cutoff = now - WINDOW_MS;

	let timestamps = requestLog.get(ip);
	if (!timestamps) {
		timestamps = [];
		requestLog.set(ip, timestamps);
	}

	// Drop timestamps outside the sliding window
	const recent = timestamps.filter((t) => t >= cutoff);
	recent.push(now);
	requestLog.set(ip, recent);

	return recent.length > MAX_REQUESTS;
}

export const handle: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;

	if (pathname.startsWith('/api/')) {
		const ip = getClientIp(event.request);
		if (isRateLimited(ip)) {
			return new Response(JSON.stringify({ error: 'rate_limit_exceeded', retry_after: 60 }), {
				status: 429,
				headers: {
					'Content-Type': 'application/json',
					'Retry-After': '60'
				}
			});
		}
	}

	return resolve(event);
};
