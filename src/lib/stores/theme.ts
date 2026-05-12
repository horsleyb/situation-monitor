/**
 * Theme store - dark/light mode toggle with localStorage persistence
 */

import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'situationMonitorTheme';

function getInitialTheme(): Theme {
	if (!browser) return 'dark';
	const saved = localStorage.getItem(STORAGE_KEY);
	if (saved === 'light' || saved === 'dark') return saved;
	return 'dark';
}

function createThemeStore() {
	const { subscribe, set, update } = writable<Theme>(getInitialTheme());

	function applyTheme(theme: Theme) {
		if (!browser) return;
		const html = document.documentElement;
		if (theme === 'light') {
			html.classList.add('light');
			html.classList.remove('dark');
		} else {
			html.classList.add('dark');
			html.classList.remove('light');
		}
	}

	// Sync class on every change
	subscribe((theme) => {
		applyTheme(theme);
		if (browser) {
			try {
				localStorage.setItem(STORAGE_KEY, theme);
			} catch {
				// ignore storage errors
			}
		}
	});

	return {
		subscribe,
		toggle() {
			update((t) => (t === 'dark' ? 'light' : 'dark'));
		},
		set(theme: Theme) {
			set(theme);
		}
	};
}

export const theme = createThemeStore();

export function toggleTheme() {
	theme.toggle();
}
