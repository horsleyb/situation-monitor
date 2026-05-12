/**
 * DGX settings store — persists the user's opt-in toggle for LLM analysis.
 */

import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

const STORAGE_KEY = 'situationMonitorDgxEnabled';

function loadDgxEnabled(): boolean {
	if (!browser) return false;
	try {
		return localStorage.getItem(STORAGE_KEY) === 'true';
	} catch {
		return false;
	}
}

function saveDgxEnabled(value: boolean): void {
	if (!browser) return;
	try {
		localStorage.setItem(STORAGE_KEY, String(value));
	} catch {
		// localStorage may be unavailable in some environments
	}
}

function createDgxStore() {
	const { subscribe, set, update } = writable<boolean>(loadDgxEnabled());

	return {
		subscribe,

		/** Enable DGX LLM analysis */
		enable() {
			saveDgxEnabled(true);
			set(true);
		},

		/** Disable DGX LLM analysis */
		disable() {
			saveDgxEnabled(false);
			set(false);
		},

		/** Toggle DGX LLM analysis */
		toggle() {
			update((current) => {
				const next = !current;
				saveDgxEnabled(next);
				return next;
			});
		},

		/** Current value (synchronous read) */
		get value(): boolean {
			return get({ subscribe });
		}
	};
}

/** Whether the user has opted into DGX LLM-enhanced analysis. Default: false. */
export const dgxEnabled = createDgxStore();
