export const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";
export const DEFAULT_MODEL = "qwen2.5:7b";

const UNAVAILABLE_MESSAGE = "로컬 LLM 서버에 연결하지 못했어. Ollama가 켜져 있는지 확인해줘.";

export class LocalLlmError extends Error {
  constructor(message, { code, status = null, payload = null, cause = null } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = "LocalLlmError";
    this.code = code;
    this.status = status;
    this.payload = payload;
  }
}

export function normalizeLocalLlmBaseUrl(baseUrl = DEFAULT_OLLAMA_BASE_URL) {
  const normalized = String(baseUrl || DEFAULT_OLLAMA_BASE_URL).trim().replace(/\/+$/, "");

  return normalized || DEFAULT_OLLAMA_BASE_URL;
}

export function extractOllamaChatText(payload) {
  if (typeof payload?.message?.content === "string") {
    return payload.message.content;
  }

  if (typeof payload?.response === "string") {
    return payload.response;
  }

  return "";
}

function parseTimeoutMs(value) {
  const timeoutMs = Number(value);

  return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 30000;
}

async function parseResponsePayload(response) {
  try {
    return {
      data: await response.clone().json(),
      text: null
    };
  } catch {
    try {
      return {
        data: null,
        text: await response.text()
      };
    } catch {
      return {
        data: null,
        text: null
      };
    }
  }
}

function getResponseErrorMessage(payload, bodyText, status) {
  if (typeof payload?.error === "string" && payload.error.trim()) {
    return payload.error;
  }

  if (typeof payload?.message === "string" && payload.message.trim()) {
    return payload.message;
  }

  if (typeof bodyText === "string" && bodyText.trim()) {
    return bodyText;
  }

  return `Local LLM request failed with status ${status}`;
}

function getUsage(payload) {
  return {
    promptTokens: Number.isFinite(payload?.prompt_eval_count) ? payload.prompt_eval_count : null,
    outputTokens: Number.isFinite(payload?.eval_count) ? payload.eval_count : null
  };
}

export function createLocalLlmClient(options = {}) {
  const clientOptions = options ?? {};
  const env = clientOptions.env ?? process.env;
  const fetchImpl = clientOptions.fetch ?? globalThis.fetch;
  const provider = String(env.LOCAL_LLM_PROVIDER || "ollama").trim() || "ollama";
  const baseUrl = normalizeLocalLlmBaseUrl(env.LOCAL_LLM_BASE_URL || DEFAULT_OLLAMA_BASE_URL);
  const model = env.LOCAL_LLM_MODEL || DEFAULT_MODEL;
  const timeoutMs = parseTimeoutMs(env.LOCAL_LLM_TIMEOUT_MS || 30000);

  if (provider !== "ollama") {
    throw new LocalLlmError(`Unsupported local LLM provider: ${provider}`, {
      code: "UNSUPPORTED_LOCAL_LLM_PROVIDER"
    });
  }

  if (typeof fetchImpl !== "function") {
    throw new LocalLlmError(UNAVAILABLE_MESSAGE, {
      code: "LOCAL_LLM_UNAVAILABLE"
    });
  }

  return {
    provider,
    model,
    async createChatCompletion({ messages } = {}) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetchImpl(`${baseUrl}/api/chat`, {
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
        const { data: raw, text: bodyText } = await parseResponsePayload(response);

        if (!response.ok) {
          throw new LocalLlmError(getResponseErrorMessage(raw, bodyText, response.status), {
            code: "LOCAL_LLM_REQUEST_FAILED",
            status: response.status,
            payload: raw ?? bodyText
          });
        }

        const text = extractOllamaChatText(raw);

        if (!text.trim()) {
          throw new LocalLlmError("Local LLM response did not include assistant text", {
            code: "LOCAL_LLM_MALFORMED_RESPONSE",
            payload: raw ?? bodyText
          });
        }

        return {
          provider,
          model,
          text,
          usage: getUsage(raw),
          raw
        };
      } catch (error) {
        if (error instanceof LocalLlmError) {
          throw error;
        }

        throw new LocalLlmError(UNAVAILABLE_MESSAGE, {
          code: "LOCAL_LLM_UNAVAILABLE",
          cause: error
        });
      } finally {
        clearTimeout(timeout);
      }
    }
  };
}
