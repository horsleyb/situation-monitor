/**
 * Digest store — holds the generated daily situation brief.
 */

import { writable } from 'svelte/store';

export interface DigestTopSignal {
	headline: string;
	significance: 'HIGH' | 'MEDIUM' | 'LOW';
	detail: string;
}

export interface DigestSection {
	category: string;
	summary: string;
}

export interface DigestMarketContext {
	direction: 'RISK-ON' | 'RISK-OFF' | 'MIXED' | 'FLAT';
	notes: string[];
}

export interface DigestData {
	topSignal: DigestTopSignal;
	overnight: DigestSection[];
	marketContext: DigestMarketContext;
	watchToday: string[];
	noiseFilter: string[];
	generatedAt: number;
	model: string;
}

export interface DigestState {
	data: DigestData | null;
	loading: boolean;
	error: string | null;
}

export interface DigestPayload {
	headlines: string[];
	correlations: Array<{ name: string; level: string; sourceCount?: number; count?: number }>;
	markets: Array<{ symbol: string; name: string; changePercent: number }>;
}

function createDigestStore() {
	const { subscribe, update, set } = writable<DigestState>({
		data: null,
		loading: false,
		error: null
	});

	return {
		subscribe,

		async generate(payload: DigestPayload) {
			update((s) => ({ ...s, loading: true, error: null }));

			try {
				const res = await fetch('/api/digest', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				});

				if (!res.ok) {
					const msg = await res.text().catch(() => `HTTP ${res.status}`);
					throw new Error(msg);
				}

				const data = (await res.json()) as DigestData;
				update((s) => ({ ...s, data, loading: false, error: null }));
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				update((s) => ({ ...s, loading: false, error: msg }));
			}
		},

		clear() {
			set({ data: null, loading: false, error: null });
		}
	};
}

export const digest = createDigestStore();
