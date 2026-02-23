interface GenerateRequest {
  count?: number;
  difficulty?: "easy" | "medium" | "hard";
  style?: "math" | "noisy" | "sequence" | "compare" | "mixed";
  seed?: string;
}

type Kind = "math" | "noisy_text_math" | "sequence" | "compare";

interface CaptchaItem {
  id: string;
  captcha: string;
  answer: string;
  kind: Kind;
  difficulty: "easy" | "medium" | "hard";
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeRng(seed?: string) {
  let state = seed ? hashString(seed) : crypto.getRandomValues(new Uint32Array(1))[0];
  return () => {
    // xorshift32
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function rint(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function randomId(rng: () => number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "claw_";
  for (let i = 0; i < 10; i++) out += chars[Math.floor(rng() * chars.length)];
  return out;
}

function toNoisy(text: string, rng: () => number): string {
  const map: Record<string, string[]> = {
    a: ["a", "A", "@"],
    e: ["e", "E", "3"],
    i: ["i", "I", "1"],
    o: ["o", "O", "0"],
    s: ["s", "S", "5"],
    t: ["t", "T", "7"],
    w: ["w", "W"],
    h: ["h", "H"]
  };
  let out = "";
  for (const ch of text) {
    const lower = ch.toLowerCase();
    if (map[lower] && rng() < 0.45) out += pick(rng, map[lower]);
    else out += rng() < 0.3 ? ch.toUpperCase() : ch.toLowerCase();
    if (rng() < 0.08) out += pick(rng, ["~", "^", "'", " "]);
  }
  return out.trim();
}

function ranges(diff: "easy" | "medium" | "hard") {
  if (diff === "easy") return { n: [1, 20], seqStart: [1, 10], step: [1, 5] };
  if (diff === "medium") return { n: [10, 100], seqStart: [5, 40], step: [2, 12] };
  return { n: [50, 500], seqStart: [20, 120], step: [5, 30] };
}

function makeMath(rng: () => number, difficulty: "easy" | "medium" | "hard"): CaptchaItem {
  const { n } = ranges(difficulty);
  const a = rint(rng, n[0], n[1]);
  const b = rint(rng, n[0], n[1]);
  const op = pick(rng, difficulty === "easy" ? ["+", "-"] : ["+", "-", "*"] as const);
  const answer = op === "+" ? a + b : op === "-" ? a - b : a * b;
  return {
    id: randomId(rng),
    captcha: `what is ${a} ${op} ${b}?`,
    answer: String(answer),
    kind: "math",
    difficulty
  };
}

function makeNoisy(rng: () => number, difficulty: "easy" | "medium" | "hard"): CaptchaItem {
  const base = makeMath(rng, difficulty);
  return { ...base, captcha: toNoisy(base.captcha, rng), kind: "noisy_text_math" };
}

function makeSequence(rng: () => number, difficulty: "easy" | "medium" | "hard"): CaptchaItem {
  const { seqStart, step } = ranges(difficulty);
  const start = rint(rng, seqStart[0], seqStart[1]);
  const d = rint(rng, step[0], step[1]);
  const len = 4;
  const arr = Array.from({ length: len }, (_, i) => start + i * d);
  return {
    id: randomId(rng),
    captcha: `what comes next: ${arr.join(", ")}, ?`,
    answer: String(start + len * d),
    kind: "sequence",
    difficulty
  };
}

function makeCompare(rng: () => number, difficulty: "easy" | "medium" | "hard"): CaptchaItem {
  const { n } = ranges(difficulty);
  const a = rint(rng, n[0], n[1]);
  let b = rint(rng, n[0], n[1]);
  if (a === b) b += 1;
  const answer = a > b ? "A" : "B";
  return {
    id: randomId(rng),
    captcha: `which is larger? A=${a}, B=${b}. answer with A or B`,
    answer,
    kind: "compare",
    difficulty
  };
}

function generateOne(rng: () => number, style: GenerateRequest["style"], difficulty: "easy" | "medium" | "hard"): CaptchaItem {
  const kind = style === "mixed"
    ? pick(rng, ["math", "noisy", "sequence", "compare"] as const)
    : style;

  switch (kind) {
    case "math": return makeMath(rng, difficulty);
    case "noisy": return makeNoisy(rng, difficulty);
    case "sequence": return makeSequence(rng, difficulty);
    case "compare": return makeCompare(rng, difficulty);
    default: return makeMath(rng, difficulty);
  }
}

export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === "GET" && url.pathname === "/") {
      return json({
        name: "Proof of Claw",
        ok: true,
        endpoints: ["POST /v1/generate"]
      });
    }

    if (req.method === "POST" && url.pathname === "/v1/generate") {
      let body: GenerateRequest = {};
      try { body = await req.json(); } catch { /* empty -> defaults */ }

      const difficulty = (body.difficulty ?? "easy");
      const style = (body.style ?? "mixed");
      const count = clamp(Number(body.count ?? 5), 1, 50);

      if (!["easy", "medium", "hard"].includes(difficulty)) {
        return json({ error: "difficulty must be easy|medium|hard" }, 400);
      }
      if (!["math", "noisy", "sequence", "compare", "mixed"].includes(style)) {
        return json({ error: "style must be math|noisy|sequence|compare|mixed" }, 400);
      }

      const rng = makeRng(body.seed);
      const captchas = Array.from({ length: count }, () => generateOne(rng, style, difficulty as any));

      return json({
        captchas,
        meta: {
          count: captchas.length,
          difficulty,
          style,
          deterministic: Boolean(body.seed)
        }
      });
    }

    return json({ error: "not found" }, 404);
  }
};
