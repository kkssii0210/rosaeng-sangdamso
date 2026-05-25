import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_OLLAMA_BASE_URL,
  LocalLlmError,
  createLocalLlmClient,
  extractOllamaChatText,
  normalizeLocalLlmBaseUrl
} from "../lib/llm/localLlmClient.js";

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function textResponse(body, status = 500) {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain" }
  });
}

test("normalizes local llm base url", () => {
  assert.equal(normalizeLocalLlmBaseUrl(), DEFAULT_OLLAMA_BASE_URL);
  assert.equal(normalizeLocalLlmBaseUrl(" http://localhost:11434/ "), DEFAULT_OLLAMA_BASE_URL);
  assert.equal(normalizeLocalLlmBaseUrl("http://localhost:11434///"), DEFAULT_OLLAMA_BASE_URL);
  assert.equal(normalizeLocalLlmBaseUrl("http://ollama:11434/api"), "http://ollama:11434/api");
});

test("extracts text from ollama chat payload", () => {
  assert.equal(
    extractOllamaChatText({
      message: {
        role: "assistant",
        content: "장비부터 올려."
      }
    }),
    "장비부터 올려."
  );
  assert.equal(extractOllamaChatText({ response: "fallback text" }), "fallback text");
  assert.equal(extractOllamaChatText(null), "");
});

test("posts ollama chat request with model and non-streaming messages", async () => {
  const calls = [];
  const fetchMock = async (url, options) => {
    calls.push({ url, options });

    return jsonResponse({
      message: { content: "무기 강화가 좋아." },
      prompt_eval_count: 12,
      eval_count: 34
    });
  };
  const messages = [{ role: "user", content: "뭐부터 올려?" }];
  const client = createLocalLlmClient({
    env: {
      LOCAL_LLM_PROVIDER: "ollama",
      LOCAL_LLM_BASE_URL: " http://localhost:11434/ ",
      LOCAL_LLM_MODEL: "test-model",
      LOCAL_LLM_TIMEOUT_MS: "5000"
    },
    fetch: fetchMock
  });

  const result = await client.createChatCompletion({ messages });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "http://localhost:11434/api/chat");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers.accept, "application/json");
  assert.equal(calls[0].options.headers["content-type"], "application/json");
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    model: "test-model",
    messages,
    stream: false,
    options: {
      temperature: 0.2,
      num_predict: 700
    }
  });
  assert.equal(calls[0].options.signal instanceof AbortSignal, true);
  assert.deepEqual(result, {
    provider: "ollama",
    model: "test-model",
    text: "무기 강화가 좋아.",
    usage: {
      promptTokens: 12,
      outputTokens: 34
    },
    raw: {
      message: { content: "무기 강화가 좋아." },
      prompt_eval_count: 12,
      eval_count: 34
    }
  });
});

test("treats null client options as defaults", () => {
  const client = createLocalLlmClient(null);

  assert.equal(client.provider, "ollama");
});

test("trims provider and throws normalized unsupported provider error", () => {
  const client = createLocalLlmClient({
    env: {
      LOCAL_LLM_PROVIDER: " ollama "
    },
    fetch: async () => jsonResponse({ message: { content: "ok" } })
  });

  assert.equal(client.provider, "ollama");
  assert.throws(
    () =>
      createLocalLlmClient({
        env: {
          LOCAL_LLM_PROVIDER: " openai "
        },
        fetch: async () => jsonResponse({ message: { content: "ok" } })
      }),
    (error) => {
      assert.equal(error instanceof LocalLlmError, true);
      assert.equal(error.code, "UNSUPPORTED_LOCAL_LLM_PROVIDER");
      return true;
    }
  );
});

test("throws malformed response error when successful response has no assistant text", async () => {
  const client = createLocalLlmClient({
    env: {},
    fetch: async () => jsonResponse({ message: { content: "   " } })
  });

  await assert.rejects(
    () => client.createChatCompletion({ messages: [{ role: "user", content: "질문" }] }),
    (error) => {
      assert.equal(error instanceof LocalLlmError, true);
      assert.equal(error.code, "LOCAL_LLM_MALFORMED_RESPONSE");
      return true;
    }
  );
});

test("throws unavailable error when local server fetch fails", async () => {
  const client = createLocalLlmClient({
    env: {},
    fetch: async () => {
      throw new TypeError("fetch failed");
    }
  });

  await assert.rejects(
    () => client.createChatCompletion({ messages: [{ role: "user", content: "질문" }] }),
    (error) => {
      assert.equal(error instanceof LocalLlmError, true);
      assert.equal(error.code, "LOCAL_LLM_UNAVAILABLE");
      assert.equal(error.message, "로컬 LLM 서버에 연결하지 못했어. Ollama가 켜져 있는지 확인해줘.");
      return true;
    }
  );
});

test("throws normalized error for non-ok response", async () => {
  const client = createLocalLlmClient({
    env: {},
    fetch: async () => jsonResponse({ error: "model not found" }, 404)
  });

  await assert.rejects(
    () => client.createChatCompletion({ messages: [{ role: "user", content: "질문" }] }),
    (error) => {
      assert.equal(error instanceof LocalLlmError, true);
      assert.equal(error.code, "LOCAL_LLM_REQUEST_FAILED");
      assert.equal(error.status, 404);
      assert.match(error.message, /model not found/);
      return true;
    }
  );
});

test("preserves non-json non-ok response body in error message", async () => {
  const client = createLocalLlmClient({
    env: {},
    fetch: async () => textResponse("ollama internal error", 500)
  });

  await assert.rejects(
    () => client.createChatCompletion({ messages: [{ role: "user", content: "질문" }] }),
    (error) => {
      assert.equal(error instanceof LocalLlmError, true);
      assert.equal(error.code, "LOCAL_LLM_REQUEST_FAILED");
      assert.equal(error.status, 500);
      assert.match(error.message, /ollama internal error/);
      return true;
    }
  );
});

test("falls back to default timeout for invalid timeout env value", async () => {
  const previousSetTimeout = globalThis.setTimeout;
  const previousClearTimeout = globalThis.clearTimeout;
  let timeoutDelay;
  const client = createLocalLlmClient({
    env: {
      LOCAL_LLM_TIMEOUT_MS: "not-a-number"
    },
    fetch: async () => jsonResponse({ message: { content: "ok" } })
  });

  globalThis.setTimeout = (_callback, delay) => {
    timeoutDelay = delay;

    return { timeoutId: "test" };
  };
  globalThis.clearTimeout = () => {};

  try {
    await client.createChatCompletion({ messages: [] });

    assert.equal(timeoutDelay, 30000);
  } finally {
    globalThis.setTimeout = previousSetTimeout;
    globalThis.clearTimeout = previousClearTimeout;
  }
});
