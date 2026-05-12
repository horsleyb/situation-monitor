<script lang="ts">
	import { Panel } from '$lib/components/common';
	import type { WeatherData } from '$lib/api';

	interface Props {
		weather?: WeatherData | null;
		loading?: boolean;
		error?: string | null;
	}

	let { weather = null, loading = false, error = null }: Props = $props();

	function formatDate(dateStr: string): string {
		const d = new Date(dateStr + 'T00:00:00');
		return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
	}
</script>

<Panel id="weather" title="Weather" {loading} {error}>
	{#if !weather && !loading && !error}
		<div class="empty-state">No weather data</div>
	{:else if weather}
		<div class="weather-body">
			<div class="location-row">
				<span class="location-name">{weather.location}{weather.country ? ', ' + weather.country : ''}</span>
				<span class="condition-text">{weather.condition}</span>
			</div>

			<div class="temp-row">
				<span class="temp-primary">{weather.temp_f}°F</span>
				<span class="temp-secondary">{weather.temp_c}°C</span>
			</div>

			<div class="feels-row">
				<span class="feels-label">Feels like</span>
				<span class="feels-value">{weather.feels_like_f}°F / {weather.feels_like_c}°C</span>
			</div>

			<div class="stats-row">
				<div class="stat">
					<span class="stat-label">Humidity</span>
					<span class="stat-value">{weather.humidity}%</span>
				</div>
				<div class="stat">
					<span class="stat-label">Wind</span>
					<span class="stat-value">{weather.wind_mph} mph {weather.wind_dir}</span>
				</div>
				<div class="stat">
					<span class="stat-label">Visibility</span>
					<span class="stat-value">{weather.visibility_miles} mi</span>
				</div>
				<div class="stat">
					<span class="stat-label">UV Index</span>
					<span class="stat-value">{weather.uv_index}</span>
				</div>
			</div>

			{#if weather.forecast.length > 0}
				<div class="forecast-section">
					{#each weather.forecast as day (day.date)}
						<div class="forecast-day">
							<span class="forecast-date">{formatDate(day.date)}</span>
							<span class="forecast-condition">{day.condition}</span>
							<div class="forecast-temps">
								<span class="forecast-high">{day.high_f}°</span>
								<span class="forecast-low">{day.low_f}°</span>
							</div>
							{#if day.rain_chance > 0}
								<span class="forecast-rain">{day.rain_chance}%</span>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</Panel>

<style>
	.empty-state {
		text-align: center;
		color: var(--text-secondary);
		font-size: 0.7rem;
		padding: 1rem;
	}

	.weather-body {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.location-row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 0.5rem;
	}

	.location-name {
		font-size: 0.65rem;
		font-weight: 600;
		color: var(--text-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.condition-text {
		font-size: 0.6rem;
		color: var(--text-secondary);
		flex-shrink: 0;
	}

	.temp-row {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
	}

	.temp-primary {
		font-size: 1.8rem;
		font-weight: 700;
		color: var(--text-primary);
		font-variant-numeric: tabular-nums;
		line-height: 1;
	}

	.temp-secondary {
		font-size: 0.9rem;
		color: var(--text-secondary);
		font-variant-numeric: tabular-nums;
	}

	.feels-row {
		display: flex;
		gap: 0.4rem;
		align-items: center;
	}

	.feels-label {
		font-size: 0.55rem;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.feels-value {
		font-size: 0.6rem;
		color: var(--text-secondary);
		font-variant-numeric: tabular-nums;
	}

	.stats-row {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.35rem;
		padding: 0.4rem 0;
		border-top: 1px solid var(--border);
		border-bottom: 1px solid var(--border);
	}

	.stat {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.stat-label {
		font-size: 0.5rem;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.stat-value {
		font-size: 0.65rem;
		color: var(--text-primary);
		font-variant-numeric: tabular-nums;
	}

	.forecast-section {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.forecast-day {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.25rem 0;
		border-bottom: 1px solid var(--border);
	}

	.forecast-day:last-child {
		border-bottom: none;
	}

	.forecast-date {
		font-size: 0.6rem;
		color: var(--text-secondary);
		width: 5rem;
		flex-shrink: 0;
	}

	.forecast-condition {
		font-size: 0.6rem;
		color: var(--text-muted);
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.forecast-temps {
		display: flex;
		gap: 0.3rem;
		flex-shrink: 0;
	}

	.forecast-high {
		font-size: 0.65rem;
		font-weight: 600;
		color: var(--text-primary);
		font-variant-numeric: tabular-nums;
	}

	.forecast-low {
		font-size: 0.65rem;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
	}

	.forecast-rain {
		font-size: 0.55rem;
		color: var(--accent, #60a5fa);
		font-variant-numeric: tabular-nums;
		width: 2rem;
		text-align: right;
		flex-shrink: 0;
	}
</style>
