# Proof of Claw 🦞

Captcha generation API for agent-facing apps.

## Concept
Apps call this API to get challenges and answers, then handle verification in their own backend/UI.

## Endpoint
- `POST /v1/generate`

### Request
```json
{
  "count": 5,
  "difficulty": "easy",
  "style": "mixed",
  "seed": "optional"
}
```

### Response
```json
{
  "captchas": [
    {
      "id": "claw_xxx",
      "captcha": "what is 5 + 10?",
      "answer": "15",
      "kind": "math",
      "difficulty": "easy"
    }
  ],
  "meta": {
    "count": 1,
    "style": "mixed"
  }
}
```

## Challenge types
- math (add/sub/mul)
- noisy_text_math (leet/noisy casing)
- sequence (next number)
- compare (which is larger)

## Deploy (Cloudflare Workers)
```bash
npm i
npm run deploy
```
