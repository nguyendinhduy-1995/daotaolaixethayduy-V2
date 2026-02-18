# N8N Integration Samples

## Quick Start

1. Import workflow (or use cURL)
2. Set environment variables:
   - `BASE_URL=http://localhost:3000` (or your staging URL)
   - Secrets configured in `.env`
3. Run the simulation:

```bash
BASE_URL=http://localhost:3000 bash scripts/simulate-n8n.sh
```

## Sample Payloads

| File | Endpoint | Description |
|------|----------|-------------|
| `ops-pulse.json` | `POST /api/ops/pulse` | Daily operations metrics per branch/role |
| `marketing-ingest.json` | `POST /api/marketing/ingest` | Daily ad spend & conversion data |
| `ai-suggestions.json` | `POST /api/ai/suggestions/ingest` | AI coach suggestions for staff |

## Authentication

- **Admin endpoints**: Use Bearer token from `POST /api/auth/login`
- **Service endpoints**: Use `x-service-token` header
- **Ops endpoints**: Use `x-ops-secret` header
- **Marketing endpoints**: Use `x-marketing-secret` header

## Full Simulation

The `scripts/simulate-n8n.sh` script tests all 12 integration endpoints automatically.

```bash
# With default settings
bash scripts/simulate-n8n.sh

# With custom BASE_URL
BASE_URL=https://staging.example.com bash scripts/simulate-n8n.sh
```

Expected output: `PASS 12/12`
