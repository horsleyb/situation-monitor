<script lang="ts">
	import { get } from 'svelte/store';
	import { configOverrides, DEFAULT_GDELT_QUERIES, DEFAULT_CORS_PROXIES, NEWS_CATEGORIES } from '$lib/stores/configOverrides';
	import { refresh, autoRefreshEnabled } from '$lib/stores';
	import type { FeedSource } from '$lib/config/feeds';
	import type { NewsCategory } from '$lib/types';

	type Tab = 'sources' | 'gdelt' | 'proxy' | 'refresh';
	let activeTab = $state<Tab>('sources');

	// ── Sources tab ──────────────────────────────────────────────────────────────
	let selectedCategory = $state<NewsCategory>('politics');
	let newFeedName = $state('');
	let newFeedUrl = $state('');
	let addingFeed = $state(false);

	function getCurrentFeeds(category: NewsCategory): FeedSource[] {
		return configOverrides.getEffectiveFeeds(category);
	}

	function addFeed() {
		if (!newFeedName.trim() || !newFeedUrl.trim()) return;
		const current = configOverrides.getEffectiveFeeds(selectedCategory);
		configOverrides.setFeeds(selectedCategory, [
			...current,
			{ name: newFeedName.trim(), url: newFeedUrl.trim() }
		]);
		newFeedName = '';
		newFeedUrl = '';
		addingFeed = false;
	}

	function removeFeed(category: NewsCategory, index: number) {
		const current = configOverrides.getEffectiveFeeds(category);
		const next = current.filter((_, i) => i !== index);
		configOverrides.setFeeds(category, next);
	}

	function resetFeeds(category: NewsCategory) {
		configOverrides.resetFeeds(category);
	}

	// ── GDELT tab ────────────────────────────────────────────────────────────────
	let gdeltDraft = $state<Record<NewsCategory, string>>({
		politics: configOverrides.getEffectiveGdeltQuery('politics'),
		tech: configOverrides.getEffectiveGdeltQuery('tech'),
		finance: configOverrides.getEffectiveGdeltQuery('finance'),
		gov: configOverrides.getEffectiveGdeltQuery('gov'),
		ai: configOverrides.getEffectiveGdeltQuery('ai'),
		intel: configOverrides.getEffectiveGdeltQuery('intel')
	});

	function saveGdeltQuery(category: NewsCategory) {
		configOverrides.setGdeltQuery(category, gdeltDraft[category]);
	}

	function resetGdeltQuery(category: NewsCategory) {
		configOverrides.resetGdeltQuery(category);
		gdeltDraft[category] = DEFAULT_GDELT_QUERIES[category];
	}

	// ── Proxy tab ────────────────────────────────────────────────────────────────
	let proxyDraft = $state({ ...configOverrides.getEffectiveCorsProxies() });

	function saveProxies() {
		configOverrides.setCorsProxies(proxyDraft);
	}

	function resetProxies() {
		proxyDraft = { ...DEFAULT_CORS_PROXIES };
		configOverrides.resetCorsProxies();
	}

	// ── Refresh tab ──────────────────────────────────────────────────────────────
	function getIntervalMinutes(): number {
		return Math.round(get(refresh).autoRefreshInterval / 60000);
	}

	let intervalMinutes = $state(getIntervalMinutes());

	function saveInterval() {
		refresh.setAutoRefreshInterval(intervalMinutes * 60000);
	}

	function toggleRefresh() {
		refresh.toggleAutoRefresh();
	}

	// ── Reset all ────────────────────────────────────────────────────────────────
	function resetAll() {
		configOverrides.resetAll();
		gdeltDraft = {
			politics: DEFAULT_GDELT_QUERIES.politics,
			tech: DEFAULT_GDELT_QUERIES.tech,
			finance: DEFAULT_GDELT_QUERIES.finance,
			gov: DEFAULT_GDELT_QUERIES.gov,
			ai: DEFAULT_GDELT_QUERIES.ai,
			intel: DEFAULT_GDELT_QUERIES.intel
		};
		proxyDraft = { ...DEFAULT_CORS_PROXIES };
	}

	const CATEGORY_LABELS: Record<NewsCategory, string> = {
		politics: 'Politics',
		tech: 'Technology',
		finance: 'Finance',
		gov: 'Government',
		ai: 'AI',
		intel: 'Intelligence'
	};
</script>

<div class="config-page">
	<header class="config-header">
		<a href="/" class="back-link">← Dashboard</a>
		<h1 class="config-title">Configuration</h1>
		<button class="btn btn-danger" onclick={resetAll}>Reset All Defaults</button>
	</header>

	<nav class="tab-nav">
		{#each ([['sources', 'Sources'], ['gdelt', 'GDELT Queries'], ['proxy', 'Proxy'], ['refresh', 'Refresh']] as const) as [id, label]}
			<button
				class="tab-btn"
				class:active={activeTab === id}
				onclick={() => (activeTab = id as Tab)}
			>
				{label}
			</button>
		{/each}
	</nav>

	<main class="tab-content">

		<!-- ── Sources ── -->
		{#if activeTab === 'sources'}
			<div class="section">
				<p class="section-desc">
					RSS feed sources listed per category. These define the reference sources — actual article
					fetching uses GDELT queries (see GDELT Queries tab).
				</p>

				<div class="category-tabs">
					{#each NEWS_CATEGORIES as cat}
						<button
							class="cat-btn"
							class:active={selectedCategory === cat}
							onclick={() => { selectedCategory = cat; addingFeed = false; newFeedName = ''; newFeedUrl = ''; }}
						>
							{CATEGORY_LABELS[cat]}
							{#if configOverrides.isFeedsOverridden(cat)}
								<span class="override-dot" title="Custom overrides active"></span>
							{/if}
						</button>
					{/each}
				</div>

				{#key selectedCategory}
					{@const feeds = getCurrentFeeds(selectedCategory)}
					<div class="feed-list">
						<div class="feed-list-header">
							<span class="col-name">Name</span>
							<span class="col-url">URL</span>
							<span class="col-action"></span>
						</div>
						{#each feeds as feed, i}
							<div class="feed-row">
								<span class="col-name feed-name">{feed.name}</span>
								<span class="col-url feed-url">{feed.url}</span>
								<button class="btn btn-sm btn-danger" onclick={() => removeFeed(selectedCategory, i)}>Remove</button>
							</div>
						{/each}
						{#if feeds.length === 0}
							<p class="empty-msg">No feeds configured.</p>
						{/if}
					</div>

					<div class="feed-actions">
						{#if addingFeed}
							<div class="add-feed-form">
								<input
									class="input"
									placeholder="Source name"
									bind:value={newFeedName}
									onkeydown={(e) => e.key === 'Enter' && addFeed()}
								/>
								<input
									class="input url-input"
									placeholder="https://example.com/rss.xml"
									bind:value={newFeedUrl}
									onkeydown={(e) => e.key === 'Enter' && addFeed()}
								/>
								<button class="btn btn-primary" onclick={addFeed}>Add</button>
								<button class="btn" onclick={() => { addingFeed = false; newFeedName = ''; newFeedUrl = ''; }}>Cancel</button>
							</div>
						{:else}
							<button class="btn btn-primary" onclick={() => (addingFeed = true)}>+ Add Feed</button>
						{/if}
						{#if configOverrides.isFeedsOverridden(selectedCategory)}
							<button class="btn" onclick={() => resetFeeds(selectedCategory)}>Reset to Defaults</button>
						{/if}
					</div>
				{/key}
			</div>

		<!-- ── GDELT Queries ── -->
		{:else if activeTab === 'gdelt'}
			<div class="section">
				<p class="section-desc">
					GDELT API query strings used to fetch news articles. GDELT supports OR/AND/NOT operators
					and quoted phrases. Changes take effect on the next refresh.
				</p>

				<div class="gdelt-grid">
					{#each NEWS_CATEGORIES as cat}
						<div class="gdelt-card">
							<div class="gdelt-card-header">
								<span class="gdelt-cat-label">{CATEGORY_LABELS[cat]}</span>
								{#if configOverrides.isGdeltQueryOverridden(cat)}
									<span class="override-badge">Custom</span>
								{:else}
									<span class="default-badge">Default</span>
								{/if}
							</div>
							<textarea
								class="query-textarea"
								rows={3}
								bind:value={gdeltDraft[cat]}
							></textarea>
							<div class="gdelt-card-actions">
								<button class="btn btn-sm btn-primary" onclick={() => saveGdeltQuery(cat)}>Save</button>
								{#if configOverrides.isGdeltQueryOverridden(cat)}
									<button class="btn btn-sm" onclick={() => resetGdeltQuery(cat)}>Reset</button>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>

		<!-- ── Proxy ── -->
		{:else if activeTab === 'proxy'}
			<div class="section">
				<p class="section-desc">
					CORS proxies used for all external API requests. The primary proxy is tried first; the
					fallback is used if it fails.
				</p>

				<div class="proxy-form">
					<label class="field-label" for="proxy-primary">Primary proxy</label>
					<input
						id="proxy-primary"
						class="input"
						bind:value={proxyDraft.primary}
						placeholder="https://your-worker.workers.dev/?url="
					/>

					<label class="field-label" for="proxy-fallback">Fallback proxy</label>
					<input
						id="proxy-fallback"
						class="input"
						bind:value={proxyDraft.fallback}
						placeholder="https://corsproxy.io/?url="
					/>

					<p class="hint">
						Both URLs should end with <code>?url=</code> (or similar) — the encoded target URL is
						appended directly.
					</p>

					<div class="proxy-actions">
						<button class="btn btn-primary" onclick={saveProxies}>Save</button>
						<button class="btn" onclick={resetProxies}>Reset to Defaults</button>
					</div>
				</div>
			</div>

		<!-- ── Refresh ── -->
		{:else if activeTab === 'refresh'}
			<div class="section">
				<p class="section-desc">
					Auto-refresh settings. Changes to the interval take effect immediately.
				</p>

				<div class="refresh-form">
					<div class="field-row">
						<label class="field-label" for="refresh-toggle">Auto-refresh enabled</label>
						<button
							id="refresh-toggle"
							class="toggle-btn"
							class:on={$autoRefreshEnabled}
							onclick={toggleRefresh}
							aria-pressed={$autoRefreshEnabled}
						>
							{$autoRefreshEnabled ? 'ON' : 'OFF'}
						</button>
					</div>

					<div class="field-row">
						<label class="field-label" for="refresh-interval">
							Refresh interval (minutes)
						</label>
						<div class="interval-row">
							<input
								id="refresh-interval"
								class="input interval-input"
								type="number"
								min={1}
								max={1440}
								bind:value={intervalMinutes}
							/>
							<button class="btn btn-primary" onclick={saveInterval}>Save</button>
						</div>
					</div>

					<div class="refresh-stage-info">
						<p class="hint">Refresh happens in 3 stages:</p>
						<ul class="stage-list">
							<li><strong>Critical</strong> (0 s delay) — news, markets, alerts</li>
							<li><strong>Secondary</strong> (2 s delay) — crypto, commodities, intel</li>
							<li><strong>Tertiary</strong> (4 s delay) — contracts, whales, layoffs, polymarket</li>
						</ul>
					</div>
				</div>
			</div>
		{/if}

	</main>
</div>

<style>
	.config-page {
		min-height: 100vh;
		background: var(--bg);
		color: var(--text-primary);
		display: flex;
		flex-direction: column;
	}

	.config-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.75rem 1.5rem;
		background: var(--surface);
		border-bottom: 1px solid var(--border);
		position: sticky;
		top: 0;
		z-index: 10;
	}

	.back-link {
		color: var(--text-muted);
		text-decoration: none;
		font-size: 0.8rem;
		flex-shrink: 0;
	}

	.back-link:hover {
		color: var(--text-primary);
	}

	.config-title {
		margin: 0;
		font-size: 0.9rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		flex: 1;
	}

	.tab-nav {
		display: flex;
		gap: 0;
		border-bottom: 1px solid var(--border);
		padding: 0 1.5rem;
		background: var(--surface);
	}

	.tab-btn {
		padding: 0.6rem 1.2rem;
		background: transparent;
		border: none;
		border-bottom: 2px solid transparent;
		color: var(--text-muted);
		cursor: pointer;
		font-size: 0.75rem;
		font-weight: 500;
		letter-spacing: 0.04em;
		transition: all 0.15s;
	}

	.tab-btn:hover {
		color: var(--text-primary);
	}

	.tab-btn.active {
		color: var(--accent);
		border-bottom-color: var(--accent);
	}

	.tab-content {
		flex: 1;
		padding: 1.5rem;
		max-width: 900px;
		width: 100%;
		margin: 0 auto;
	}

	.section {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.section-desc {
		font-size: 0.75rem;
		color: var(--text-muted);
		margin: 0;
		line-height: 1.5;
	}

	/* Category tabs */
	.category-tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.cat-btn {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.35rem 0.8rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 4px;
		color: var(--text-muted);
		cursor: pointer;
		font-size: 0.72rem;
		transition: all 0.15s;
	}

	.cat-btn:hover,
	.cat-btn.active {
		background: var(--border);
		color: var(--text-primary);
		border-color: var(--accent);
	}

	.override-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--accent);
		flex-shrink: 0;
	}

	/* Feed list */
	.feed-list {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 6px;
		overflow: hidden;
	}

	.feed-list-header,
	.feed-row {
		display: grid;
		grid-template-columns: 160px 1fr auto;
		gap: 0.75rem;
		align-items: center;
		padding: 0.5rem 0.75rem;
	}

	.feed-list-header {
		background: var(--border);
		font-size: 0.65rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		color: var(--text-muted);
	}

	.feed-row {
		border-top: 1px solid var(--border);
		font-size: 0.75rem;
	}

	.feed-name {
		color: var(--text-primary);
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.feed-url {
		color: var(--text-muted);
		font-size: 0.68rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.empty-msg {
		padding: 1rem;
		font-size: 0.75rem;
		color: var(--text-muted);
		text-align: center;
		margin: 0;
	}

	.feed-actions {
		display: flex;
		gap: 0.5rem;
		align-items: flex-start;
		flex-wrap: wrap;
	}

	.add-feed-form {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		flex-wrap: wrap;
		flex: 1;
	}

	.url-input {
		flex: 1;
		min-width: 200px;
	}

	/* GDELT grid */
	.gdelt-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 1rem;
	}

	.gdelt-card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.gdelt-card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.gdelt-cat-label {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.override-badge {
		font-size: 0.6rem;
		padding: 0.1rem 0.4rem;
		background: color-mix(in srgb, var(--accent) 20%, transparent);
		color: var(--accent);
		border-radius: 3px;
		font-weight: 600;
	}

	.default-badge {
		font-size: 0.6rem;
		padding: 0.1rem 0.4rem;
		background: var(--border);
		color: var(--text-muted);
		border-radius: 3px;
	}

	.query-textarea {
		width: 100%;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 4px;
		color: var(--text-primary);
		font-size: 0.72rem;
		font-family: monospace;
		padding: 0.4rem 0.5rem;
		resize: vertical;
		box-sizing: border-box;
	}

	.query-textarea:focus {
		outline: none;
		border-color: var(--accent);
	}

	.gdelt-card-actions {
		display: flex;
		gap: 0.4rem;
	}

	/* Proxy form */
	.proxy-form {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		max-width: 600px;
	}

	.proxy-actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	/* Refresh form */
	.refresh-form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		max-width: 500px;
	}

	.field-row {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.interval-row {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.interval-input {
		width: 80px;
		text-align: right;
	}

	.toggle-btn {
		padding: 0.3rem 0.8rem;
		border-radius: 4px;
		border: 1px solid var(--border);
		cursor: pointer;
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		background: var(--surface);
		color: var(--text-muted);
		transition: all 0.15s;
	}

	.toggle-btn.on {
		background: color-mix(in srgb, var(--accent) 20%, transparent);
		border-color: var(--accent);
		color: var(--accent);
	}

	.refresh-stage-info {
		padding: 0.75rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 6px;
	}

	.stage-list {
		margin: 0.4rem 0 0;
		padding-left: 1.2rem;
		font-size: 0.72rem;
		color: var(--text-muted);
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.stage-list strong {
		color: var(--text-primary);
	}

	/* Shared */
	.field-label {
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--text-secondary);
		min-width: 180px;
	}

	.input {
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 4px;
		color: var(--text-primary);
		font-size: 0.75rem;
		padding: 0.4rem 0.6rem;
		width: 100%;
		box-sizing: border-box;
	}

	.input:focus {
		outline: none;
		border-color: var(--accent);
	}

	.hint {
		font-size: 0.68rem;
		color: var(--text-muted);
		margin: 0;
		line-height: 1.5;
	}

	.hint code {
		font-family: monospace;
		background: var(--border);
		padding: 0.1rem 0.3rem;
		border-radius: 3px;
	}

	.btn {
		padding: 0.35rem 0.8rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 4px;
		color: var(--text-secondary);
		cursor: pointer;
		font-size: 0.72rem;
		transition: all 0.15s;
		white-space: nowrap;
	}

	.btn:hover {
		background: var(--border);
		color: var(--text-primary);
	}

	.btn-primary {
		background: var(--accent);
		border-color: var(--accent);
		color: #fff;
	}

	.btn-primary:hover {
		opacity: 0.85;
	}

	.btn-danger {
		color: var(--alert, #e53e3e);
		border-color: var(--alert, #e53e3e);
	}

	.btn-danger:hover {
		background: color-mix(in srgb, var(--alert, #e53e3e) 15%, transparent);
	}

	.btn-sm {
		padding: 0.2rem 0.55rem;
		font-size: 0.65rem;
	}
</style>
