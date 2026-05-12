# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository

**GitHub**: `https://github.com/horsleyb/situation-monitor`
**Deployment**: Docker (adapter-node) — NOT a static site. API routes require a Node.js server.

## Development Workflow

When working on a new feature:
1. Create a new branch before making any changes
2. Make all commits on that feature branch
3. Before opening a PR, run the `code-simplifier` agent to clean up the code

## Build & Development Commands

```bash
npm run dev          # Start dev server (localhost:5173)
npm run build        # Build to /build directory
npm run preview      # Preview production build (localhost:4173)
npm run check        # TypeScript type checking
npm run check:watch  # Type checking in watch mode
npm run test         # Run Vitest in watch mode
npm run test:unit    # Run unit tests once
npm run test:e2e     # Run Playwright E2E tests (requires preview server)
npm run lint         # ESLint + Prettier check
npm run format       # Auto-format with Prettier
```

## Docker (Primary Deployment Method)

```bash
docker-compose up -d         # Start production container
docker-compose down          # Stop
docker-compose logs -f       # Follow logs
docker-compose build         # Rebuild image
```

The app runs on **port 3004** in Docker (mapped to internal 3000). See `docker-compose.yml` and `Dockerfile`.

Environment variables go in `.env` (copy from `.env.example`):
- `VITE_FINNHUB_API_KEY` — optional, free tier 60 calls/min
- `NODE_ENV=production`

## Technology Stack

- **SvelteKit 2.0** with Svelte 5 reactivity (`$state`, `$derived`, `$effect` runes)
- **TypeScript** (strict mode enabled)
- **Tailwind CSS** with custom dark theme
- **adapter-node** — server-side rendering + API routes (replaced static adapter)
- **Vitest** (unit) + **Playwright** (E2E) for testing
- **Docker** — production deployment via docker-compose

## Project Architecture

### Core Directories (`src/lib/`)

- **`analysis/`** - Pattern correlation, narrative tracking, main character detection across news items
- **`api/`** - Data fetching from RSS feeds (30+ sources), market APIs, CoinGecko, wttr.in weather
- **`components/`** - Svelte components organized into layout/, panels/, modals/, common/
- **`config/`** - Centralized configuration for feeds, keywords, analysis patterns, panels, map hotspots
- **`services/`** - Resilience layer: CacheManager, CircuitBreaker, RequestDeduplicator, ServiceClient
- **`stores/`** - Svelte stores for settings, news, markets, monitors, refresh orchestration
- **`types/`** - TypeScript interfaces

### Server-Side API Routes (`src/routes/api/`)

SvelteKit API routes that run server-side (requires adapter-node / Docker):
- `/api/weather` — weather data via wttr.in (no API key needed)
- Additional routes added for Jarvis AI integration

### Path Aliases

```typescript
$lib        → src/lib
$components → src/lib/components
$stores     → src/lib/stores
$services   → src/lib/services
$config     → src/lib/config
$types      → src/lib/types
```

## Key Architectural Patterns

### Service Layer (`src/lib/services/`)
All HTTP requests go through `ServiceClient` which integrates:
- **CacheManager**: Per-service caching with TTL
- **CircuitBreaker**: Prevents cascading failures
- **RequestDeduplicator**: Prevents concurrent duplicate requests

### Multi-Stage Refresh (`src/lib/stores/refresh.ts`)
Data fetches happen in 3 stages with staggered delays:
1. Critical (0ms): News, markets, alerts
2. Secondary (2s): Crypto, commodities, intel
3. Tertiary (4s): Contracts, whales, layoffs, polymarket

### Analysis Engine (`src/lib/analysis/`)
Unique business logic for intelligence analysis:
- Correlation detection across disparate news items
- Narrative tracking (fringe → mainstream progression)
- Entity prominence calculation ("main character" analysis)
- All use configurable regex patterns from `src/lib/config/analysis.ts`

### Configuration-Driven Design (`src/lib/config/`)
- `feeds.ts`: 30+ RSS sources across 6 categories (politics, tech, finance, gov, ai, intel)
- `keywords.ts`: Alert keywords, region detection, topic detection
- `analysis.ts`: Correlation topics and narrative patterns with severity levels
- `panels.ts`: Panel registry with display order
- `map.ts`: Geopolitical hotspots, conflict zones, strategic locations

## Testing

**Unit tests**: Located alongside source as `*.test.ts` or `*.spec.ts`
**E2E tests**: In `tests/e2e/*.spec.ts`, run against preview server

## External Dependencies

- **D3.js** for interactive map visualization
- **CORS proxy** (Cloudflare Worker) for RSS feed parsing
- **CoinGecko API** for cryptocurrency data
- **wttr.in** for weather data (no key required)
- **Finnhub** for market data (optional free API key)
