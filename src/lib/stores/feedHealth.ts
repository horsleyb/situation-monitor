/**
 * Feed health tracking store
 * Tracks per-feed health state fetched from /api/feed-health
 */

import { writable, derived } from 'svelte/store';

export interface FeedHealth {
	url: string;
	name: string;
	category: string;
	status: 'ok' | 'error' | 'unknown';
	lastChecked: Date | null;
	lastSuccess: Date | null;
	errorCount: number;
	lastError: string | null;
}

export interface FeedHealthState {
	feeds: FeedHealth[];
	loading: boolean;
	error: string | null;
	lastFetched: Date | null;
	summary: {
		total: number;
		ok: number;
		error: number;
		unknown: number;
	};
}

function createInitialState(): FeedHealthState {
	return {
		feeds: [],
		loading: false,
		error: null,
		lastFetched: null,
		summary: { total: 0, ok: 0, error: 0, unknown: 0 }
	};
}

function createFeedHealthStore() {
	const { subscribe, update, set } = writable<FeedHealthState>(createInitialState());

	// Track per-url error counts across fetches
	const errorCounts = new Map<string, number>();
	const lastSuccess = new Map<string, Date>();

	return {
		subscribe,

		setLoading(loading: boolean) {
			update((s) => ({ ...s, loading, error: loading ? null : s.error }));
		},

		setError(error: string) {
			update((s) => ({ ...s, loading: false, error }));
		},

		/**
		 * Called by updateFeedHealth() for individual feed status updates
		 * (used when hooking into existing fetch flows)
		 */
		updateFeed(url: string, name: string, category: string, status: 'ok' | 'error', errorMsg?: string) {
			update((s) => {
				const now = new Date();

				if (status === 'ok') {
					errorCounts.set(url, 0);
					lastSuccess.set(url, now);
				} else {
					errorCounts.set(url, (errorCounts.get(url) ?? 0) + 1);
				}

				const existing = s.feeds.find((f) => f.url === url);
				const updated: FeedHealth = {
					url,
					name: existing?.name ?? name,
					category: existing?.category ?? category,
					status,
					lastChecked: now,
					lastSuccess: status === 'ok' ? now : (lastSuccess.get(url) ?? existing?.lastSuccess ?? null),
					errorCount: errorCounts.get(url) ?? 0,
					lastError: status === 'error' ? (errorMsg ?? 'Unknown error') : null
				};

				const feeds = existing
					? s.feeds.map((f) => (f.url === url ? updated : f))
					: [...s.feeds, updated];

				const summary = computeSummary(feeds);
				return { ...s, feeds, summary, lastFetched: now };
			});
		},

		/**
		 * Load results from the /api/feed-health endpoint
		 */
		setFromApiResponse(
			apiFeeds: Array<{
				url: string;
				name: string;
				category: string;
				status: 'ok' | 'error';
				error: string | null;
				checkedAt: string;
			}>
		) {
			const now = new Date();
			const feeds: FeedHealth[] = apiFeeds.map((f) => {
				const checkedAt = new Date(f.checkedAt);

				if (f.status === 'ok') {
					errorCounts.set(f.url, 0);
					lastSuccess.set(f.url, checkedAt);
				} else {
					errorCounts.set(f.url, (errorCounts.get(f.url) ?? 0) + 1);
				}

				return {
					url: f.url,
					name: f.name,
					category: f.category,
					status: f.status,
					lastChecked: checkedAt,
					lastSuccess: f.status === 'ok' ? checkedAt : (lastSuccess.get(f.url) ?? null),
					errorCount: errorCounts.get(f.url) ?? 0,
					lastError: f.error
				};
			});

			const summary = computeSummary(feeds);
			update((s) => ({ ...s, feeds, summary, loading: false, error: null, lastFetched: now }));
		},

		reset() {
			errorCounts.clear();
			lastSuccess.clear();
			set(createInitialState());
		}
	};
}

function computeSummary(feeds: FeedHealth[]) {
	let ok = 0, error = 0, unknown = 0;
	for (const f of feeds) {
		if (f.status === 'ok') ok++;
		else if (f.status === 'error') error++;
		else unknown++;
	}
	return { total: feeds.length, ok, error, unknown };
}

export const feedHealthStore = createFeedHealthStore();

/**
 * Convenience function — update a single feed's health status.
 * Can be called from existing fetch flows (e.g. after an RSS fetch succeeds/fails).
 */
export function updateFeedHealth(url: string, status: 'ok' | 'error', error?: string): void {
	feedHealthStore.updateFeed(url, url, 'unknown', status, error);
}

// Derived: feeds sorted with errors first
export const feedHealthList = derived(feedHealthStore, ($s) => {
	const order = { error: 0, unknown: 1, ok: 2 };
	return [...$s.feeds].sort((a, b) => order[a.status] - order[b.status]);
});

export const feedHealthSummary = derived(feedHealthStore, ($s) => $s.summary);
