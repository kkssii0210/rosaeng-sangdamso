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

const { POST: consultSggu } = await import("../app/api/consult/sggu/route.js");

const LOCAL_LLM_ENV_KEYS = [
  "LOCAL_LLM_PROVIDER",
  "LOCAL_LLM_BASE_URL",
  "LOCAL_LLM_MODEL",
  "LOCAL_LLM_TIMEOUT_MS"
];
const LOCAL_LLM_TEST_ENV = {
  LOCAL_LLM_PROVIDER: "ollama",
  LOCAL_LLM_BASE_URL: "http://localhost:11434",
  LOCAL_LLM_MODEL: "qwen2.5:7b",
  LOCAL_LLM_TIMEOUT_MS: "30000"
};

function createConsultRequest(body) {
  return new Request("http://localhost/api/consult/sggu", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function validArmory() {
  return {
    profile: {
      CharacterName: "붐버",
      ServerName: "루페온",
      CharacterClassName: "스카우터",
      ItemAvgLevel: "1700.00"
    }
  };
}

function setKnownLocalLlmEnv(overrides = {}) {
  const previousEnv = Object.fromEntries(
    LOCAL_LLM_ENV_KEYS.map((key) => [key, process.env[key]])
  );

  for (const [key, value] of Object.entries({ ...LOCAL_LLM_TEST_ENV, ...overrides })) {
    process.env[key] = value;
  }

  return () => {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}

function restoreFetchDescriptor(descriptor) {
  if (descriptor) {
    Object.defineProperty(globalThis, "fetch", descriptor);
  } else {
    delete globalThis.fetch;
  }
}

function setFetchMock(fetchImpl) {
  const previousFetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, "fetch");

  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    writable: true,
    value: fetchImpl
  });

  return () => restoreFetchDescriptor(previousFetchDescriptor);
}

test("sggu consult route returns INVALID_MESSAGE for an empty message", async () => {
  const restoreEnv = setKnownLocalLlmEnv();

  try {
    const response = await consultSggu(createConsultRequest({ message: "   " }));
    const data = await response.json();

    assert.equal(response.status, 400);
    assert.equal(data.code, "INVALID_MESSAGE");
    assert.equal(data.message, "상담할 내용을 입력해줘.");
  } finally {
    restoreEnv();
  }
});

test("sggu consult route returns INVALID_ARMORY before calling Ollama when armory is missing", async () => {
  const restoreEnv = setKnownLocalLlmEnv();
  const restoreFetch = setFetchMock(async () => {
    throw new Error("Ollama should not be called without armory");
  });

  try {
    const response = await consultSggu(createConsultRequest({ message: "상담해줘" }));
    const data = await response.json();

    assert.equal(response.status, 400);
    assert.equal(data.code, "INVALID_ARMORY");
    assert.equal(data.message, "캐릭터를 먼저 조회해줘.");
  } finally {
    restoreFetch();
    restoreEnv();
  }
});

test("sggu consult route rejects blank character names in direct armory payloads", async () => {
  const restoreEnv = setKnownLocalLlmEnv();
  const restoreFetch = setFetchMock(async () => {
    throw new Error("Ollama should not be called with blank character armory");
  });

  try {
    const response = await consultSggu(createConsultRequest({
      message: "상담해줘",
      armory: {
        profile: {
          CharacterName: "   "
        }
      }
    }));
    const data = await response.json();

    assert.equal(response.status, 400);
    assert.equal(data.code, "INVALID_ARMORY");
    assert.equal(data.message, "캐릭터를 먼저 조회해줘.");
  } finally {
    restoreFetch();
    restoreEnv();
  }
});

test("sggu consult route rejects empty compact context before calling Ollama", async () => {
  const restoreEnv = setKnownLocalLlmEnv();
  const restoreFetch = setFetchMock(async () => {
    throw new Error("Ollama should not be called with empty compact context");
  });

  try {
    const response = await consultSggu(createConsultRequest({
      message: "상담해줘",
      context: {}
    }));
    const data = await response.json();

    assert.equal(response.status, 400);
    assert.equal(data.code, "INVALID_ARMORY");
    assert.equal(data.message, "캐릭터를 먼저 조회해줘.");
  } finally {
    restoreFetch();
    restoreEnv();
  }
});

test("sggu consult route returns local LLM answer and sends context to Ollama chat", async () => {
  const restoreEnv = setKnownLocalLlmEnv();
  const seenRequests = [];

  const restoreFetch = setFetchMock(async (url, options = {}) => {
    seenRequests.push({
      url: String(url),
      body: JSON.parse(options.body || "{}")
    });

    return jsonResponse({
      message: { role: "assistant", content: "지금은 보석부터 올려." },
      prompt_eval_count: 12,
      eval_count: 7
    });
  });

  try {
    const response = await consultSggu(createConsultRequest({
      message: "뭐부터 올릴까?",
      conversation: [
        { role: "user", content: "현재 상태 봐줘" },
        { role: "sggu", content: "효율 후보를 먼저 볼게." }
      ],
      armory: {
        ...validArmory(),
        equipment: [
          {
            Type: "목걸이",
            Name: "테스트 목걸이",
            MainStatValue: 12000,
            SpecialOptionSummary: ["추피 상"]
          }
        ],
        gems: [{ SkillName: "라이징 스피어", Level: 10 }]
      },
      specUpRecommendation: {
        Recommendation: {
          TopCandidates: [
            {
              Type: "gem",
              Label: "10멸 라이징 스피어",
              NetCostGold: 300000,
              GainPercent: 2.5,
              EfficiencyScore: 0.83,
              Caveat: "시세 변동"
            }
          ]
        }
      }
    }));
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.Answer, "지금은 보석부터 올려.");
    assert.equal(data.Provider, "ollama");
    assert.equal(data.Model, "qwen2.5:7b");
    assert.deepEqual(data.Usage, { promptTokens: 12, outputTokens: 7 });
    assert.equal(seenRequests.length, 1);
    assert.equal(seenRequests[0].url, "http://localhost:11434/api/chat");
    assert.equal(seenRequests[0].body.model, "qwen2.5:7b");
    assert.equal(seenRequests[0].body.stream, false);
    assert.equal(seenRequests[0].body.messages.at(1).role, "user");
    assert.equal(seenRequests[0].body.messages.at(2).role, "assistant");
    assert.match(seenRequests[0].body.messages.at(-1).content, /"characterName": "붐버"/);
    assert.match(seenRequests[0].body.messages.at(-1).content, /"topSpecUps"/);
    assert.match(seenRequests[0].body.messages.at(-1).content, /뭐부터 올릴까\?/);
  } finally {
    restoreFetch();
    restoreEnv();
  }
});

test("sggu consult route accepts compact context without raw armory", async () => {
  const restoreEnv = setKnownLocalLlmEnv();
  const seenRequests = [];

  const restoreFetch = setFetchMock(async (_url, options = {}) => {
    seenRequests.push(JSON.parse(options.body || "{}"));

    return jsonResponse({
      message: { role: "assistant", content: "무기 강화부터 봐." }
    });
  });

  try {
    const response = await consultSggu(createConsultRequest({
      message: "뭐부터 올릴까?",
      conversation: [{ role: "sggu", content: "후보를 볼게." }],
      context: {
        profile: {
          characterName: "붐버",
          className: "스카우터"
        },
        topSpecUps: [{ label: "무기 11->12", gainPercent: 0.3 }]
      }
    }));
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.Answer, "무기 강화부터 봐.");
    assert.equal(seenRequests.length, 1);
    assert.match(seenRequests[0].messages.at(-1).content, /"characterName": "붐버"/);
    assert.match(seenRequests[0].messages.at(-1).content, /"label": "무기 11->12"/);
  } finally {
    restoreFetch();
    restoreEnv();
  }
});

test("sggu consult route returns LOCAL_LLM_UNAVAILABLE when local fetch fails", async () => {
  const restoreEnv = setKnownLocalLlmEnv();

  const restoreFetch = setFetchMock(async () => {
    throw new Error("connection refused");
  });

  try {
    const response = await consultSggu(createConsultRequest({ message: "상담해줘", armory: validArmory() }));
    const data = await response.json();

    assert.equal(response.status, 503);
    assert.equal(data.code, "LOCAL_LLM_UNAVAILABLE");
    assert.equal(data.message, "로컬 LLM 서버에 연결하지 못했어. Ollama가 켜져 있는지 확인해줘.");
  } finally {
    restoreFetch();
    restoreEnv();
  }
});

test("sggu consult route returns LOCAL_LLM_ERROR when local response has blank assistant text", async () => {
  const restoreEnv = setKnownLocalLlmEnv();
  const restoreFetch = setFetchMock(async () => jsonResponse({
    message: { role: "assistant", content: "   " }
  }));

  try {
    const response = await consultSggu(createConsultRequest({ message: "상담해줘", armory: validArmory() }));
    const data = await response.json();

    assert.equal(response.status, 502);
    assert.equal(data.code, "LOCAL_LLM_ERROR");
    assert.equal(data.message, "슥구 로컬 LLM 상담 응답을 만들지 못했어.");
  } finally {
    restoreFetch();
    restoreEnv();
  }
});

test("sggu consult route returns LOCAL_LLM_ERROR for unexpected local client errors", async () => {
  const restoreEnv = setKnownLocalLlmEnv();
  const previousFetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, "fetch");

  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    get() {
      throw new Error("unexpected client setup error");
    }
  });

  try {
    const response = await consultSggu(createConsultRequest({ message: "상담해줘", armory: validArmory() }));
    const data = await response.json();

    assert.equal(response.status, 502);
    assert.equal(data.code, "LOCAL_LLM_ERROR");
    assert.equal(data.message, "슥구 로컬 LLM 상담 응답을 만들지 못했어.");
  } finally {
    restoreFetchDescriptor(previousFetchDescriptor);
    restoreEnv();
  }
});
