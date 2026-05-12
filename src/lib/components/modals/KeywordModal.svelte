<script lang="ts">
	import Modal from './Modal.svelte';
	import { customKeywords } from '$lib/stores';
	import { ALERT_KEYWORDS, REGION_KEYWORDS, TOPIC_KEYWORDS } from '$lib/config/keywords';

	interface Props {
		open: boolean;
		onClose: () => void;
	}

	let { open = false, onClose }: Props = $props();

	// Tab state
	type Tab = 'alerts' | 'regions' | 'topics';
	let activeTab = $state<Tab>('alerts');

	// Input state per tab
	let alertInput = $state('');
	// For region/topic tabs we need a selected sub-key and an input
	let regionKey = $state(Object.keys(REGION_KEYWORDS)[0]);
	let regionInput = $state('');
	let topicKey = $state(Object.keys(TOPIC_KEYWORDS)[0]);
	let topicInput = $state('');

	const defaultAlerts = ALERT_KEYWORDS as readonly string[];
	const regionKeys = Object.keys(REGION_KEYWORDS);
	const topicKeys = Object.keys(TOPIC_KEYWORDS);

	// Add handlers
	function addAlert() {
		const kw = alertInput.trim().toLowerCase();
		if (!kw) return;
		customKeywords.addAlert(kw);
		alertInput = '';
	}

	function addRegion() {
		const kw = regionInput.trim().toLowerCase();
		if (!kw) return;
		customKeywords.addRegionKeyword(regionKey, kw);
		regionInput = '';
	}

	function addTopic() {
		const kw = topicInput.trim().toLowerCase();
		if (!kw) return;
		customKeywords.addTopicKeyword(topicKey, kw);
		topicInput = '';
	}

	function handleKeydown(e: KeyboardEvent, addFn: () => void) {
		if (e.key === 'Enter') {
			e.preventDefault();
			addFn();
		}
	}
</script>

<Modal {open} title="Alert Keywords" {onClose}>
	<div class="kw-modal">
		<!-- Tab bar -->
		<div class="tab-bar">
			{#each (['alerts', 'regions', 'topics'] as Tab[]) as tab}
				<button
					class="tab-btn"
					class:active={activeTab === tab}
					onclick={() => (activeTab = tab)}
				>
					{tab.charAt(0).toUpperCase() + tab.slice(1)}
				</button>
			{/each}
		</div>

		<!-- ALERTS tab -->
		{#if activeTab === 'alerts'}
			<div class="tab-content">
				<p class="tab-desc">Keywords that flag a news item as an alert. Defaults cannot be removed.</p>

				<div class="keyword-list">
					{#each defaultAlerts as kw}
						<span class="kw-tag default">{kw}</span>
					{/each}
					{#each $customKeywords.alerts as kw}
						<span class="kw-tag custom">
							{kw}
							<button
								class="kw-remove"
								onclick={() => customKeywords.removeAlert(kw)}
								aria-label="Remove {kw}"
							>×</button>
						</span>
					{/each}
				</div>

				<div class="add-row">
					<input
						type="text"
						class="kw-input"
						placeholder="Add keyword…"
						bind:value={alertInput}
						onkeydown={(e) => handleKeydown(e, addAlert)}
					/>
					<button class="add-btn" onclick={addAlert}>Add</button>
				</div>
			</div>
		{/if}

		<!-- REGIONS tab -->
		{#if activeTab === 'regions'}
			<div class="tab-content">
				<p class="tab-desc">Keywords used to tag news items with a geopolitical region.</p>

				<div class="sub-selector">
					<label for="region-select" class="sub-label">Region</label>
					<select id="region-select" class="sub-select" bind:value={regionKey}>
						{#each regionKeys as rk}
							<option value={rk}>{rk}</option>
						{/each}
					</select>
				</div>

				<div class="keyword-list">
					{#each (REGION_KEYWORDS[regionKey] ?? []) as kw}
						<span class="kw-tag default">{kw}</span>
					{/each}
					{#each ($customKeywords.regions[regionKey] ?? []) as kw}
						<span class="kw-tag custom">
							{kw}
							<button
								class="kw-remove"
								onclick={() => customKeywords.removeRegionKeyword(regionKey, kw)}
								aria-label="Remove {kw}"
							>×</button>
						</span>
					{/each}
				</div>

				<div class="add-row">
					<input
						type="text"
						class="kw-input"
						placeholder="Add keyword…"
						bind:value={regionInput}
						onkeydown={(e) => handleKeydown(e, addRegion)}
					/>
					<button class="add-btn" onclick={addRegion}>Add</button>
				</div>
			</div>
		{/if}

		<!-- TOPICS tab -->
		{#if activeTab === 'topics'}
			<div class="tab-content">
				<p class="tab-desc">Keywords used to tag news items with an intelligence topic.</p>

				<div class="sub-selector">
					<label for="topic-select" class="sub-label">Topic</label>
					<select id="topic-select" class="sub-select" bind:value={topicKey}>
						{#each topicKeys as tk}
							<option value={tk}>{tk}</option>
						{/each}
					</select>
				</div>

				<div class="keyword-list">
					{#each (TOPIC_KEYWORDS[topicKey] ?? []) as kw}
						<span class="kw-tag default">{kw}</span>
					{/each}
					{#each ($customKeywords.topics[topicKey] ?? []) as kw}
						<span class="kw-tag custom">
							{kw}
							<button
								class="kw-remove"
								onclick={() => customKeywords.removeTopicKeyword(topicKey, kw)}
								aria-label="Remove {kw}"
							>×</button>
						</span>
					{/each}
				</div>

				<div class="add-row">
					<input
						type="text"
						class="kw-input"
						placeholder="Add keyword…"
						bind:value={topicInput}
						onkeydown={(e) => handleKeydown(e, addTopic)}
					/>
					<button class="add-btn" onclick={addTopic}>Add</button>
				</div>
			</div>
		{/if}

		<!-- Footer -->
		<div class="modal-footer-inner">
			<button class="reset-btn" onclick={() => customKeywords.resetToDefaults()}>
				Reset to Defaults
			</button>
		</div>
	</div>
</Modal>

<style>
	.kw-modal {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	/* Tab bar */
	.tab-bar {
		display: flex;
		gap: 0.25rem;
		border-bottom: 1px solid var(--border);
		padding-bottom: 0.5rem;
	}

	.tab-btn {
		padding: 0.3rem 0.75rem;
		background: transparent;
		border: 1px solid transparent;
		border-radius: 4px;
		color: var(--text-secondary);
		font-size: 0.7rem;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.tab-btn:hover {
		background: rgba(255, 255, 255, 0.05);
		color: var(--text-primary);
	}

	.tab-btn.active {
		background: rgba(var(--accent-rgb), 0.1);
		border-color: var(--accent);
		color: var(--accent);
	}

	/* Tab content */
	.tab-content {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.tab-desc {
		font-size: 0.62rem;
		color: var(--text-muted);
		margin: 0;
	}

	/* Sub-selector (region / topic picker) */
	.sub-selector {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.sub-label {
		font-size: 0.65rem;
		color: var(--text-secondary);
		white-space: nowrap;
	}

	.sub-select {
		flex: 1;
		padding: 0.3rem 0.5rem;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 4px;
		color: var(--text-primary);
		font-size: 0.7rem;
	}

	.sub-select:focus {
		outline: none;
		border-color: var(--accent);
	}

	/* Keyword chips */
	.keyword-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		min-height: 2rem;
		padding: 0.4rem;
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid var(--border);
		border-radius: 4px;
		max-height: 160px;
		overflow-y: auto;
	}

	.kw-tag {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		padding: 0.15rem 0.4rem;
		border-radius: 3px;
		font-size: 0.62rem;
		white-space: nowrap;
	}

	.kw-tag.default {
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid var(--border);
		color: var(--text-secondary);
	}

	.kw-tag.custom {
		background: rgba(var(--accent-rgb), 0.12);
		border: 1px solid rgba(var(--accent-rgb), 0.35);
		color: var(--accent);
	}

	.kw-remove {
		background: none;
		border: none;
		color: inherit;
		font-size: 0.85rem;
		line-height: 1;
		cursor: pointer;
		padding: 0;
		opacity: 0.7;
		transition: opacity 0.1s;
	}

	.kw-remove:hover {
		opacity: 1;
	}

	/* Add row */
	.add-row {
		display: flex;
		gap: 0.4rem;
	}

	.kw-input {
		flex: 1;
		padding: 0.4rem 0.5rem;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 4px;
		color: var(--text-primary);
		font-size: 0.7rem;
	}

	.kw-input:focus {
		outline: none;
		border-color: var(--accent);
	}

	.add-btn {
		padding: 0.4rem 0.8rem;
		background: rgba(var(--accent-rgb), 0.15);
		border: 1px solid rgba(var(--accent-rgb), 0.4);
		border-radius: 4px;
		color: var(--accent);
		font-size: 0.7rem;
		cursor: pointer;
		transition: all 0.15s ease;
		white-space: nowrap;
	}

	.add-btn:hover {
		background: rgba(var(--accent-rgb), 0.25);
	}

	/* Footer */
	.modal-footer-inner {
		display: flex;
		justify-content: flex-start;
		padding-top: 0.5rem;
		border-top: 1px solid var(--border);
	}

	.reset-btn {
		padding: 0.4rem 0.8rem;
		background: rgba(255, 68, 68, 0.08);
		border: 1px solid rgba(255, 68, 68, 0.3);
		border-radius: 4px;
		color: var(--danger);
		font-size: 0.65rem;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.reset-btn:hover {
		background: rgba(255, 68, 68, 0.18);
	}
</style>
