# API Routes

Server-side SvelteKit routes (requires `adapter-node` / Docker). All endpoints return JSON.

## Rate Limiting

All `/api/*` routes are rate-limited to **60 requests per minute per IP** (sliding window, in-memory).  
On breach the server returns:

```
HTTP 429
Retry-After: 60
{ "error": "rate_limit_exceeded", "retry_after": 60 }
```

---

## Endpoints

### `GET /api/weather`

Current weather and 3-day forecast via [wttr.in](https://wttr.in) (no API key required).

| Param      | Type   | Required | Notes                                  |
|------------|--------|----------|----------------------------------------|
| `location` | string | No       | City, "lat,lon", zip. Default: Chicago |

Location is sanitized to `[a-zA-Z0-9 ,.\-+]`, max 100 chars.

**Response shape**

```json
{
  "location": "Chicago",
  "country": "United States of America",
  "temp_f": 72,
  "temp_c": 22,
  "feels_like_f": 70,
  "feels_like_c": 21,
  "humidity": 55,
  "wind_mph": 12,
  "wind_dir": "SW",
  "condition": "Partly cloudy",
  "visibility_miles": 10,
  "uv_index": 4,
  "forecast": [
    { "date": "2026-05-12", "high_f": 75, "low_f": 60, "condition": "Sunny", "rain_chance": 10 }
  ],
  "timestamp": "2026-05-12T14:00:00.000Z"
}
```

**Cache-Control:** `public, max-age=600, stale-while-revalidate=120` (server TTL: 10 min)

---

### `GET /api/news`

News articles fetched from RSS feeds, grouped by category.

| Param      | Type   | Required | Notes                                              |
|------------|--------|----------|----------------------------------------------------|
| `category` | string | No       | `politics` `tech` `finance` `gov` `ai` `intel`     |

- Omit `category` to receive all six categories in one response.
- Invalid category returns HTTP 400.

**Response — with `category`**

```json
{
  "category": "politics",
  "articles": [
    { "title": "...", "url": "https://...", "source": "NYT", "date": "Mon, 12 May 2026 ..." }
  ],
  "count": 8,
  "timestamp": "2026-05-12T14:00:00.000Z"
}
```

**Response — without `category`**

```json
{
  "categories": {
    "politics": [ ...articles ],
    "tech": [ ...articles ],
    "finance": [ ...articles ],
    "gov": [ ...articles ],
    "ai": [ ...articles ],
    "intel": [ ...articles ]
  },
  "timestamp": "2026-05-12T14:00:00.000Z"
}
```

**Cache-Control:** `public, max-age=60, stale-while-revalidate=60` (server TTL: 5 min per category)

---

### `GET /api/markets`

Live market snapshot: major indices, crypto, and FRED economic indicators.

No query parameters.

**Response shape**

```json
{
  "timestamp": "2026-05-12T14:00:00.000Z",
  "indices": [
    { "symbol": "^GSPC", "label": "S&P 500", "price": 5300, "change": 12.5, "changePercent": 0.24 },
    { "symbol": "^DJI",  "label": "Dow Jones", ... },
    { "symbol": "^IXIC", "label": "NASDAQ", ... },
    { "symbol": "^RUT",  "label": "Russell 2000", ... }
  ],
  "crypto": [
    { "symbol": "BTC", "name": "Bitcoin",  "price": 62000, "change24h": 1.5 },
    { "symbol": "ETH", "name": "Ethereum", "price": 3200,  "change24h": -0.8 },
    { "symbol": "SOL", "name": "Solana",   "price": 150,   "change24h": 2.1 }
  ],
  "economy": {
    "fedFundsRate": { "name": "Fed Funds Rate", "unit": "%", "value": 5.33, "date": "2024-04-01" },
    "treasury10Y":  { "name": "10Y Treasury",   "unit": "%", "value": 4.45, "date": "2026-05-10" }
  },
  "hasFinnhub": true,
  "hasFred": true
}
```

- `indices` data requires `VITE_FINNHUB_API_KEY` env var; values are `NaN` when key is absent.
- `economy` data requires `VITE_FRED_API_KEY`; values are `null` when key is absent.

**Cache-Control:** `public, max-age=60, stale-while-revalidate=30` (server TTL: 60 s indices / 5 min FRED)

---

### `GET /api/briefing`

Comprehensive situational snapshot aggregating news + markets + economic indicators.
Intended as a single-call summary for Jarvis AI.

No query parameters.

**Response shape**

```json
{
  "timestamp": "2026-05-12T14:00:00.000Z",
  "news": {
    "politics": [ { "title": "...", "url": "...", "source": "NYT", "date": "..." } ],
    "finance":  [ ...4 articles ],
    "ai":       [ ...4 articles ],
    "intel":    [ ...3 articles ]
  },
  "markets": {
    "indices": {
      "sp500":  { "label": "S&P 500",   "price": 5300, "change": 12, "changePercent": 0.24 },
      "dow":    { "label": "Dow Jones", ... },
      "nasdaq": { "label": "NASDAQ",    ... }
    },
    "crypto": [
      { "symbol": "BTC", "name": "Bitcoin",  "price": 62000, "change24h": 1.5 },
      { "symbol": "ETH", "name": "Ethereum", "price": 3200,  "change24h": -0.8 },
      { "symbol": "SOL", "name": "Solana",   "price": 150,   "change24h": 2.1 }
    ]
  },
  "economy": {
    "fedFundsRate": { "name": "Fed Funds Rate", "unit": "%", "value": 5.33, "date": "2024-04-01" },
    "treasury10Y":  { "name": "10Y Treasury",   "unit": "%", "value": 4.45, "date": "2026-05-10" }
  }
}
```

**Cache-Control:** `public, max-age=60, stale-while-revalidate=60` (server TTL: 5 min)

---

## Common Response Headers

All endpoints add:

| Header                  | Value                                    |
|-------------------------|------------------------------------------|
| `Content-Type`          | `application/json`                       |
| `X-Content-Type-Options`| `nosniff`                                |
| `Access-Control-Allow-Origin` | `*`                              |
| `Cache-Control`         | Endpoint-specific (see above)            |

## Environment Variables

| Variable               | Used by              | Notes               |
|------------------------|----------------------|---------------------|
| `VITE_FINNHUB_API_KEY` | `/api/markets`, `/api/briefing` | Free tier: 60 calls/min |
| `VITE_FRED_API_KEY`    | `/api/markets`, `/api/briefing` | Free, from fred.stlouisfed.org |
