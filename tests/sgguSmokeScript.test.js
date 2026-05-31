import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import test from "node:test";

function fallbackConsultation() {
  return {
    Mode: "main-chat",
    Source: "fallback",
    Mood: "steady",
    Empathy: "상담 기준으로 정리할게.",
    Diagnosis: "무기 강화가 우선 후보야.",
    Recommendation: "무기 11->12부터 보자.",
    Caution: "가격은 다시 확인해야 해.",
    NextAction: "재료 가격을 확인해줘.",
    DisplayText: "지금은 무기 11->12부터 보는 게 좋아."
  };
}

function llmConsultation() {
  return {
    ...fallbackConsultation(),
    Source: "llm",
    Provider: "ollama",
    Model: "qwen2.5:7b"
  };
}

async function withServer(handler, callback) {
  const server = http.createServer(handler);

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  try {
    const address = server.address();
    assert.equal(typeof address, "object");
    assert(address);

    return await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

function runSmoke(baseUrl, extraEnv = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["scripts/smoke-sggu-consult.mjs"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...extraEnv,
        SGGU_CONSULT_BASE_URL: baseUrl,
        SGGU_SMOKE_TIMEOUT_MS: "5000"
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

test("sggu smoke fails by default when consultation source is fallback", async () => {
  await withServer((request, response) => {
    assert.equal(request.method, "POST");
    assert.equal(request.url, "/api/consult/sggu");

    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(fallbackConsultation()));
  }, async (baseUrl) => {
    const result = await runSmoke(baseUrl);

    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /fallback/i);
  });
});

test("sggu smoke sends a distinct nonce so cached llm responses cannot prove connectivity", async () => {
  const nonces = [];

  await withServer((request, response) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      const payload = JSON.parse(body);

      nonces.push(payload.context?.smokeNonce);
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(llmConsultation()));
    });
  }, async (baseUrl) => {
    const first = await runSmoke(baseUrl);
    const second = await runSmoke(baseUrl);

    assert.equal(first.code, 0);
    assert.equal(second.code, 0);
    assert.equal(typeof nonces[0], "string");
    assert.equal(typeof nonces[1], "string");
    assert.notEqual(nonces[0], nonces[1]);
  });
});
