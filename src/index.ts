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

function toNoisy(text: string, rng: () => number): string {
  const map: Record<string, string[]> = {
    a: ["a", "A", "@"],
    e: ["e", "E", "3"],
    i: ["i", "I", "1"],
    o: ["o", "O", "0"],
    s: ["s", "S", "5"],
    t: ["t", "T", "7"]
  };

  let out = "";
  for (const ch of text) {
    const lower = ch.toLowerCase();

    if (map[lower] && rng() < 0.25) out += pick(rng, map[lower]);
    else out += rng() < 0.2 ? ch.toUpperCase() : ch.toLowerCase();

    if (rng() < 0.03) out += pick(rng, ["~", "^"]);
  }
  return out.trim();
}

// Tuned to avoid extremes: no ultra-hard giant arithmetic, no super-trivial tiny math.
const DEFAULT_RANGE = { n: [8, 55] } as const;

function makeMath(rng: () => number): CaptchaItem {
  const { n } = DEFAULT_RANGE;

  let a = rint(rng, n[0], n[1]);
  let b = rint(rng, n[0], n[1]);
  const op = pick(rng, ["+", "-"] as const);

  // avoid very easy cases (same numbers / tiny deltas)
  if (Math.abs(a - b) < 3) b += 4;

  const answer = op === "+" ? a + b : a - b;

  return {
    captcha: `what is ${a} ${op} ${b}?`,
    answer: String(answer)
  };
}


function makeAgentWordProblem(rng: () => number): CaptchaItem {
  const { n } = DEFAULT_RANGE;
  const a = rint(rng, n[0], n[1]);
  const b = rint(rng, n[0], n[1]);

  const nounsA = ["apples", "dogs", "cats", "books", "coins"];
  const nounsB = ["oranges", "cars", "chairs", "pens", "balls"];

  const left = pick(rng, nounsA);
  const right = pick(rng, nounsB);
  const mode = pick(rng, ["subtract_from", "add_to", "double_then_minus"] as const);

  let rawPrompt = "";
  let answer = 0;

  if (mode === "subtract_from") {
    answer = a - b;
    rawPrompt = pick(rng, [
      `subtract ${b} ${right} from ${a} ${left}`,
      `start with ${a} ${left} and remove ${b} ${right}`
    ]);
  } else if (mode === "add_to") {
    answer = a + b;
    rawPrompt = pick(rng, [
      `add ${b} ${right} to ${a} ${left}`,
      `you have ${a} ${left}, gain ${b} ${right}, total?`
    ]);
  } else {
    // keep this bounded so it doesn't become absurdly hard
    const x = rint(rng, 8, 35);
    const y = rint(rng, 6, 28);
    answer = x * 2 - y;
    rawPrompt = pick(rng, [
      `double ${x} ${left} then subtract ${y} ${right}`,
      `agent math: twice ${x}, minus ${y}`
    ]);
  }

  return {
    captcha: rawPrompt,
    answer: String(answer)
  };
}

function generateOne(rng: () => number): CaptchaItem {
  const family = pick(rng, ["math", "agent"] as const);
  const base = family === "agent" ? makeAgentWordProblem(rng) : makeMath(rng);
  // Always obfuscate lightly (never plain text)
  return { ...base, captcha: toNoisy(base.captcha, rng) };
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
      const context = "Proof of Claw is a captcha designed to block humans and brittle scripts while allowing reasoning agents and LLMs through. The next line is a slightly obfuscated math challenge. Return only the final numeric value.";

      return json({
        context,
        captcha: captcha.captcha,
        answer: captcha.answer
      });
    }

    return json({ error: "not found" }, 404);
  }
};
