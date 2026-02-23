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
  new Response(JSON.stringify(data, null, 2), {
    status,
    headers: corsHeaders
  });

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

function toNoisy(text: string, rng: () => number): string {
  const map: Record<string, string[]> = {
    a: ["a", "A", "@"], e: ["e", "E", "3"], i: ["i", "I", "1"],
    o: ["o", "O", "0"], s: ["s", "S", "5"], t: ["t", "T", "7"],
    l: ["l", "L", "1"], b: ["b", "B", "8"]
  };
  let out = "";
  for (const ch of text) {
    const lower = ch.toLowerCase();
    if (map[lower] && rng() < 0.45) out += pick(rng, map[lower]);
    else out += rng() < 0.4 ? ch.toUpperCase() : ch.toLowerCase();
    if (rng() < 0.09) out += pick(rng, ["~", "^", "'", " ", " "]);
  }
  return out.trim();
}

const DEFAULT_RANGE = { n: [1, 100], seqStart: [1, 40], step: [1, 12] } as const;

function makeMath(rng: () => number): CaptchaItem {
  const { n } = DEFAULT_RANGE;
  const a = rint(rng, n[0], n[1]);
  const b = rint(rng, n[0], n[1]);
  const op = pick(rng, ["+", "-", "*"] as const);
  const answer = op === "+" ? a + b : op === "-" ? a - b : a * b;
  return {
    captcha: `what is ${a} ${op} ${b}?`,
    answer: String(answer),
  };
}

function makeNoisy(rng: () => number): CaptchaItem {
  const base = makeMath(rng);
  return { ...base, captcha: toNoisy(base.captcha, rng) };
}

function makeSequence(rng: () => number): CaptchaItem {
  const { seqStart, step } = DEFAULT_RANGE;
  const start = rint(rng, seqStart[0], seqStart[1]);
  const d = rint(rng, step[0], step[1]);
  const len = 4;
  const arr = Array.from({ length: len }, (_, i) => start + i * d);
  return {
    captcha: `what comes next: ${arr.join(", ")}, ?`,
    answer: String(start + len * d),
  };
}

function makeCompare(rng: () => number): CaptchaItem {
  const { n } = DEFAULT_RANGE;
  const a = rint(rng, n[0], n[1]);
  let b = rint(rng, n[0], n[1]);
  if (a === b) b += 1;
  const answer = a > b ? "A" : "B";
  const prompt = pick(rng, [
    `which is larger? A=${a}, B=${b}. answer with A or B`,
    `pick the bigger value: A=${a} and B=${b}. return A or B`,
    `agent check: larger number? A=${a}, B=${b} (A/B only)`
  ]);
  return {
    captcha: prompt,
    answer,
  };
}

function makeAgentWordProblem(rng: () => number): CaptchaItem {
  const { n } = DEFAULT_RANGE;
  const a = rint(rng, n[0], n[1]);
  const b = rint(rng, n[0], n[1]);

  const nounsA = ["molties", "clawbots", "neotons", "shell-points", "reef-units"];
  const nounsB = ["moltbots", "clawlets", "drift-units", "shard-bits", "reeflets"];

  const left = pick(rng, nounsA);
  const right = pick(rng, nounsB);

  const mode = pick(rng, ["subtract_from", "add_to", "double_then_minus"] as const);

  let rawPrompt = "";
  let answer = 0;

  if (mode === "subtract_from") {
    answer = a - b;
    rawPrompt = pick(rng, [
      `subtract ${b} ${right} from ${a} ${left}`,
      `take ${a}${left} and remove ${b} ${right}`,
      `starting with ${a} ${left}, minus ${b}${right}`
    ]);
  } else if (mode === "add_to") {
    answer = a + b;
    rawPrompt = pick(rng, [
      `add ${b} ${right} to ${a} ${left}`,
      `you have ${a}${left}; gain ${b} ${right}. total?`,
      `${a} ${left} + ${b}${right} = ?`
    ]);
  } else {
    const x = rint(rng, Math.max(1, Math.floor(n[0] / 2)), n[1]);
    const y = rint(rng, Math.max(1, Math.floor(n[0] / 2)), n[1]);
    answer = x * 2 - y;
    rawPrompt = pick(rng, [
      `double ${x} ${left} then subtract ${y} ${right}`,
      `2*${x}${left} - ${y}${right} => ?`,
      `agent math: twice ${x}, minus ${y}`
    ]);
  }

  const noisy = rng() < 0.8 ? toNoisy(rawPrompt, rng) : rawPrompt;

  return {
    captcha: noisy,
    answer: String(answer),
  };
}

function generateOne(rng: () => number): CaptchaItem {
  const family = pick(rng, ["math", "noisy", "sequence", "compare", "agent"] as const);
  switch (family) {
    case "math": return makeMath(rng);
    case "noisy": return makeNoisy(rng);
    case "sequence": return makeSequence(rng);
    case "compare": return makeCompare(rng);
    case "agent": return makeAgentWordProblem(rng);
    default: return makeMath(rng);
  }
}

export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (req.method === "GET" && url.pathname === "/") {
      return json({
        name: "Proof of Claw",
        ok: true,
        endpoints: ["GET /generate"]
      });
    }

    if (req.method === "GET" && url.pathname === "/generate") {
      const rng = makeRng();
      const captcha = generateOne(rng);
      const preamble = "Proof of Claw is a captcha designed to block humans and brittle human scripts while allowing reasoning agents through.\nBefore you is a slightly obfuscated math-style problem. Answer with only the final value.";
      return json({
        captcha: `${preamble}\n\n${captcha.captcha}`,
        answer: captcha.answer
      });
    }

    return json({ error: "not found" }, 404);
  }
};
