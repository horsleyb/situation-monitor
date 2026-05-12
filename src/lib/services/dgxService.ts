/**
 * DGX Spark LLM analysis service
 *
 * Calls the local Qwen2.5-72B model via OpenAI-compatible vLLM API at 192.168.68.118:8002.
 * Results supplement (never replace) the existing regex-based analysis.
 * All errors are caught and logged; callers receive null on failure.
 */

// ---------------------------------------------------------------------------
// Config & types
// ---------------------------------------------------------------------------

export interface DgxConfig {
	baseUrl: string; // e.g. 'http://192.168.68.118:8002/v1'
	model: string; // e.g. 'qwen2.5-72b'
	enabled: boolean;
}

export const DEFAULT_DGX_CONFIG: DgxConfig = {
	baseUrl: 'http://192.168.68.118:8002/v1',
	model: 'qwen2.5-72b',
	enabled: false
};

// ---------------------------------------------------------------------------
// LLM response schema (what the model returns as JSON)
// ---------------------------------------------------------------------------

export interface LlmCluster {
	/** Indices into the headlines array that belong to this cluster */
	indices: number[];
	/** Short label for the cluster topic */
	topic: string;
	/** Geopolitical significance 1–10 */
	significance: number;
	/** Main entities / actors involved */
	entities: string[];
	/** Narrative stage: emerging | developing | mainstream | peak */
	narrativeStage: 'emerging' | 'developing' | 'mainstream' | 'peak';
}

export interface LlmAnalysis {
	clusters: LlmCluster[];
	/** Timestamp (ms) when the analysis was produced */
	analyzedAt: number;
	/** Model that produced this analysis */
	model: string;
}

// ---------------------------------------------------------------------------
// Prompt helpers
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an intelligence analysis engine. Analyze news headlines for geopolitical patterns.
Return ONLY a valid JSON object with this exact structure:
{
  "clusters": [
    {
      "indices": [0, 3, 7],
      "topic": "Short topic label",
      "significance": 7,
      "entities": ["Entity A", "Entity B"],
      "narrativeStage": "developing"
    }
  ]
}

Rules:
- Group related headlines into clusters. A headline may appear in multiple clusters.
- Only create a cluster when 2+ headlines are clearly related.
- significance: 1 (trivial) to 10 (world-changing).
- narrativeStage: "emerging" (new story), "developing" (building), "mainstream" (widely covered), "peak" (saturation).
- entities: key people, countries, organizations — max 5 per cluster.
- Return an empty clusters array if no meaningful correlations exist.
- Do NOT include any text outside the JSON object.`;

function buildUserPrompt(headlines: string[]): string {
	const numbered = headlines.map((h, i) => `${i}: ${h}`).join('\n');
	return `Analyze these ${headlines.length} news headlines and identify correlation clusters:\n\n${numbered}`;
}

// ---------------------------------------------------------------------------
// Core fetch with timeout
// ---------------------------------------------------------------------------

const REQUEST_TIMEOUT_MS = 15_000;

interface OpenAiMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

interface OpenAiChoice {
	message: OpenAiMessage;
	finish_reason: string;
}

interface OpenAiResponse {
	choices: OpenAiChoice[];
	model: string;
}

async function callChatCompletions(
	config: DgxConfig,
	messages: OpenAiMessage[]
): Promise<string | null> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

	try {
		const res = await fetch(`${config.baseUrl}/chat/completions`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			signal: controller.signal,
			body: JSON.stringify({
				model: config.model,
				messages,
				temperature: 0.2,
				max_tokens: 2048,
				response_format: { type: 'json_object' }
			})
		});

		if (!res.ok) {
			console.warn(`[DGX] HTTP ${res.status} from vLLM endpoint`);
			return null;
		}

		const data = (await res.json()) as OpenAiResponse;
		return data.choices?.[0]?.message?.content ?? null;
	} catch (err) {
		if (err instanceof Error && err.name === 'AbortError') {
			console.warn('[DGX] Request timed out after 15s');
		} else {
			console.warn('[DGX] Fetch error:', err instanceof Error ? err.message : String(err));
		}
		return null;
	} finally {
		clearTimeout(timer);
	}
}

// ---------------------------------------------------------------------------
// JSON parsing — handles both raw JSON and JSON embedded in markdown fences
// ---------------------------------------------------------------------------

function parseJsonResponse(raw: string): Record<string, unknown> | null {
	// Try direct parse first
	try {
		return JSON.parse(raw) as Record<string, unknown>;
	} catch {
		// Try extracting from ```json ... ``` fences
		const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
		if (match?.[1]) {
			try {
				return JSON.parse(match[1]) as Record<string, unknown>;
			} catch {
				// fall through
			}
		}
		console.warn('[DGX] Could not parse JSON from model response');
		return null;
	}
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const VALID_STAGES = new Set(['emerging', 'developing', 'mainstream', 'peak']);

function isValidStage(s: unknown): s is LlmCluster['narrativeStage'] {
	return typeof s === 'string' && VALID_STAGES.has(s);
}

function clampSignificance(v: unknown): number {
	const n = typeof v === 'number' ? v : parseInt(String(v), 10);
	return isNaN(n) ? 5 : Math.max(1, Math.min(10, n));
}

function validateCluster(raw: unknown, headlineCount: number): LlmCluster | null {
	if (!raw || typeof raw !== 'object') return null;
	const c = raw as Record<string, unknown>;

	const indices = Array.isArray(c.indices)
		? (c.indices as unknown[]).filter(
				(i): i is number => typeof i === 'number' && i >= 0 && i < headlineCount
			)
		: [];

	if (indices.length < 2) return null;

	const entities = Array.isArray(c.entities)
		? (c.entities as unknown[]).filter((e): e is string => typeof e === 'string').slice(0, 5)
		: [];

	return {
		indices,
		topic: typeof c.topic === 'string' && c.topic.trim() ? c.topic.trim() : 'Related Events',
		significance: clampSignificance(c.significance),
		entities,
		narrativeStage: isValidStage(c.narrativeStage) ? c.narrativeStage : 'developing'
	};
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Analyze a batch of news headlines using the DGX LLM.
 * Returns null on any failure so callers can fall back gracefully.
 */
export async function analyzeNewsWithLLM(
	headlines: string[],
	config: DgxConfig
): Promise<LlmAnalysis | null> {
	if (!config.enabled || headlines.length === 0) return null;

	const messages: OpenAiMessage[] = [
		{ role: 'system', content: SYSTEM_PROMPT },
		{ role: 'user', content: buildUserPrompt(headlines) }
	];

	const rawText = await callChatCompletions(config, messages);
	if (!rawText) return null;

	const parsed = parseJsonResponse(rawText);
	if (!parsed) return null;

	const rawClusters = Array.isArray(parsed.clusters) ? parsed.clusters : [];
	const clusters: LlmCluster[] = rawClusters
		.map((c) => validateCluster(c, headlines.length))
		.filter((c): c is LlmCluster => c !== null);

	return {
		clusters,
		analyzedAt: Date.now(),
		model: config.model
	};
}

/**
 * Quick connectivity check — sends a minimal request to the vLLM endpoint.
 * Returns true if the endpoint is reachable and responds within the timeout.
 */
export async function checkDgxConnectivity(config: DgxConfig): Promise<boolean> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 5_000);
	try {
		const res = await fetch(`${config.baseUrl}/models`, {
			signal: controller.signal
		});
		return res.ok;
	} catch {
		return false;
	} finally {
		clearTimeout(timer);
	}
}
