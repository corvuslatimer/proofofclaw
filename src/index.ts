interface CaptchaItem {
  captcha: string;
  answer: string;
}

type Op =
  | { kind: "add"; n: number }
  | { kind: "sub"; n: number }
  | { kind: "mul"; n: number }
  | { kind: "divf"; n: number };

type Finalize =
  | { kind: "plain" }
  | { kind: "last_digit" }
  | { kind: "mod"; n: number }
  | { kind: "digits" };

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

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function maybe<T>(rng: () => number, p: number, value: T): T | "" {
  return rng() < p ? value : "";
}

function noisyNumber(n: number, rng: () => number): string {
  const base = String(n);
  if (base.length >= 4 && rng() < 0.35) {
    return base.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  if (rng() < 0.2 && n < 1000) {
    return base.padStart(3, "0");
  }
  return base;
}

function toNoisySurface(text: string, rng: () => number): string {
  const chMap: Record<string, string[]> = {
    a: ["a", "A", "@"],
    e: ["e", "E", "3"],
    i: ["i", "I", "1"],
    o: ["o", "O", "0"],
    s: ["s", "S", "5"],
    t: ["t", "T", "7"],
    x: ["x", "×"],
    "-": ["-", "−"]
  };

  let out = "";
  for (const ch of text) {
    const lower = ch.toLowerCase();
    if (chMap[lower] && rng() < 0.14) out += pick(rng, chMap[lower]);
    else if (/[a-z]/i.test(ch) && rng() < 0.12) out += rng() < 0.5 ? ch.toUpperCase() : ch.toLowerCase();
    else out += ch;
  }
  return out.replace(/\s+/g, " ").trim();
}

function applyOp(total: number, op: Op): number {
  switch (op.kind) {
    case "add":
      return total + op.n;
    case "sub":
      return total - op.n;
    case "mul":
      return total * op.n;
    case "divf":
      return Math.floor(total / op.n);
  }
}

function applyFinalize(total: number, fin: Finalize): number {
  switch (fin.kind) {
    case "plain":
      return total;
    case "last_digit":
      return Math.abs(total) % 10;
    case "mod":
      return ((total % fin.n) + fin.n) % fin.n;
    case "digits":
      return String(Math.abs(total)).length;
  }
}

function renderOp(op: Op, rng: () => number): string {
  const n = noisyNumber(op.n, rng);
  const noiseA = maybe(rng, 0.35, ` [salt:${String(rint(rng, 1, 99)).padStart(2, "0")}]`);
  const noiseB = maybe(rng, 0.25, ` [reef:${String(rint(rng, 1, 99)).padStart(2, "0")}]`);

  switch (op.kind) {
    case "add":
      return pick(rng, [
        `increase total by ${n}${noiseA}`,
        `add ${n} to total${noiseB}`
      ]);
    case "sub":
      return pick(rng, [
        `take ${n} away from total${noiseA}`,
        `decrease total by ${n}${noiseB}`
      ]);
    case "mul":
      return pick(rng, [
        `multiply total by ${n}${noiseA}`,
        `scale total by ${n}${noiseB}`
      ]);
    case "divf":
      return pick(rng, [
        `divide total by ${n} and keep floor${noiseA}`,
        `floor-divide total by ${n}${noiseB}`
      ]);
  }
}

function renderFinalize(fin: Finalize, rng: () => number): string {
  switch (fin.kind) {
    case "plain":
      return pick(rng, ["return the final number", "output only the final value"]);
    case "last_digit":
      return pick(rng, ["return only the last digit", "output the final last digit"]);
    case "mod":
      return pick(rng, [
        `return remainder mod ${noisyNumber(fin.n, rng)}`,
        `output total modulo ${noisyNumber(fin.n, rng)}`
      ]);
    case "digits":
      return pick(rng, ["return the number of digits", "output digit-count only"]);
  }
}

function generateProgram(rng: () => number): { init: number; ops: Op[]; fin: Finalize } {
  const init = rint(rng, 30, 180);
  const stepCount = rint(rng, 3, 4);
  const ops: Op[] = [];

  let running = init;
  for (let i = 0; i < stepCount; i++) {
    const kind = pick(rng, ["add", "sub", "mul", "divf"] as const);
    let op: Op;

    if (kind === "add") op = { kind, n: rint(rng, 6, 85) };
    else if (kind === "sub") op = { kind, n: rint(rng, 5, 75) };
    else if (kind === "mul") op = { kind, n: rint(rng, 2, 4) };
    else {
      const divisors = [2, 3, 4, 5, 6, 7, 8] as const;
      op = { kind, n: pick(rng, divisors) };
    }

    running = applyOp(running, op);
    if (Math.abs(running) > 100000) {
      op = { kind: "divf", n: pick(rng, [3, 4, 5, 6] as const) };
      running = applyOp(running, op);
    }

    ops.push(op);
  }

  const fin = pick(rng, [
    { kind: "last_digit" } as const,
    { kind: "mod", n: pick(rng, [7, 9, 11, 13] as const) } as const,
    { kind: "digits" } as const,
    { kind: "plain" } as const
  ]);

  return { init, ops, fin };
}

function evaluateProgram(init: number, ops: Op[], fin: Finalize): number {
  const total = ops.reduce((acc, op) => applyOp(acc, op), init);
  return applyFinalize(total, fin);
}

function makeCaptcha(rng: () => number): CaptchaItem {
  const { init, ops, fin } = generateProgram(rng);

  const parts = [
    `Given total=${noisyNumber(init, rng)}`,
    ...ops.map((op) => `then ${renderOp(op, rng)}`),
    `then ${renderFinalize(fin, rng)}.`
  ];

  const cleanSentence = parts.join("; ");
  const captcha = toNoisySurface(cleanSentence, rng);

  const answerNum = evaluateProgram(init, ops, fin);
  if (!Number.isFinite(answerNum)) {
    return makeCaptcha(makeRng());
  }

  return {
    captcha,
    answer: String(answerNum)
  };
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
      const captcha = makeCaptcha(rng);
      const context =
        "Proof of Claw is a captcha designed to block humans and brittle scripts while allowing reasoning agents and LLMs through. The next line is a single-sentence ordered math challenge. Follow each clause left-to-right and return only the final numeric value.";

      return json({
        context,
        captcha: captcha.captcha,
        answer: captcha.answer
      });
    }

    return json({ error: "not found" }, 404);
  }
};
