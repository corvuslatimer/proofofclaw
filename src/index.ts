interface CaptchaItem {
  captcha: string;
  answer: string;
}

const corsHeaders = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type"
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data, null, 2), { status, headers: corsHeaders });

function makeRng() {
  let state = crypto.getRandomValues(new Uint32Array(1))[0];
  return () => {
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

function lightNoisy(text: string, rng: () => number): string {
  // intentionally light obfuscation only; no semantic puzzles
  const map: Record<string, string[]> = {
    a: ["a", "@"], e: ["e", "3"], i: ["i", "1"], o: ["o", "0"], s: ["s", "5"], t: ["t", "7"]
  };
  let out = "";
  for (const ch of text) {
    const lower = ch.toLowerCase();
    if (map[lower] && rng() < 0.12) out += pick(rng, map[lower]);
    else out += rng() < 0.08 ? ch.toUpperCase() : ch.toLowerCase();
  }
  return out;
}

// Strict medium band only
const MIN = 10;
const MAX = 45;

function generateOne(rng: () => number): CaptchaItem {
  const a = rint(rng, MIN, MAX);
  const b = rint(rng, MIN, MAX);

  // Only 3 straightforward arithmetic families
  const mode = pick(rng, ["add", "subtract_from", "double_minus"] as const);

  let prompt = "";
  let answer = 0;

  if (mode === "add") {
    answer = a + b;
    prompt = pick(rng, [
      `add ${a} and ${b}`,
      `what is ${a} + ${b}?`
    ]);
  } else if (mode === "subtract_from") {
    answer = a - b;
    prompt = pick(rng, [
      `subtract ${b} from ${a}`,
      `what is ${a} - ${b}?`
    ]);
  } else {
    const x = rint(rng, 8, 30);
    const y = rint(rng, 6, 24);
    answer = x * 2 - y;
    prompt = pick(rng, [
      `double ${x} then subtract ${y}`,
      `compute (2 * ${x}) - ${y}`
    ]);
  }

  // mild obfuscation 50% of the time, never changes semantics
  const captcha = rng() < 0.5 ? lightNoisy(prompt, rng) : prompt;

  return { captcha, answer: String(answer) };
}

export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

    if (req.method === "GET" && url.pathname === "/") {
      return json({ name: "Proof of Claw", ok: true, endpoints: ["GET /generate"] });
    }

    if (req.method === "GET" && url.pathname === "/generate") {
      const rng = makeRng();
      const captcha = generateOne(rng);
      const context = "Proof of Claw blocks brittle human scripts with lightly obfuscated arithmetic prompts. Return only the final numeric value.";
      return json({ context, captcha: captcha.captcha, answer: captcha.answer });
    }

    return json({ error: "not found" }, 404);
  }
};
