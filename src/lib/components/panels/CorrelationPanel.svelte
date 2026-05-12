<script lang="ts">
	import { Panel, Badge } from '$lib/components/common';
	import { analyzeCorrelations } from '$lib/analysis/correlation';
	import { mergeLlmAnalysis } from '$lib/analysis/dgxMerge';
	import { dgxEnabled } from '$lib/stores/dgx';
	import type { NewsItem } from '$lib/types';
	import type { LlmAnalysis } from '$lib/services/dgxService';
	import type { CorrelationResults } from '$lib/analysis/correlation';

	interface Props {
		news?: NewsItem[];
		loading?: boolean;
		error?: string | null;
	}

	let { news = [], loading = false, error = null }: Props = $props();

	// LLM state
	let llmAnalysis = $state<LlmAnalysis | null>(null);
	let llmLoading = $state(false);
	let llmError = $state<string | null>(null);

	// Regex-only analysis (synchronous, always runs)
	const regexAnalysis = $derived(analyzeCorrelations(news));

	// Combined analysis — merges LLM clusters on top of regex results
	const analysis = $derived((): CorrelationResults | null => {
		if (!regexAnalysis) return null;
		// Clone so we don't mutate the regex result directly
		const merged: CorrelationResults = {
			emergingPatterns: [...regexAnalysis.emergingPatterns],
			momentumSignals: [...regexAnalysis.momentumSignals],
			crossSourceCorrelations: [...regexAnalysis.crossSourceCorrelations],
			predictiveSignals: [...regexAnalysis.predictiveSignals]
		};
		mergeLlmAnalysis(merged, llmAnalysis, news);
		return merged;
	});

	// Trigger LLM analysis when news changes and DGX is enabled
	$effect(() => {
		if (!$dgxEnabled || news.length === 0) {
			llmAnalysis = null;
			llmError = null;
			return;
		}

		const headlines = news.slice(0, 60).map((n) => n.title);
		llmLoading = true;
		llmError = null;

		fetch('/api/dgx', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ headlines })
		})
			.then(async (res) => {
				if (!res.ok) {
					const msg = await res.text().catch(() => String(res.status));
					throw new Error(msg);
				}
				return res.json() as Promise<LlmAnalysis>;
			})
			.then((result) => {
				llmAnalysis = result;
			})
			.catch((err: unknown) => {
				console.warn('[DGX] Analysis failed:', err instanceof Error ? err.message : String(err));
				llmError = 'DGX unavailable — using pattern analysis only';
				llmAnalysis = null;
			})
			.finally(() => {
				llmLoading = false;
			});
	});

	function getLevelVariant(level: string): 'default' | 'warning' | 'danger' | 'success' | 'info' {
		switch (level) {
			case 'high':
				return 'danger';
			case 'elevated':
				return 'warning';
			case 'surging':
				return 'danger';
			case 'rising':
				return 'warning';
			default:
				return 'default';
		}
	}

	function getMomentumClass(momentum: string): string {
		switch (momentum) {
			case 'surging':
				return 'signal-strong';
			case 'rising':
				return 'signal-medium';
			default:
				return 'signal-weak';
		}
	}

	function getDirectionArrow(delta: number): string {
		if (delta > 0) return '↑';
		if (delta < 0) return '↓';
		return '→';
	}
</script>

<Panel id="correlation" title="Pattern Analysis" {loading} {error}>
	{#if news.length === 0 && !loading && !error}
		<div class="empty-state">Insufficient data for analysis</div>
	{:else if analysis()}
		{@const a = analysis()!}
		<div class="correlation-content">
			{#if $dgxEnabled}
				<div class="llm-status" class:llm-loading={llmLoading} class:llm-error={!!llmError && !llmLoading}>
					{#if llmLoading}
						<span class="llm-badge">DGX</span> Analyzing with Qwen2.5-72B…
					{:else if llmError}
						<span class="llm-badge llm-badge--warn">DGX</span> {llmError}
					{:else if llmAnalysis}
						<span class="llm-badge llm-badge--ok">DGX</span>
						LLM enhanced · {llmAnalysis.clusters.length} cluster{llmAnalysis.clusters.length !== 1 ? 's' : ''}
					{:else}
						<span class="llm-badge">DGX</span> Waiting for data…
					{/if}
				</div>
			{/if}

			{#if a.emergingPatterns.length > 0}
				<div class="section">
					<div class="section-title">Emerging Patterns</div>
					{#each a.emergingPatterns.slice(0, 3) as pattern}
						<div class="pattern-item">
							<div class="pattern-header">
								<span class="pattern-topic">{pattern.name}</span>
								<Badge
									text={pattern.level.toUpperCase()}
									variant={getLevelVariant(pattern.level)}
								/>
							</div>
							<div class="pattern-sources">
								{pattern.sources.slice(0, 3).join(' · ')} ({pattern.count} items)
							</div>
						</div>
					{/each}
				</div>
			{/if}

			{#if a.momentumSignals.length > 0}
				<div class="section">
					<div class="section-title">Momentum Signals</div>
					{#each a.momentumSignals.slice(0, 3) as signal}
						<div class="signal-item {getMomentumClass(signal.momentum)}">
							<span class="signal-topic">{signal.name}</span>
							<span
								class="signal-direction"
								class:up={signal.delta > 0}
								class:down={signal.delta < 0}
							>
								{getDirectionArrow(signal.delta)}
								{signal.current}
							</span>
						</div>
					{/each}
				</div>
			{/if}

			{#if a.crossSourceCorrelations.length > 0}
				<div class="section">
					<div class="section-title">Cross-Source Links</div>
					{#each a.crossSourceCorrelations.slice(0, 3) as corr}
						<div class="correlation-item">
							<div class="correlation-sources">
								{corr.sources.slice(0, 2).join(' ↔ ')}
							</div>
							<div class="correlation-topic">{corr.name} ({corr.sourceCount} sources)</div>
						</div>
					{/each}
				</div>
			{/if}

			{#if a.predictiveSignals.length > 0}
				<div class="section">
					<div class="section-title">Predictive Signals</div>
					{#each a.predictiveSignals.slice(0, 2) as signal}
						<div class="predictive-item">
							<div class="predictive-pattern">{signal.prediction}</div>
							<div class="predictive-confidence">
								Confidence: {Math.round(signal.confidence * 100)}%
							</div>
						</div>
					{/each}
				</div>
			{/if}

			{#if a.emergingPatterns.length === 0 && a.momentumSignals.length === 0}
				<div class="empty-state">No significant patterns detected</div>
			{/if}
		</div>
	{:else}
		<div class="empty-state">No significant patterns detected</div>
	{/if}
</Panel>

<style>
	.correlation-content {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	/* DGX status bar */
	.llm-status {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.55rem;
		color: var(--text-muted);
		padding: 0.25rem 0.4rem;
		background: rgba(255, 255, 255, 0.02);
		border-radius: 4px;
		border: 1px solid var(--border);
	}

	.llm-status.llm-loading {
		border-color: rgba(0, 255, 136, 0.2);
	}

	.llm-status.llm-error {
		border-color: rgba(255, 165, 0, 0.2);
		color: var(--warning, orange);
	}

	.llm-badge {
		font-size: 0.5rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		padding: 0.1rem 0.3rem;
		border-radius: 3px;
		background: rgba(255, 255, 255, 0.08);
		color: var(--text-secondary);
	}

	.llm-badge--ok {
		background: rgba(0, 255, 136, 0.15);
		color: var(--accent);
	}

	.llm-badge--warn {
		background: rgba(255, 165, 0, 0.15);
		color: var(--warning, orange);
	}

	.section {
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--border);
	}

	.section:last-child {
		border-bottom: none;
		padding-bottom: 0;
	}

	.section-title {
		font-size: 0.6rem;
		font-weight: 600;
		color: var(--accent);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 0.4rem;
	}

	.pattern-item {
		padding: 0.3rem 0;
	}

	.pattern-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.2rem;
	}

	.pattern-topic {
		font-size: 0.65rem;
		font-weight: 500;
		color: var(--text-primary);
	}

	.pattern-sources {
		font-size: 0.55rem;
		color: var(--text-muted);
	}

	.signal-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.25rem 0.4rem;
		margin: 0.2rem 0;
		border-radius: 4px;
		background: rgba(255, 255, 255, 0.02);
	}

	.signal-item.signal-strong {
		background: rgba(255, 165, 0, 0.1);
		border-left: 2px solid var(--warning);
	}

	.signal-item.signal-medium {
		background: rgba(68, 255, 136, 0.05);
		border-left: 2px solid var(--success);
	}

	.signal-topic {
		font-size: 0.6rem;
		color: var(--text-primary);
	}

	.signal-direction {
		font-size: 0.6rem;
		font-weight: 600;
	}

	.signal-direction.up {
		color: var(--success);
	}

	.signal-direction.down {
		color: var(--danger);
	}

	.correlation-item {
		padding: 0.25rem 0;
	}

	.correlation-sources {
		font-size: 0.6rem;
		color: var(--text-secondary);
	}

	.correlation-topic {
		font-size: 0.55rem;
		color: var(--text-muted);
	}

	.predictive-item {
		padding: 0.3rem 0;
	}

	.predictive-pattern {
		font-size: 0.6rem;
		color: var(--text-primary);
	}

	.predictive-confidence {
		font-size: 0.55rem;
		color: var(--text-muted);
	}

	.empty-state {
		text-align: center;
		color: var(--text-secondary);
		font-size: 0.7rem;
		padding: 1rem;
	}
</style>
