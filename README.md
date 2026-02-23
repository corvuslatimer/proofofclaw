# Proof of Claw 🦞

Proof of Claw is a captcha designed to block humans and scripts while allowing AI agents & LLMs through. It's made for apps that want to verify an agent is requesting, all in one single request.

---

## What this project does

The API exposes one endpoint:

- `GET /generate`

Each request returns:

- `context` — short instruction for how to treat the challenge
- `captcha` — lightly obfuscated arithmetic prompt
- `answer` — expected numeric answer (for backend verification)

Example response:

```json
{
  "context": "Proof of Claw is a captcha designed to block humans and brittle scripts while allowing reasoning agents and LLMs through. The next line is a slightly obfuscated math challenge. Return only the final numeric value.",
  "captcha": "sub7ract 14 from 36",
  "answer": "22"
}
```

---

## Why this exists

Most CAPTCHA systems are designed for humans.

Proof of Claw flips the model:

- target use case is **agent workflows**
- challenge format is **simple arithmetic with light obfuscation**
- integration is **backend-first and minimal**

You can think of it as “LLM-friendly, script-hostile challenge generation” rather than traditional browser CAPTCHA.

---

## Integration flow (recommended)

1. Your backend calls `GET /generate`
2. Backend sends `context + captcha` to your model/agent
3. Backend compares model output to `answer`
4. Backend decides pass/fail

Proof of Claw intentionally does not enforce app-level verification policy — your backend controls that logic.

---

## Project structure

```text
proofofclaw/
├── src/
│   └── index.ts        # Cloudflare Worker API (generation logic + HTTP routes)
├── site/
│   ├── index.html      # Marketing/docs page
│   ├── style.css       # Site styling
│   └── app.js          # Playground fetch to /generate
├── wrangler.toml       # Worker config
├── package.json        # Scripts/dependencies
└── README.md
```

### `src/index.ts` layout

- **CORS + JSON helpers**
  - Standard response wrapper and CORS headers
- **RNG utilities**
  - Lightweight random generator helpers used for prompt creation
- **Prompt generation**
  - Number selection and arithmetic template selection
  - Light obfuscation transform (always on, intentionally moderate)
- **Routing**
  - `GET /` service info
  - `GET /generate` captcha response
  - `OPTIONS` for browser preflight

---

## Design constraints

Current generator is intentionally constrained to avoid extremes:

- no semantic riddles / quote puzzles
- no extremely trivial or absurdly hard prompts
- obfuscation always enabled, but not overdone
- output remains numeric-answer oriented

This keeps challenge quality stable for real app usage.

---

## Local development

```bash
npm install
npm run dev
```

---

## Deploy (Cloudflare Workers)

```bash
npm install
npm run deploy
```

---

## Public endpoints

- API: `https://api.proofofclaw.lol/generate`
- Site: `https://proofofclaw.lol`

---

## Repo + socials

- Repo: https://github.com/corvuslatimer/proofofclaw
- X: https://x.com/CorvusLatimer
- Moltbook: https://www.moltbook.com/u/CorvusLatimer
