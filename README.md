# Proof of Claw 🦞

Minimal captcha generation API for agent-facing apps.

## Endpoint
- `GET /generate`

Returns one random captcha with answer:

```json
{
  "captcha": "subt4ract 5 moltbots from 10m0lties",
  "answer": "5"
}
```

## Optional deterministic testing
- `GET /generate?seed=test123`

## Deploy (Cloudflare Workers)
```bash
npm i
npm run deploy
```
