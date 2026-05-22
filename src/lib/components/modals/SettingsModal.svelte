<script lang="ts">
	import Modal from './Modal.svelte';
	import { settings } from '$lib/stores';
	import { dgxEnabled } from '$lib/stores/dgx';
	import { PANELS, type PanelId } from '$lib/config';

	interface Props {
		open: boolean;
		onClose: () => void;
		onReconfigure?: () => void;
	}

	let { open = false, onClose, onReconfigure }: Props = $props();

	function handleTogglePanel(panelId: PanelId) {
		settings.togglePanel(panelId);
	}

	function handleResetPanels() {
		settings.reset();
	}
</script>

<Modal {open} title="Settings" {onClose}>
	<div class="settings-sections">
		<section class="settings-section">
			<h3 class="section-title">Enabled Panels</h3>
			<p class="section-desc">Toggle panels on/off to customize your dashboard</p>

			<div class="panels-grid">
				{#each Object.entries(PANELS) as [id, config]}
					{@const panelId = id as PanelId}
					{@const isEnabled = $settings.enabled[panelId]}
					<label class="panel-toggle" class:enabled={isEnabled}>
						<input
							type="checkbox"
							checked={isEnabled}
							onchange={() => handleTogglePanel(panelId)}
						/>
						<span class="panel-name">{config.name}</span>
						<span class="panel-priority">P{config.priority}</span>
					</label>
				{/each}
			</div>
		</section>

		<section class="settings-section">
			<h3 class="section-title">AI Enhancement (DGX Spark)</h3>
			<p class="section-desc">
				Use local Qwen2.5-72B on DGX Spark to cluster headlines and detect correlations the
				pattern engine might miss. Requires the DGX to be reachable on the local network.
			</p>
			<label class="dgx-toggle" class:dgx-enabled={$dgxEnabled}>
				<input
					type="checkbox"
					checked={$dgxEnabled}
					onchange={() => dgxEnabled.toggle()}
				/>
				<span class="dgx-label">
					{$dgxEnabled ? 'DGX Analysis ON' : 'DGX Analysis OFF'}
				</span>
				<span class="dgx-model">qwen2.5-72b @ 192.168.68.118:8002</span>
			</label>
			{#if $dgxEnabled}
				<p class="dgx-hint">
					Analysis runs automatically when the Pattern Analysis panel loads news.
					Falls back to regex-only if DGX is unreachable.
				</p>
			{/if}
		</section>

		<section class="settings-section">
			<h3 class="section-title">Dashboard</h3>
			{#if onReconfigure}
				<button class="reconfigure-btn" onclick={onReconfigure}> Reconfigure Dashboard </button>
				<p class="btn-hint">Choose a preset profile for your panels</p>
			{/if}
			<button class="reset-btn" onclick={handleResetPanels}> Reset All Settings </button>
		</section>
	</div>
</Modal>

<style>
	.settings-sections {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.settings-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.section-title {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-secondary);
		margin: 0;
	}

	.section-desc {
		font-size: 0.65rem;
		color: var(--text-muted);
		margin: 0;
	}

	.panels-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.5rem;
	}

	.panel-toggle {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.4rem 0.6rem;
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid var(--border);
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.panel-toggle:hover {
		background: rgba(255, 255, 255, 0.05);
	}

	.panel-toggle.enabled {
		border-color: var(--accent);
		background: rgba(var(--accent-rgb), 0.1);
	}

	.panel-toggle input {
		accent-color: var(--accent);
	}

	.panel-name {
		flex: 1;
		font-size: 0.65rem;
		color: var(--text-primary);
	}

	.panel-priority {
		font-size: 0.5rem;
		color: var(--text-muted);
		background: rgba(255, 255, 255, 0.05);
		padding: 0.1rem 0.25rem;
		border-radius: 2px;
	}

	.reconfigure-btn {
		padding: 0.5rem 1rem;
		background: rgba(0, 255, 136, 0.1);
		border: 1px solid rgba(0, 255, 136, 0.3);
		border-radius: 4px;
		color: var(--accent);
		font-size: 0.7rem;
		cursor: pointer;
		transition: all 0.15s ease;
		margin-bottom: 0.25rem;
	}

	.reconfigure-btn:hover {
		background: rgba(0, 255, 136, 0.2);
	}

	.btn-hint {
		font-size: 0.6rem;
		color: var(--text-muted);
		margin: 0 0 0.75rem;
	}

	.reset-btn {
		padding: 0.5rem 1rem;
		background: rgba(255, 68, 68, 0.1);
		border: 1px solid rgba(255, 68, 68, 0.3);
		border-radius: 4px;
		color: var(--danger);
		font-size: 0.7rem;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.reset-btn:hover {
		background: rgba(255, 68, 68, 0.2);
	}

	/* DGX toggle */
	.dgx-toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid var(--border);
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.dgx-toggle.dgx-enabled {
		border-color: var(--accent);
		background: rgba(var(--accent-rgb), 0.1);
	}

	.dgx-toggle input {
		accent-color: var(--accent);
	}

	.dgx-label {
		flex: 1;
		font-size: 0.7rem;
		color: var(--text-primary);
		font-weight: 500;
	}

	.dgx-model {
		font-size: 0.55rem;
		color: var(--text-muted);
		font-family: monospace;
	}

	.dgx-hint {
		font-size: 0.6rem;
		color: var(--text-muted);
		margin: 0;
		padding-left: 0.25rem;
		border-left: 2px solid rgba(0, 255, 136, 0.3);
	}
</style>
