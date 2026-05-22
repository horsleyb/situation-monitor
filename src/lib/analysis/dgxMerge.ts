/**
 * Merges LLM-produced clusters from the DGX service into the existing
 * regex-based CorrelationResults.  The merge is strictly additive:
 * existing results are never removed or overwritten.
 *
 * Strategy:
 *  - Each LlmCluster with significance >= 4 adds an EmergingPattern.
 *  - Clusters with significance >= 7 also add a CrossSourceCorrelation.
 *  - Duplicates (same topic already found by regex) are skipped.
 */

import type { NewsItem } from '$lib/types';
import type { CorrelationResults, EmergingPattern, CrossSourceCorrelation } from './correlation';
import type { LlmAnalysis, LlmCluster } from '$lib/services/dgxService';

/** Prefix used on IDs to distinguish LLM-sourced entries */
const LLM_PREFIX = 'llm-';

function clusterToPattern(
	cluster: LlmCluster,
	headlines: Array<{ title: string; link: string; source: string }>
): EmergingPattern {
	const level: EmergingPattern['level'] =
		cluster.significance >= 8 ? 'high' : cluster.significance >= 6 ? 'elevated' : 'emerging';

	return {
		id: `${LLM_PREFIX}${cluster.topic.toLowerCase().replace(/\s+/g, '-')}`,
		name: cluster.topic,
		category: 'LLM Analysis',
		count: cluster.indices.length,
		level,
		sources: [...new Set(headlines.map((h) => h.source))],
		headlines
	};
}

function clusterToCorrelation(
	cluster: LlmCluster,
	headlines: Array<{ title: string; link: string; source: string }>
): CrossSourceCorrelation {
	const sources = [...new Set(headlines.map((h) => h.source))];
	const level: CrossSourceCorrelation['level'] =
		cluster.significance >= 8 ? 'high' : cluster.significance >= 6 ? 'elevated' : 'emerging';

	return {
		id: `${LLM_PREFIX}${cluster.topic.toLowerCase().replace(/\s+/g, '-')}`,
		name: cluster.topic,
		category: 'LLM Analysis',
		sourceCount: sources.length,
		sources,
		level,
		headlines
	};
}

/**
 * Merge DGX LLM analysis into existing CorrelationResults (mutates results in place).
 *
 * @param results  - Existing regex-based results (mutated)
 * @param analysis - LlmAnalysis from dgxService (may be null)
 * @param allNews  - The news items that were analyzed (to resolve indices to headlines)
 */
export function mergeLlmAnalysis(
	results: CorrelationResults,
	analysis: LlmAnalysis | null,
	allNews: NewsItem[]
): void {
	if (!analysis || analysis.clusters.length === 0) return;

	// Build a lookup of existing IDs to avoid duplicates
	const existingPatternIds = new Set(results.emergingPatterns.map((p) => p.id));
	const existingCorrelationIds = new Set(results.crossSourceCorrelations.map((c) => c.id));

	for (const cluster of analysis.clusters) {
		const headlineItems = cluster.indices
			.map((i) => allNews[i])
			.filter((item): item is NewsItem => !!item)
			.map((item) => ({ title: item.title, link: item.link, source: item.source }));

		if (headlineItems.length < 2) continue;

		// Add as EmergingPattern if not already detected
		if (cluster.significance >= 4) {
			const pattern = clusterToPattern(cluster, headlineItems);
			if (!existingPatternIds.has(pattern.id)) {
				results.emergingPatterns.push(pattern);
				existingPatternIds.add(pattern.id);
			}
		}

		// Add as CrossSourceCorrelation for high-significance clusters
		if (cluster.significance >= 7) {
			const correlation = clusterToCorrelation(cluster, headlineItems);
			if (!existingCorrelationIds.has(correlation.id)) {
				results.crossSourceCorrelations.push(correlation);
				existingCorrelationIds.add(correlation.id);
			}
		}
	}

	// Re-sort after merge
	results.emergingPatterns.sort((a, b) => b.count - a.count);
	results.crossSourceCorrelations.sort((a, b) => b.sourceCount - a.sourceCount);
}
