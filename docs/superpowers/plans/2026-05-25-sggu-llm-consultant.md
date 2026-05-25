# Sggu Local LLM Consultant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a small local-LLM-backed "상담사 슥구" chat path that answers from the currently loaded Lost Ark character analysis and spec-up recommendation data without Python or external LLM APIs.

**Architecture:** Keep the first version server-mediated and local: the browser sends a user message plus current character data to a Next.js API route, and the route calls a local Ollama-compatible chat endpoint. Existing deterministic Lost Ark calculations remain in JavaScript; the local LLM only explains and prioritizes supplied data.

**Tech Stack:** Next.js 16 App Router, React 19, Node.js `node:test`, ES modules, native `fetch`, local Ollama chat API, existing Lost Ark normalizers and spec-up recommendation APIs.

---

## Scope

This plan intentionally starts small.

- Use no Python.
- Use no cloud LLM API.
- Use no persistent chat storage.
- Use no RAG ingestion yet.
- Use no vector DB yet.
- Add one local LLM provider path first: Ollama `/api/chat`.
- Keep all calculations in the existing app; the model only generates 상담 text.
- Show a clear error when the local LLM server is not running.

The RAG path comes after this works:

- Store patch notes and glossary as local documents.
- Chunk and embed them in Node.js.
- Retrieve relevant snippets during 상담.
- Pass retrieved snippets into the same local LLM prompt.

## Runtime Assumptions

The implementation should use these env vars:

```bash
LOCAL_LLM_PROVIDER=ollama
LOCAL_LLM_BASE_URL=http://localhost:11434
LOCAL_LLM_MODEL=qwen2.5:7b
LOCAL_LLM_TIMEOUT_MS=30000
```

If the user runs a different local model, only `LOCAL_LLM_MODEL` should need to change.

## File Structure

- Create `lib/consultant/sgguContext.js`: sanitize user input, trim conversation history, and build compact character/spec-up context.
- Create `tests/sgguContext.test.js`: test sanitization, conversation trimming, and context summary shape.
- Create `lib/consultant/sgguPrompt.js`: build stable Korean 슥구 instructions and local chat messages.
- Create `tests/sgguPrompt.test.js`: test prompt contract and dynamic context placement.
- Create `lib/llm/localLlmClient.js`: local Ollama client with timeout, text extraction, and normalized errors.
- Create `tests/localLlmClient.test.js`: test Ollama request body, response extraction, timeout/unavailable, and non-OK errors with fake fetch.
- Create `app/api/consult/sggu/route.js`: validate request, build context/prompt, call local LLM, and return normalized 상담 JSON.
- Create `tests/sgguConsultApi.test.js`: test invalid input, successful mocked local LLM response, and unavailable local LLM response.
- Create `lib/ui/sgguConsultantState.js`: pure message-state helpers for UI tests.
- Create `tests/sgguConsultantState.test.js`: test optimistic user message, assistant append, and error append behavior.
- Create `components/SgguConsultantChat.jsx`: reusable speech bubble/chat form component.
- Modify `app/page.jsx`: switch speech bubble from lookup-only to lookup-or-chat after armory is loaded.
- Modify `app/globals.css`: add compact chat transcript and user/error message styling.
- Modify `docs/development-log.md`: document local LLM env and first-run command.

## Task 1: Consultant Context Summary

**Files:**
- Create: `lib/consultant/sgguContext.js`
- Create: `tests/sgguContext.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/sgguContext.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSgguConsultantContext,
  normalizeConsultConversation,
  sanitizeConsultMessage
} from "../lib/consultant/sgguContext.js";

test("sanitizes consult message with max length", () => {
  assert.equal(sanitizeConsultMessage("  무기 먼저야?  "), "무기 먼저야?");
  assert.equal(sanitizeConsultMessage(""), "");
  assert.equal(sanitizeConsultMessage("가".repeat(900)).length, 800);
});

test("normalizes only recent user and assistant conversation turns", () => {
  const conversation = [
    { role: "system", text: "ignore" },
    { role: "user", text: "첫 질문" },
    { role: "sggu", text: "첫 답" },
    { role: "error", text: "network" },
    { role: "user", text: "둘째 질문" },
    { role: "assistant", text: "둘째 답" },
    { role: "user", text: "셋째 질문" }
  ];

  assert.deepEqual(normalizeConsultConversation(conversation, 4), [
    { role: "assistant", content: "첫 답" },
    { role: "user", content: "둘째 질문" },
    { role: "assistant", content: "둘째 답" },
    { role: "user", content: "셋째 질문" }
  ]);
});

test("builds compact character context from armory and recommendation", () => {
  const context = buildSgguConsultantContext({
    armory: {
      profile: {
        CharacterName: "붐버",
        ServerName: "루페온",
        CharacterClassName: "스카우터",
        ItemAvgLevel: "1700.00",
        CharacterLevel: 70,
        CombatPower: 123456789
      },
      equipment: [
        { Type: "무기", Name: "+11 세르카 고대 무기" },
        {
          Type: "목걸이",
          Name: "현재 목걸이",
          MainStatValue: 68000,
          SpecialOptionSummary: ["적에게 주는 피해 상", "추가 피해 중"]
        }
      ],
      engravings: [{ Name: "원한", Level: 3 }, { Name: "아드레날린", Level: 4 }],
      gems: [{ Name: "7레벨 겁화의 보석", SkillName: "라이징 스피어", Level: 7 }],
      avatars: [{ Type: "머리 아바타", Grade: "영웅", StatEffects: [{ Stat: "민첩", Value: 1 }] }]
    },
    specUpRecommendation: {
      Recommendation: {
        TopCandidates: [
          {
            Type: "weaponHoning",
            Label: "무기 11->12",
            NetCostGold: 100000,
            GainPercent: 0.3,
            EfficiencyScore: 0.3,
            Caveat: "노숨 기대비용 기준"
          }
        ]
      }
    }
  });

  assert.equal(context.profile.characterName, "붐버");
  assert.equal(context.profile.className, "스카우터");
  assert.equal(context.accessories[0].slot, "목걸이");
  assert.equal(context.accessories[0].specialOptions[0], "적에게 주는 피해 상");
  assert.equal(context.topSpecUps[0].label, "무기 11->12");
  assert.equal(context.engravingSummary, "원한 3, 아드레날린 4");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/sgguContext.test.js
```

Expected: FAIL with module-not-found for `../lib/consultant/sgguContext.js`.

- [ ] **Step 3: Implement context helpers**

Create `lib/consultant/sgguContext.js`:

```js
const MAX_MESSAGE_CHARS = 800;
const MAX_CONVERSATION_TURNS = 8;
const SUPPORTED_CONVERSATION_ROLES = new Set(["user", "assistant", "sggu"]);

function valueOf(source, keys, fallback = "") {
  if (!source) {
    return fallback;
  }

  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null && source[key] !== "") {
      return source[key];
    }
  }

  return fallback;
}

function listOf(source, keys) {
  const value = valueOf(source, keys, []);

  return Array.isArray(value) ? value : [];
}

function toNumber(value, fallback = null) {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

export function sanitizeConsultMessage(message) {
  return String(message || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_MESSAGE_CHARS);
}

export function normalizeConsultConversation(conversation, limit = MAX_CONVERSATION_TURNS) {
  return listOf({ conversation }, ["conversation"])
    .map((item) => {
      const rawRole = valueOf(item, ["role", "Role"], "");
      const role = rawRole === "sggu" ? "assistant" : rawRole;
      const content = sanitizeConsultMessage(valueOf(item, ["content", "text", "Text"], ""));

      if (!SUPPORTED_CONVERSATION_ROLES.has(rawRole) || !content) {
        return null;
      }

      return { role, content };
    })
    .filter(Boolean)
    .slice(-limit);
}

function summarizeEquipmentItem(item) {
  return {
    slot: valueOf(item, ["Type", "type"], ""),
    name: valueOf(item, ["Name", "name"], ""),
    mainStat: toNumber(valueOf(item, ["MainStatValue", "mainStatValue"], null), null),
    specialOptions: listOf(item, ["SpecialOptionSummary", "specialOptionSummary"]).slice(0, 4)
  };
}

function summarizeSpecUp(candidate) {
  return {
    type: valueOf(candidate, ["Type", "type"], ""),
    label: valueOf(candidate, ["Label", "label"], ""),
    target: valueOf(candidate, ["Target", "target"], ""),
    costGold: toNumber(valueOf(candidate, ["NetCostGold", "netCostGold", "CostGold", "costGold"], null), null),
    gainPercent: toNumber(valueOf(candidate, ["GainPercent", "gainPercent"], null), null),
    efficiencyScore: toNumber(valueOf(candidate, ["EfficiencyScore", "efficiencyScore"], null), null),
    caveat: valueOf(candidate, ["Caveat", "caveat"], "")
  };
}

export function buildSgguConsultantContext({ armory = null, specUpRecommendation = null } = {}) {
  const profile = valueOf(armory, ["profile"], {});
  const equipment = listOf(armory, ["equipment"]);
  const engravings = listOf(armory, ["engravings"]);
  const gems = listOf(armory, ["gems"]);
  const avatars = listOf(armory, ["avatars"]);
  const recommendation = valueOf(specUpRecommendation, ["Recommendation", "recommendation"], specUpRecommendation || {});
  const topCandidates = listOf(recommendation, ["TopCandidates", "topCandidates"]);

  return {
    profile: {
      characterName: valueOf(profile, ["CharacterName", "characterName"], ""),
      serverName: valueOf(profile, ["ServerName", "serverName"], ""),
      className: valueOf(profile, ["CharacterClassName", "characterClassName"], ""),
      itemLevel: valueOf(profile, ["ItemAvgLevel", "itemAvgLevel"], ""),
      combatLevel: valueOf(profile, ["CharacterLevel", "characterLevel"], ""),
      combatPower: toNumber(valueOf(profile, ["CombatPower", "combatPower"], null), null)
    },
    accessories: equipment
      .filter((item) => ["목걸이", "귀걸이", "반지", "팔찌"].includes(valueOf(item, ["Type", "type"], "")))
      .map(summarizeEquipmentItem),
    keyEquipment: equipment
      .filter((item) => ["무기", "투구", "어깨", "상의", "하의", "장갑"].includes(valueOf(item, ["Type", "type"], "")))
      .map(summarizeEquipmentItem),
    engravingSummary: engravings
      .map((engraving) => `${valueOf(engraving, ["Name", "name"], "")} ${valueOf(engraving, ["Level", "level"], "")}`.trim())
      .filter(Boolean)
      .join(", "),
    gemSummary: gems
      .map((gem) => `${valueOf(gem, ["SkillName", "skillName", "Name", "name"], "보석")} ${valueOf(gem, ["Level", "level"], "")}레벨`)
      .slice(0, 12),
    avatarSummary: avatars
      .map((avatar) => `${valueOf(avatar, ["Type", "type"], "")} ${valueOf(avatar, ["Grade", "grade"], "")}`.trim())
      .filter(Boolean)
      .slice(0, 8),
    topSpecUps: topCandidates.map(summarizeSpecUp).slice(0, 5)
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- tests/sgguContext.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/consultant/sgguContext.js tests/sgguContext.test.js
git commit -m "feat: add sggu consultant context"
```

## Task 2: Sggu Local Prompt Contract

**Files:**
- Create: `lib/consultant/sgguPrompt.js`
- Create: `tests/sgguPrompt.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/sgguPrompt.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { buildSgguChatMessages, SGGU_CONSULTANT_SYSTEM_PROMPT } from "../lib/consultant/sgguPrompt.js";

test("system prompt defines grounded Korean Lost Ark consultant behavior", () => {
  assert.match(SGGU_CONSULTANT_SYSTEM_PROMPT, /상담사 슥구/);
  assert.match(SGGU_CONSULTANT_SYSTEM_PROMPT, /제공된 데이터/);
  assert.match(SGGU_CONSULTANT_SYSTEM_PROMPT, /모르면/);
});

test("builds local chat messages with system first and context near current request", () => {
  const messages = buildSgguChatMessages({
    message: "뭐부터 올려?",
    conversation: [{ role: "assistant", content: "장비를 봤어." }],
    context: {
      profile: { characterName: "붐버", className: "스카우터" },
      topSpecUps: [{ label: "무기 11->12", costGold: 100000, gainPercent: 0.3 }]
    }
  });

  assert.equal(messages[0].role, "system");
  assert.equal(messages[1].role, "assistant");
  assert.equal(messages.at(-1).role, "user");
  assert.match(messages.at(-1).content, /캐릭터 데이터/);
  assert.match(messages.at(-1).content, /붐버/);
  assert.match(messages.at(-1).content, /뭐부터 올려\?/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/sgguPrompt.test.js
```

Expected: FAIL with module-not-found for `../lib/consultant/sgguPrompt.js`.

- [ ] **Step 3: Implement local chat prompt builder**

Create `lib/consultant/sgguPrompt.js`:

```js
export const SGGU_CONSULTANT_SYSTEM_PROMPT = [
  "너는 로스트아크 성장 상담사 슥구다.",
  "한국어로 짧고 명확하게 답한다.",
  "제공된 데이터와 계산 결과만 근거로 삼는다.",
  "데이터에 없는 내용은 모르면 모른다고 말한다.",
  "가격, 효율, 전투력 상승 수치는 제공된 값만 사용한다.",
  "추천은 비용 대비 효율, 현재 장착 상태, 계산 caveat를 함께 설명한다.",
  "답변은 2~5문장 또는 짧은 bullet로 제한한다.",
  "유저가 다음 행동을 묻는 경우 가장 먼저 할 1개 행동을 분명히 말한다."
].join("\\n");

export function buildSgguChatMessages({ message, conversation = [], context = {} } = {}) {
  const contextJson = JSON.stringify(context, null, 2);

  return [
    { role: "system", content: SGGU_CONSULTANT_SYSTEM_PROMPT },
    ...conversation,
    {
      role: "user",
      content: [
        "아래 캐릭터 데이터와 스펙업 후보만 근거로 답해줘.",
        "",
        "[캐릭터 데이터]",
        contextJson,
        "",
        "[유저 질문]",
        message
      ].join("\\n")
    }
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- tests/sgguPrompt.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/consultant/sgguPrompt.js tests/sgguPrompt.test.js
git commit -m "feat: add sggu local prompt"
```

## Task 3: Local Ollama Client

**Files:**
- Create: `lib/llm/localLlmClient.js`
- Create: `tests/localLlmClient.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/localLlmClient.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  LocalLlmError,
  createLocalLlmClient,
  extractOllamaChatText,
  normalizeLocalLlmBaseUrl
} from "../lib/llm/localLlmClient.js";

test("normalizes local llm base url", () => {
  assert.equal(normalizeLocalLlmBaseUrl("http://localhost:11434/"), "http://localhost:11434");
  assert.equal(normalizeLocalLlmBaseUrl(""), "http://localhost:11434");
});

test("extracts text from ollama chat payload", () => {
  assert.equal(extractOllamaChatText({ message: { content: "좋아. 목걸이부터 봐." } }), "좋아. 목걸이부터 봐.");
});

test("posts ollama chat request with model and non-streaming messages", async () => {
  const requests = [];
  const client = createLocalLlmClient({
    provider: "ollama",
    baseUrl: "http://localhost:11434",
    model: "qwen2.5:7b",
    fetchImpl: async (url, options) => {
      requests.push({ url, options });

      return new Response(JSON.stringify({
        model: "qwen2.5:7b",
        message: { role: "assistant", content: "지금은 악세부터 봐." },
        prompt_eval_count: 100,
        eval_count: 20
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
  });

  const result = await client.createChatCompletion({
    messages: [{ role: "user", content: "뭐부터 올려?" }]
  });

  assert.equal(result.text, "지금은 악세부터 봐.");
  assert.equal(requests[0].url, "http://localhost:11434/api/chat");
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    model: "qwen2.5:7b",
    messages: [{ role: "user", content: "뭐부터 올려?" }],
    stream: false,
    options: {
      temperature: 0.2,
      num_predict: 700
    }
  });
});

test("throws unavailable error when local server fetch fails", async () => {
  const client = createLocalLlmClient({
    fetchImpl: async () => {
      throw new TypeError("fetch failed");
    }
  });

  await assert.rejects(
    () => client.createChatCompletion({ messages: [{ role: "user", content: "x" }] }),
    (error) => error instanceof LocalLlmError && error.code === "LOCAL_LLM_UNAVAILABLE"
  );
});

test("throws normalized error for non-ok response", async () => {
  const client = createLocalLlmClient({
    fetchImpl: async () => new Response(JSON.stringify({ error: "model not found" }), { status: 404 })
  });

  await assert.rejects(
    () => client.createChatCompletion({ messages: [{ role: "user", content: "x" }] }),
    (error) => error instanceof LocalLlmError && error.status === 404 && /model not found/.test(error.message)
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/localLlmClient.test.js
```

Expected: FAIL with module-not-found for `../lib/llm/localLlmClient.js`.

- [ ] **Step 3: Implement Ollama client**

Create `lib/llm/localLlmClient.js`:

```js
const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";
const DEFAULT_MODEL = "qwen2.5:7b";

export class LocalLlmError extends Error {
  constructor(message, { status = 0, code = "LOCAL_LLM_ERROR" } = {}) {
    super(message);
    this.name = "LocalLlmError";
    this.status = status;
    this.code = code;
  }
}

export function normalizeLocalLlmBaseUrl(baseUrl) {
  return String(baseUrl || DEFAULT_OLLAMA_BASE_URL).replace(/\/+$/, "");
}

export function extractOllamaChatText(payload) {
  return String(payload?.message?.content || "").trim();
}

async function parseJsonResponse(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export function createLocalLlmClient({
  provider = process.env.LOCAL_LLM_PROVIDER || "ollama",
  baseUrl = process.env.LOCAL_LLM_BASE_URL || DEFAULT_OLLAMA_BASE_URL,
  model = process.env.LOCAL_LLM_MODEL || DEFAULT_MODEL,
  timeoutMs = Number(process.env.LOCAL_LLM_TIMEOUT_MS || 30000),
  fetchImpl = fetch
} = {}) {
  if (provider !== "ollama") {
    throw new LocalLlmError(`Unsupported local LLM provider: ${provider}`, {
      status: 0,
      code: "UNSUPPORTED_LOCAL_LLM_PROVIDER"
    });
  }

  async function createChatCompletion({ messages }) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(`${normalizeLocalLlmBaseUrl(baseUrl)}/api/chat`, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          options: {
            temperature: 0.2,
            num_predict: 700
          }
        }),
        signal: controller.signal
      });
      const payload = await parseJsonResponse(response);

      if (!response.ok) {
        throw new LocalLlmError(payload?.error || `Local LLM API ${response.status}`, {
          status: response.status
        });
      }

      return {
        provider,
        model: payload.model || model,
        text: extractOllamaChatText(payload),
        usage: {
          promptTokens: payload.prompt_eval_count ?? null,
          outputTokens: payload.eval_count ?? null
        },
        raw: payload
      };
    } catch (error) {
      if (error instanceof LocalLlmError) {
        throw error;
      }

      throw new LocalLlmError("로컬 LLM 서버에 연결하지 못했어. Ollama가 켜져 있는지 확인해줘.", {
        status: 503,
        code: "LOCAL_LLM_UNAVAILABLE"
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return { createChatCompletion };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- tests/localLlmClient.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/llm/localLlmClient.js tests/localLlmClient.test.js
git commit -m "feat: add local llm client"
```

## Task 4: Sggu Consultant API Route

**Files:**
- Create: `app/api/consult/sggu/route.js`
- Create: `tests/sgguConsultApi.test.js`

- [ ] **Step 1: Write failing route tests**

Create `tests/sgguConsultApi.test.js`:

```js
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next/server") {
      return nextResolve("next/server.js", context);
    }

    return nextResolve(specifier, context);
  }
});

const { POST } = await import("../app/api/consult/sggu/route.js");

test("returns 400 for empty message", async () => {
  const response = await POST(new Request("http://localhost/api/consult/sggu", {
    method: "POST",
    body: JSON.stringify({ message: " " })
  }));
  const data = await response.json();

  assert.equal(response.status, 400);
  assert.equal(data.code, "INVALID_MESSAGE");
});

test("returns consultant answer from mocked local llm response", async () => {
  const previousFetch = globalThis.fetch;
  const requests = [];

  process.env.LOCAL_LLM_MODEL = "qwen2.5:7b";
  globalThis.fetch = async (url, options) => {
    requests.push({ url, body: JSON.parse(options.body) });

    return new Response(JSON.stringify({
      model: "qwen2.5:7b",
      message: { role: "assistant", content: "지금은 목걸이부터 봐." },
      prompt_eval_count: 123,
      eval_count: 20
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  try {
    const response = await POST(new Request("http://localhost/api/consult/sggu", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: "뭐부터 올려?",
        conversation: [],
        armory: {
          profile: { CharacterName: "붐버", CharacterClassName: "스카우터" },
          equipment: [],
          engravings: [],
          gems: [],
          avatars: []
        },
        specUpRecommendation: {
          Recommendation: {
            TopCandidates: [{ Label: "목걸이 교체", NetCostGold: 10000, GainPercent: 0.5 }]
          }
        }
      })
    }));
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.Answer, "지금은 목걸이부터 봐.");
    assert.equal(data.Provider, "ollama");
    assert.equal(requests[0].url, "http://localhost:11434/api/chat");
    assert.match(requests[0].body.messages.at(-1).content, /붐버/);
  } finally {
    globalThis.fetch = previousFetch;
    delete process.env.LOCAL_LLM_MODEL;
  }
});

test("returns 503 when local llm server is unavailable", async () => {
  const previousFetch = globalThis.fetch;

  globalThis.fetch = async () => {
    throw new TypeError("fetch failed");
  };

  try {
    const response = await POST(new Request("http://localhost/api/consult/sggu", {
      method: "POST",
      body: JSON.stringify({ message: "뭐부터 올려?", armory: { profile: { CharacterName: "붐버" } } })
    }));
    const data = await response.json();

    assert.equal(response.status, 503);
    assert.equal(data.code, "LOCAL_LLM_UNAVAILABLE");
  } finally {
    globalThis.fetch = previousFetch;
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/sgguConsultApi.test.js
```

Expected: FAIL with module-not-found for `../app/api/consult/sggu/route.js`.

- [ ] **Step 3: Implement route**

Create `app/api/consult/sggu/route.js`:

```js
import { NextResponse } from "next/server";
import {
  buildSgguConsultantContext,
  normalizeConsultConversation,
  sanitizeConsultMessage
} from "../../../../lib/consultant/sgguContext.js";
import { buildSgguChatMessages } from "../../../../lib/consultant/sgguPrompt.js";
import { createLocalLlmClient, LocalLlmError } from "../../../../lib/llm/localLlmClient.js";

export const runtime = "nodejs";

const ERROR_CODES = {
  INVALID_MESSAGE: "INVALID_MESSAGE",
  LOCAL_LLM_UNAVAILABLE: "LOCAL_LLM_UNAVAILABLE",
  LOCAL_LLM_ERROR: "LOCAL_LLM_ERROR"
};

function jsonError(code, message, status) {
  return NextResponse.json({ code, message }, { status });
}

async function readBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export async function POST(request) {
  const body = await readBody(request);
  const message = sanitizeConsultMessage(body?.message);

  if (!message) {
    return jsonError(ERROR_CODES.INVALID_MESSAGE, "상담할 내용을 입력해줘.", 400);
  }

  try {
    const conversation = normalizeConsultConversation(body?.conversation);
    const context = buildSgguConsultantContext({
      armory: body?.armory,
      specUpRecommendation: body?.specUpRecommendation
    });
    const messages = buildSgguChatMessages({ message, conversation, context });
    const client = createLocalLlmClient();
    const result = await client.createChatCompletion({ messages });

    return NextResponse.json({
      Answer: result.text || "지금은 답변을 만들지 못했어. 질문을 조금 더 구체적으로 해줘.",
      Provider: result.provider,
      Model: result.model,
      Usage: result.usage
    });
  } catch (error) {
    if (error instanceof LocalLlmError && error.code === ERROR_CODES.LOCAL_LLM_UNAVAILABLE) {
      return jsonError(
        ERROR_CODES.LOCAL_LLM_UNAVAILABLE,
        error.message,
        503
      );
    }

    console.error(error);

    return jsonError(
      ERROR_CODES.LOCAL_LLM_ERROR,
      "슥구 로컬 LLM 상담 응답을 만들지 못했어.",
      502
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- tests/sgguConsultApi.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/consult/sggu/route.js tests/sgguConsultApi.test.js
git commit -m "feat: add sggu local consultant api"
```

## Task 5: UI Message State Helpers

**Files:**
- Create: `lib/ui/sgguConsultantState.js`
- Create: `tests/sgguConsultantState.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/sgguConsultantState.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  appendAssistantMessage,
  appendErrorMessage,
  appendUserMessage,
  createInitialConsultMessages
} from "../lib/ui/sgguConsultantState.js";

test("creates lookup mode starter message", () => {
  assert.deepEqual(createInitialConsultMessages(), [
    { role: "sggu", text: "캐릭터명을 입력해봐. 공식 API 기준으로 장비, 아크패시브, 스킬부터 정리해줄게." }
  ]);
});

test("appends user and assistant messages", () => {
  const messages = createInitialConsultMessages();
  const afterUser = appendUserMessage(messages, "뭐부터 올려?");
  const afterAssistant = appendAssistantMessage(afterUser, "목걸이부터 봐.");

  assert.equal(afterUser.at(-1).role, "user");
  assert.equal(afterAssistant.at(-1).text, "목걸이부터 봐.");
});

test("limits transcript size and appends errors", () => {
  const messages = Array.from({ length: 20 }, (_, index) => ({ role: "user", text: `m${index}` }));
  const next = appendErrorMessage(messages, "실패");

  assert.equal(next.length, 12);
  assert.equal(next.at(-1).role, "error");
  assert.equal(next.at(-1).text, "실패");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/sgguConsultantState.test.js
```

Expected: FAIL with module-not-found for `../lib/ui/sgguConsultantState.js`.

- [ ] **Step 3: Implement state helpers**

Create `lib/ui/sgguConsultantState.js`:

```js
const MAX_VISIBLE_MESSAGES = 12;

export function createInitialConsultMessages() {
  return [
    {
      role: "sggu",
      text: "캐릭터명을 입력해봐. 공식 API 기준으로 장비, 아크패시브, 스킬부터 정리해줄게."
    }
  ];
}

function trimMessages(messages) {
  return messages.slice(-MAX_VISIBLE_MESSAGES);
}

export function appendUserMessage(messages, text) {
  return trimMessages([...messages, { role: "user", text }]);
}

export function appendAssistantMessage(messages, text) {
  return trimMessages([...messages, { role: "sggu", text }]);
}

export function appendErrorMessage(messages, text) {
  return trimMessages([...messages, { role: "error", text }]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- tests/sgguConsultantState.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/ui/sgguConsultantState.js tests/sgguConsultantState.test.js
git commit -m "feat: add sggu chat state helpers"
```

## Task 6: Reusable Consultant Chat Component

**Files:**
- Create: `components/SgguConsultantChat.jsx`
- Modify: `app/page.jsx`

- [ ] **Step 1: Create chat component**

Create `components/SgguConsultantChat.jsx`:

```jsx
export default function SgguConsultantChat({
  messages,
  input,
  onInputChange,
  onSubmit,
  isLoading,
  isConsulting,
  hasArmory
}) {
  return (
    <div className="speech-bubble">
      <span className="bubble-puff puff-one" aria-hidden="true" />
      <span className="bubble-puff puff-two" aria-hidden="true" />
      <span className="bubble-puff puff-three" aria-hidden="true" />
      <span className="bubble-puff puff-four" aria-hidden="true" />
      <div className="bubble-kicker" aria-hidden="true">
        <span className="bubble-kicker-dot" />
        슥구 상담소
      </div>
      <div className="message-log consultant-message-log" aria-live="polite">
        {messages.map((message, index) => (
          <div className={`message ${message.role}`} key={`${message.role}-${index}-${message.text}`}>
            {message.text}
          </div>
        ))}
      </div>

      <form className="chat-form" onSubmit={onSubmit}>
        <label className="sr-only" htmlFor="consult-input">
          {hasArmory ? "슥구에게 질문 입력" : "조회할 로스트아크 캐릭터명 입력"}
        </label>
        <input
          id="consult-input"
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          placeholder={hasArmory ? "슥구에게 물어봐" : "캐릭터명을 입력해줘"}
          autoComplete="off"
        />
        <button type="submit" disabled={isLoading || isConsulting}>
          {isLoading ? "조회중" : isConsulting ? "상담중" : hasArmory ? "상담" : "조회"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Modify home page imports**

Modify the top of `app/page.jsx`:

```jsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import ArmoryView from "../components/ArmoryView.jsx";
import SgguConsultantChat from "../components/SgguConsultantChat.jsx";
import WelcomeScene from "../components/WelcomeScene.jsx";
import {
  appendAssistantMessage,
  appendErrorMessage,
  appendUserMessage,
  createInitialConsultMessages
} from "../lib/ui/sgguConsultantState.js";
import { resolveAnalysisCharacterName } from "../lib/ui/efficiencyNavigation.js";
```

- [ ] **Step 3: Replace starter messages and add consultation state**

In `app/page.jsx`, remove the local `starterMessages` constant and initialize state like this:

```jsx
const [messages, setMessages] = useState(() => createInitialConsultMessages());
const [input, setInput] = useState("");
const [armory, setArmory] = useState(null);
const [specUpRecommendation, setSpecUpRecommendation] = useState(null);
const [isLoading, setIsLoading] = useState(false);
const [isConsulting, setIsConsulting] = useState(false);
const [hasEntered, setHasEntered] = useState(false);
const [isCheckingRoute, setIsCheckingRoute] = useState(true);
const autoLoadStartedRef = useRef(false);
```

- [ ] **Step 4: Store spec-up summary after character load**

Inside `loadCharacter`, after `setArmory(data);`, add:

```jsx
setSpecUpRecommendation(data?.upgradeEfficiency ? {
  Recommendation: {
    TopCandidates: data.upgradeEfficiency.Candidates?.slice(0, 5) || []
  }
} : null);
```

- [ ] **Step 5: Add local LLM consultation function**

Add this function inside `Home` in `app/page.jsx`:

```jsx
const askSggu = useCallback(async (question) => {
  if (!armory || isConsulting) {
    return;
  }

  const conversation = messages;

  setIsConsulting(true);
  setMessages((current) => appendUserMessage(current, question));
  setInput("");

  try {
    const response = await fetch("/api/consult/sggu", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: question,
        conversation,
        armory,
        specUpRecommendation
      })
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.message || "슥구 상담 응답을 만들지 못했어.");
    }

    setMessages((current) => appendAssistantMessage(current, data.Answer));
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : "슥구 상담 응답을 만들지 못했어.";
    setMessages((current) => appendErrorMessage(current, message));
  } finally {
    setIsConsulting(false);
  }
}, [armory, isConsulting, messages, specUpRecommendation]);
```

- [ ] **Step 6: Make submit dual-mode**

Replace `handleSubmit` in `app/page.jsx`:

```jsx
function handleSubmit(event) {
  event.preventDefault();

  const text = input.trim();

  if (!text || isLoading || isConsulting) {
    return;
  }

  if (armory) {
    askSggu(text);
    return;
  }

  loadCharacter(text);
}
```

- [ ] **Step 7: Replace speech bubble JSX**

In `app/page.jsx`, replace the whole `<div className="speech-bubble">...</div>` block with:

```jsx
<SgguConsultantChat
  messages={messages}
  input={input}
  onInputChange={setInput}
  onSubmit={handleSubmit}
  isLoading={isLoading}
  isConsulting={isConsulting}
  hasArmory={Boolean(armory)}
/>
```

- [ ] **Step 8: Run build to verify component wiring**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add app/page.jsx components/SgguConsultantChat.jsx
git commit -m "feat: wire sggu local consultant chat ui"
```

## Task 7: Chat Styling

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Add chat transcript styles**

Append these styles near the existing speech bubble/message styles in `app/globals.css`:

```css
.consultant-message-log {
  max-height: 260px;
  overflow: auto;
  padding-right: 4px;
  scrollbar-width: thin;
}

.message.user {
  align-self: flex-end;
  background: #20242b;
  color: #fff;
}

.message.sggu {
  align-self: flex-start;
}

.message.error {
  border: 1px solid rgba(185, 28, 28, 0.25);
  background: #fff1f2;
  color: #991b1b;
}
```

- [ ] **Step 2: Check for duplicate or conflicting selectors**

Run:

```bash
rg -n "consultant-message-log|message\\.user|message\\.sggu|message\\.error" app/globals.css
```

Expected: the new selectors appear once, except existing `.message.error` may appear if the app already had it. If duplicate `.message.error` exists, merge the declarations into the existing selector instead of keeping two blocks.

- [ ] **Step 3: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "style: polish sggu local chat"
```

## Task 8: Local LLM Docs and Final Verification

**Files:**
- Modify: `docs/development-log.md`

- [ ] **Step 1: Document local LLM setup**

Append this section to `docs/development-log.md`:

```md
## Sggu Local LLM Consultant Env

- `LOCAL_LLM_PROVIDER`: optional. Defaults to `ollama`.
- `LOCAL_LLM_BASE_URL`: optional. Defaults to `http://localhost:11434`.
- `LOCAL_LLM_MODEL`: optional. Defaults to `qwen2.5:7b`; set this to a model installed in Ollama.
- `LOCAL_LLM_TIMEOUT_MS`: optional. Defaults to `30000`.
- `LOSTARK_API_KEY` or `LOSTARK_OPEN_API_KEY`: still required for character lookup and market data.

First local run:

```bash
ollama serve
ollama pull qwen2.5:7b
npm run dev:restart
```

The LLM consultant receives a compact character/spec-up summary from the app and answers from that supplied data. It does not call Lost Ark APIs directly.
```

- [ ] **Step 2: Run focused tests**

Run:

```bash
npm test -- tests/sgguContext.test.js tests/sgguPrompt.test.js tests/localLlmClient.test.js tests/sgguConsultApi.test.js tests/sgguConsultantState.test.js
```

Expected: PASS.

- [ ] **Step 3: Run full test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 4: Run lint on touched files**

Run:

```bash
node node_modules/eslint/bin/eslint.js app/api/consult/sggu/route.js app/page.jsx components/SgguConsultantChat.jsx lib/consultant/sgguContext.js lib/consultant/sgguPrompt.js lib/llm/localLlmClient.js lib/ui/sgguConsultantState.js tests/sgguContext.test.js tests/sgguPrompt.test.js tests/localLlmClient.test.js tests/sgguConsultApi.test.js tests/sgguConsultantState.test.js
```

Expected: no output and exit code 0.

- [ ] **Step 5: Run production build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 6: Restart dev server**

Run:

```bash
npm run dev:restart
```

Expected: Next.js ready at `http://localhost:3000`.

- [ ] **Step 7: Manual smoke test**

Run local LLM first:

```bash
ollama serve
ollama pull qwen2.5:7b
```

Then in the browser:

1. Open `http://localhost:3000`.
2. Search a real character.
3. After the armory appears, type `지금 골드 효율 좋은 스펙업 하나만 말해줘`.
4. Expected: 슥구 answers in Korean, refers to the loaded character/spec-up context, and does not claim unsupported exact prices beyond visible app data.

- [ ] **Step 8: Manual unavailable-server smoke test**

Stop Ollama, then ask 슥구 a question.

Expected: the UI shows `로컬 LLM 서버에 연결하지 못했어. Ollama가 켜져 있는지 확인해줘.`

- [ ] **Step 9: Commit**

```bash
git add docs/development-log.md
git commit -m "docs: document sggu local llm env"
```

## Self-Review

Spec coverage:

- Local LLM only: Task 3 and Task 4 use Ollama `/api/chat` and no cloud API.
- No Python: all files are JavaScript/JSX/Markdown.
- Small start: no RAG, no persistence, no vector DB, no streaming.
- 상담사 슥구 UX: Task 6 and Task 7 wire the existing speech bubble into a chat surface.
- Grounded Lost Ark advice: Task 1 and Task 2 define compact context and prompt contract.
- Local server failure: Task 3 and Task 4 normalize unavailable Ollama errors.
- Verification: Task 8 defines focused tests, full tests, lint, build, server restart, and manual smoke tests.

Placeholder scan:

- No forbidden placeholder markers remain.
- Every code-writing step includes concrete code.

Type consistency:

- UI sends `message`, `conversation`, `armory`, and `specUpRecommendation`.
- API route reads those same fields.
- Context helper exports `sanitizeConsultMessage`, `normalizeConsultConversation`, and `buildSgguConsultantContext`.
- Prompt helper exports `SGGU_CONSULTANT_SYSTEM_PROMPT` and `buildSgguChatMessages`.
- Local LLM client exports `createLocalLlmClient`, `extractOllamaChatText`, `normalizeLocalLlmBaseUrl`, and `LocalLlmError`.
