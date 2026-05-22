/**
 * Config overrides store - runtime overrides for feeds, GDELT queries, and proxy URLs.
 * Layered over code defaults; persisted to localStorage.
 */

import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import { FEEDS, type FeedSource } from '$lib/config/feeds';
import type { NewsCategory } from '$lib/types';

const STORAGE_KEY = 'situationMonitorConfigOverrides';

export const NEWS_CATEGORIES: NewsCategory[] = ['politics', 'tech', 'finance', 'gov', 'ai', 'intel'];

export const DEFAULT_GDELT_QUERIES: Record<NewsCategory, string> = {
	politics: '(politics OR government OR election OR congress)',
	tech: '(technology OR software OR startup OR "silicon valley")',
	finance: '(finance OR "stock market" OR economy OR banking)',
	gov: '("federal government" OR "white house" OR congress OR regulation)',
	ai: '("artificial intelligence" OR "machine learning" OR AI OR ChatGPT)',
	intel: '(intelligence OR security OR military OR defense)'
};

export const DEFAULT_CORS_PROXIES = {
	primary: 'https://situation-monitor-proxy.seanthielen-e.workers.dev/?url=',
	fallback: 'https://corsproxy.io/?url='
};

export interface ConfigOverridesState {
	feedOverrides: Partial<Record<NewsCategory, FeedSource[]>>;
	gdeltQueries: Partial<Record<NewsCategory, string>>;
	corsProxies: {
		primary: string;
		fallback: string;
	};
}

function load(): ConfigOverridesState {
	const defaults: ConfigOverridesState = {
		feedOverrides: {},
		gdeltQueries: {},
		corsProxies: { ...DEFAULT_CORS_PROXIES }
	};

	if (!browser) return defaults;

	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return defaults;
		const parsed = JSON.parse(raw);
		return {
			feedOverrides: parsed.feedOverrides ?? {},
			gdeltQueries: parsed.gdeltQueries ?? {},
			corsProxies: { ...DEFAULT_CORS_PROXIES, ...parsed.corsProxies }
		};
	} catch {
		return defaults;
	}
}

function save(state: ConfigOverridesState): void {
	if (!browser) return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	} catch {
		// quota exceeded etc — silently ignore
	}
}

function createStore() {
	const { subscribe, set, update } = writable<ConfigOverridesState>(load());

	function persist(fn: (s: ConfigOverridesState) => ConfigOverridesState) {
		update((s) => {
			const next = fn(s);
			save(next);
			return next;
		});
	}

	return {
		subscribe,

		// --- Feed overrides ---
		getEffectiveFeeds(category: NewsCategory): FeedSource[] {
			const s = get({ subscribe });
			return s.feedOverrides[category] ?? FEEDS[category] ?? [];
		},

		setFeeds(category: NewsCategory, feeds: FeedSource[]) {
			persist((s) => ({
				...s,
				feedOverrides: { ...s.feedOverrides, [category]: feeds }
			}));
		},

		resetFeeds(category: NewsCategory) {
			persist((s) => {
				const overrides = { ...s.feedOverrides };
				delete overrides[category];
				return { ...s, feedOverrides: overrides };
			});
		},

		isFeedsOverridden(category: NewsCategory): boolean {
			return category in get({ subscribe }).feedOverrides;
		},

		// --- GDELT query overrides ---
		getEffectiveGdeltQuery(category: NewsCategory): string {
			const s = get({ subscribe });
			return s.gdeltQueries[category] ?? DEFAULT_GDELT_QUERIES[category];
		},

		setGdeltQuery(category: NewsCategory, query: string) {
			persist((s) => ({
				...s,
				gdeltQueries: { ...s.gdeltQueries, [category]: query }
			}));
		},

		resetGdeltQuery(category: NewsCategory) {
			persist((s) => {
				const queries = { ...s.gdeltQueries };
				delete queries[category];
				return { ...s, gdeltQueries: queries };
			});
		},

		isGdeltQueryOverridden(category: NewsCategory): boolean {
			return category in get({ subscribe }).gdeltQueries;
		},

		// --- Proxy overrides ---
		getEffectiveCorsProxies(): { primary: string; fallback: string } {
			return get({ subscribe }).corsProxies;
		},

		setCorsProxies(proxies: { primary: string; fallback: string }) {
			persist((s) => ({ ...s, corsProxies: proxies }));
		},

		resetCorsProxies() {
			persist((s) => ({ ...s, corsProxies: { ...DEFAULT_CORS_PROXIES } }));
		},

		// --- Reset all ---
		resetAll() {
			const fresh: ConfigOverridesState = {
				feedOverrides: {},
				gdeltQueries: {},
				corsProxies: { ...DEFAULT_CORS_PROXIES }
			};
			save(fresh);
			set(fresh);
		}
	};
}

export const configOverrides = createStore();
