/**
 * Keywords store - manages custom alert/region/topic keywords
 * Merges user-defined additions on top of hardcoded defaults
 */

import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import {
	ALERT_KEYWORDS,
	REGION_KEYWORDS,
	TOPIC_KEYWORDS
} from '$lib/config/keywords';

const STORAGE_KEY = 'situation-monitor-keywords';

export type KeywordCategory = 'alerts' | 'regions' | 'topics';

export interface RegionEntry {
	region: string;
	keywords: string[];
}

export interface TopicEntry {
	topic: string;
	keywords: string[];
}

export interface CustomKeywordsState {
	/** Extra alert keywords added by the user */
	alerts: string[];
	/** Extra keywords per region key */
	regions: Record<string, string[]>;
	/** Extra keywords per topic key */
	topics: Record<string, string[]>;
}

function emptyState(): CustomKeywordsState {
	return { alerts: [], regions: {}, topics: {} };
}

function loadFromStorage(): CustomKeywordsState {
	if (!browser) return emptyState();
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return emptyState();
		return JSON.parse(raw) as CustomKeywordsState;
	} catch {
		return emptyState();
	}
}

function saveToStorage(state: CustomKeywordsState): void {
	if (!browser) return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	} catch (e) {
		console.warn('Failed to save keywords to localStorage:', e);
	}
}

function createKeywordsStore() {
	const { subscribe, set, update } = writable<CustomKeywordsState>(loadFromStorage());

	return {
		subscribe,

		/** Add a keyword to a flat list (alerts) */
		addAlert(keyword: string) {
			const kw = keyword.trim().toLowerCase();
			if (!kw) return;
			update((state) => {
				// Don't add if already a default or already custom
				const defaults = ALERT_KEYWORDS as readonly string[];
				if (defaults.includes(kw) || state.alerts.includes(kw)) return state;
				const next = { ...state, alerts: [...state.alerts, kw] };
				saveToStorage(next);
				return next;
			});
		},

		removeAlert(keyword: string) {
			update((state) => {
				const next = { ...state, alerts: state.alerts.filter((k) => k !== keyword) };
				saveToStorage(next);
				return next;
			});
		},

		/** Add a keyword to a region sub-list */
		addRegionKeyword(region: string, keyword: string) {
			const kw = keyword.trim().toLowerCase();
			if (!kw) return;
			update((state) => {
				const existing = REGION_KEYWORDS[region] ?? [];
				const custom = state.regions[region] ?? [];
				if (existing.includes(kw) || custom.includes(kw)) return state;
				const next: CustomKeywordsState = {
					...state,
					regions: { ...state.regions, [region]: [...custom, kw] }
				};
				saveToStorage(next);
				return next;
			});
		},

		removeRegionKeyword(region: string, keyword: string) {
			update((state) => {
				const custom = state.regions[region] ?? [];
				const next: CustomKeywordsState = {
					...state,
					regions: { ...state.regions, [region]: custom.filter((k) => k !== keyword) }
				};
				saveToStorage(next);
				return next;
			});
		},

		/** Add a keyword to a topic sub-list */
		addTopicKeyword(topic: string, keyword: string) {
			const kw = keyword.trim().toLowerCase();
			if (!kw) return;
			update((state) => {
				const existing = TOPIC_KEYWORDS[topic] ?? [];
				const custom = state.topics[topic] ?? [];
				if (existing.includes(kw) || custom.includes(kw)) return state;
				const next: CustomKeywordsState = {
					...state,
					topics: { ...state.topics, [topic]: [...custom, kw] }
				};
				saveToStorage(next);
				return next;
			});
		},

		removeTopicKeyword(topic: string, keyword: string) {
			update((state) => {
				const custom = state.topics[topic] ?? [];
				const next: CustomKeywordsState = {
					...state,
					topics: { ...state.topics, [topic]: custom.filter((k) => k !== keyword) }
				};
				saveToStorage(next);
				return next;
			});
		},

		/** Wipe all custom keywords */
		resetToDefaults() {
			const next = emptyState();
			if (browser) localStorage.removeItem(STORAGE_KEY);
			set(next);
		},

		/** Convenience: get current state snapshot */
		snapshot(): CustomKeywordsState {
			return get({ subscribe });
		}
	};
}

export const customKeywords = createKeywordsStore();

// ---------------------------------------------------------------------------
// Match functions that include custom keywords
// ---------------------------------------------------------------------------

/**
 * Check if text contains any alert keyword (defaults + custom)
 */
export function containsAlertKeywordMerged(text: string): { isAlert: boolean; keyword?: string } {
	const lowerText = text.toLowerCase();
	const custom = get(customKeywords);
	const all = [...(ALERT_KEYWORDS as readonly string[]), ...custom.alerts];
	for (const keyword of all) {
		if (lowerText.includes(keyword)) {
			return { isAlert: true, keyword };
		}
	}
	return { isAlert: false };
}

/**
 * Detect region from text using defaults + custom keywords
 */
export function detectRegionMerged(text: string): string | null {
	const lowerText = text.toLowerCase();
	const custom = get(customKeywords);
	for (const [region, kws] of Object.entries(REGION_KEYWORDS)) {
		const merged = [...kws, ...(custom.regions[region] ?? [])];
		if (merged.some((k) => lowerText.includes(k))) {
			return region;
		}
	}
	return null;
}

/**
 * Detect topics from text using defaults + custom keywords
 */
export function detectTopicsMerged(text: string): string[] {
	const lowerText = text.toLowerCase();
	const custom = get(customKeywords);
	const detected: string[] = [];
	for (const [topic, kws] of Object.entries(TOPIC_KEYWORDS)) {
		const merged = [...kws, ...(custom.topics[topic] ?? [])];
		if (merged.some((k) => lowerText.includes(k))) {
			detected.push(topic);
		}
	}
	return detected;
}

// ---------------------------------------------------------------------------
// Derived merged lists (defaults + custom) — use these for matching
// ---------------------------------------------------------------------------

/** All alert keywords (defaults + custom) */
export const mergedAlertKeywords = derived(customKeywords, ($custom) => [
	...(ALERT_KEYWORDS as readonly string[]),
	...$custom.alerts
]);

/** All region keyword maps (defaults merged with custom) */
export const mergedRegionKeywords = derived(customKeywords, ($custom) => {
	const result: Record<string, string[]> = {};
	for (const [region, kws] of Object.entries(REGION_KEYWORDS)) {
		result[region] = [...kws, ...($custom.regions[region] ?? [])];
	}
	return result;
});

/** All topic keyword maps (defaults merged with custom) */
export const mergedTopicKeywords = derived(customKeywords, ($custom) => {
	const result: Record<string, string[]> = {};
	for (const [topic, kws] of Object.entries(TOPIC_KEYWORDS)) {
		result[topic] = [...kws, ...($custom.topics[topic] ?? [])];
	}
	return result;
});
