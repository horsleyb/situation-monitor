<script lang="ts">
	import { isRefreshing, lastRefresh, theme, toggleTheme } from '$lib/stores';

	interface Props {
		onSettingsClick?: () => void;
		onKeywordsClick?: () => void;
	}

	let { onSettingsClick, onKeywordsClick }: Props = $props();

	const lastRefreshText = $derived(
		$lastRefresh
			? `Last updated: ${new Date($lastRefresh).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
			: 'Never refreshed'
	);

	const themeLabel = $derived($theme === 'dark' ? 'Light mode' : 'Dark mode');
	const themeIcon = $derived($theme === 'dark' ? '☀' : '☽');
</script>

<header class="header">
	<div class="header-left">
		<h1 class="logo">SITUATION MONITOR</h1>
	</div>

	<div class="header-center">
		<div class="refresh-status">
			{#if $isRefreshing}
				<span class="status-text loading">Refreshing...</span>
			{:else}
				<span class="status-text">{lastRefreshText}</span>
			{/if}
		</div>
	</div>

	<div class="header-right">
		<div class="ecosystem">
			<span class="eco-label">Ecosystem</span>
			<a href="http://taskmaster.home" target="_blank" rel="noopener noreferrer" class="eco-link eco-purple">Taskmaster ↗</a>
			<a href="http://synapse.home" target="_blank" rel="noopener noreferrer" class="eco-link eco-blue">Synapse ↗</a>
			<a href="http://ai-corp.home" target="_blank" rel="noopener noreferrer" class="eco-link eco-green">AI-Corp ↗</a>
		</div>
		<div class="eco-sep"></div>
		<button class="header-btn theme-btn" onclick={toggleTheme} title={themeLabel} aria-label={themeLabel}>
			<span class="btn-icon">{themeIcon}</span>
			<span class="btn-label">{themeLabel}</span>
		</button>
		<button class="header-btn" onclick={onKeywordsClick} title="Manage Keywords">
			<span class="btn-icon">🔑</span>
			<span class="btn-label">Keywords</span>
		</button>
		<a href="/config" class="header-btn" title="Configuration">
			<span class="btn-icon">⚙</span>
			<span class="btn-label">Config</span>
		</a>
		<button class="header-btn settings-btn" onclick={onSettingsClick} title="Settings">
			<span class="btn-icon">☰</span>
			<span class="btn-label">Settings</span>
		</button>
	</div>
</header>

<style>
	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 1rem;
		background: var(--surface);
		border-bottom: 1px solid var(--border);
		position: sticky;
		top: 0;
		z-index: 100;
		gap: 1rem;
	}

	.header-left {
		display: flex;
		align-items: baseline;
		flex-shrink: 0;
	}

	.logo {
		font-size: 0.9rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		color: var(--text-primary);
		margin: 0;
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}

	.header-center {
		display: flex;
		align-items: center;
		flex: 1;
		justify-content: center;
		min-width: 0;
	}

	.refresh-status {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.status-text {
		font-size: 0.6rem;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.status-text.loading {
		color: var(--accent);
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.header-btn {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		min-height: 2.75rem;
		padding: 0.4rem 0.75rem;
		background: transparent;
		border: 1px solid var(--border);
		border-radius: 4px;
		color: var(--text-secondary);
		cursor: pointer;
		transition: all 0.15s ease;
		font-size: 0.65rem;
		text-decoration: none;
	}

	.header-btn:hover {
		background: var(--border);
		color: var(--text-primary);
	}

	.btn-icon {
		font-size: 0.8rem;
	}

	.btn-label {
		display: none;
	}

	@media (min-width: 768px) {
		.btn-label {
			display: inline;
		}
	}

	.ecosystem {
		display: none;
		align-items: center;
		gap: 0.5rem;
	}

	@media (min-width: 900px) {
		.ecosystem {
			display: flex;
		}
	}

	.eco-label {
		font-size: 0.55rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.eco-link {
		font-size: 0.6rem;
		text-decoration: none;
		transition: opacity 0.15s;
		opacity: 0.75;
	}

	.eco-link:hover {
		opacity: 1;
	}

	.eco-purple { color: #c084fc; }
	.eco-blue   { color: #60a5fa; }
	.eco-green  { color: #34d399; }

	.eco-sep {
		width: 1px;
		height: 1.25rem;
		background: var(--border);
		display: none;
	}

	@media (min-width: 900px) {
		.eco-sep {
			display: block;
		}
	}
</style>
