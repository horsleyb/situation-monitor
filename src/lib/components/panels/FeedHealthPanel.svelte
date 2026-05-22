<script lang="ts">
	import { Panel } from '$lib/components/common';
	import { feedHealthStore, feedHealthList, feedHealthSummary } from '$lib/stores/feedHealth';

	interface Props {
		loading?: boolean;
		error?: string | null;
	}

	let { loading = false, error = null }: Props = $props();

	const feeds = $derived($feedHealthList);
	const summary = $derived($feedHealthSummary);
	const lastFetched = $derived($feedHealthStore.lastFetched);

	// Only show feeds that are not ok (unknown or error)
	const unhealthyFeeds = $derived(feeds.filter((f) => f.status !== 'ok'));

	// Status label for the panel header
	const statusLabel = $derived(() => {
		if (summary.total === 0) return '';
		return `${summary.ok}/${summary.total}`;
	});

	const statusClass = $derived(() => {
		if (summary.total === 0) return '';
		const ratio = summary.ok / summary.total;
		if (ratio === 1) return 'ok';
		if (ratio >= 0.7) return 'warn';
		return 'critical';
	});

	function formatTime(date: Date | null): string {
		if (!date) return 'never';
		const now = Date.now();
		const diffMs = now - date.getTime();
		const diffMin = Math.floor(diffMs / 60000);
		if (diffMin < 1) return 'just now';
		if (diffMin < 60) return `${diffMin}m ago`;
		const diffHr = Math.floor(diffMin / 60);
		return `${diffHr}h ago`;
	}

	function truncate(str: string, max: number): string {
		return str.length > max ? str.slice(0, max) + '…' : str;
	}
</script>

<Panel
	id="feed-health"
	title="Feed Health"
	count={summary.total > 0 ? statusLabel() : null}
	status={summary.total > 0 ? (summary.error === 0 ? 'All OK' : `${summary.error} down`) : ''}
	statusClass={statusClass()}
	{loading}
	{error}
>
	{#if summary.total === 0 && !loading && !error}
		<div class="empty-state">No feed health data — trigger a check first</div>
	{:else}
		<div class="health-summary">
			<span class="badge ok">{summary.ok} ok</span>
			{#if summary.error > 0}
				<span class="badge error">{summary.error} error</span>
			{/if}
			{#if summary.unknown > 0}
				<span class="badge unknown">{summary.unknown} unknown</span>
			{/if}
			{#if lastFetched}
				<span class="last-checked">checked {formatTime(lastFetched)}</span>
			{/if}
		</div>

		{#if unhealthyFeeds.length === 0 && summary.total > 0}
			<div class="all-healthy">All {summary.total} feeds healthy</div>
		{:else if unhealthyFeeds.length > 0}
			<div class="feed-list">
				{#each unhealthyFeeds as feed (feed.url)}
					<div class="feed-item" class:is-error={feed.status === 'error'} class:is-unknown={feed.status === 'unknown'}>
						<div class="feed-header">
							<span class="feed-status-dot status-{feed.status}"></span>
							<span class="feed-name">{feed.name}</span>
							<span class="feed-category">{feed.category}</span>
						</div>
						{#if feed.lastError}
							<div class="feed-error">{truncate(feed.lastError, 60)}</div>
						{/if}
						{#if feed.errorCount > 1}
							<div class="feed-meta">{feed.errorCount} consecutive errors</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</Panel>

<style>
	.empty-state {
		text-align: center;
		color: var(--text-secondary);
		font-size: 0.7rem;
		padding: 1rem;
	}

	.health-summary {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.4rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--border);
		margin-bottom: 0.5rem;
	}

	.badge {
		font-size: 0.6rem;
		font-weight: 600;
		padding: 0.1rem 0.4rem;
		border-radius: 3px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.badge.ok {
		color: var(--success);
		background: rgba(var(--success-rgb, 0, 200, 100), 0.12);
	}

	.badge.error {
		color: var(--danger);
		background: rgba(var(--danger-rgb, 255, 68, 68), 0.12);
	}

	.badge.unknown {
		color: var(--text-muted);
		background: rgba(255, 255, 255, 0.06);
	}

	.last-checked {
		margin-left: auto;
		font-size: 0.55rem;
		color: var(--text-muted);
	}

	.all-healthy {
		text-align: center;
		color: var(--success);
		font-size: 0.7rem;
		padding: 0.75rem;
	}

	.feed-list {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.feed-item {
		padding: 0.35rem 0.4rem;
		border-radius: 3px;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid var(--border);
	}

	.feed-item.is-error {
		border-color: rgba(255, 68, 68, 0.25);
		background: rgba(255, 68, 68, 0.04);
	}

	.feed-header {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.feed-status-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.feed-status-dot.status-ok {
		background: var(--success);
	}

	.feed-status-dot.status-error {
		background: var(--danger);
	}

	.feed-status-dot.status-unknown {
		background: var(--text-muted);
	}

	.feed-name {
		font-size: 0.65rem;
		color: var(--text-primary);
		font-weight: 500;
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.feed-category {
		font-size: 0.55rem;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		flex-shrink: 0;
	}

	.feed-error {
		font-size: 0.6rem;
		color: var(--danger);
		margin-top: 0.15rem;
		padding-left: 1rem;
		opacity: 0.85;
	}

	.feed-meta {
		font-size: 0.55rem;
		color: var(--text-muted);
		margin-top: 0.1rem;
		padding-left: 1rem;
	}

	/* Panel status classes (used by Panel component via statusClass prop) */
	:global(.panel-status.ok) {
		color: var(--success);
		background: rgba(var(--success-rgb, 0, 200, 100), 0.12);
	}

	:global(.panel-status.warn) {
		color: #ffa500;
		background: rgba(255, 165, 0, 0.12);
	}

	:global(.panel-status.critical) {
		color: var(--danger);
		background: rgba(var(--danger-rgb, 255, 68, 68), 0.12);
	}
</style>
