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
  INVALID_ARMORY: "INVALID_ARMORY",
  LOCAL_LLM_UNAVAILABLE: "LOCAL_LLM_UNAVAILABLE",
  LOCAL_LLM_ERROR: "LOCAL_LLM_ERROR"
};

async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function errorResponse(code, message, status) {
  return NextResponse.json({ code, message }, { status });
}

export async function POST(request) {
  const body = await readJsonBody(request);
  const message = sanitizeConsultMessage(body?.message);

  if (!message) {
    return errorResponse(
      ERROR_CODES.INVALID_MESSAGE,
      "상담할 내용을 입력해줘.",
      400
    );
  }

  const context = buildSgguConsultantContext({
    armory: body?.armory,
    specUpRecommendation: body?.specUpRecommendation
  });

  if (!String(context.profile.characterName || "").trim()) {
    return errorResponse(
      ERROR_CODES.INVALID_ARMORY,
      "캐릭터를 먼저 조회해줘.",
      400
    );
  }

  const conversation = normalizeConsultConversation(body?.conversation);
  const messages = buildSgguChatMessages({ message, conversation, context });

  try {
    const client = createLocalLlmClient();
    const completion = await client.createChatCompletion({ messages });

    return NextResponse.json({
      Answer: completion.text,
      Provider: completion.provider,
      Model: completion.model,
      Usage: completion.usage
    });
  } catch (error) {
    if (error instanceof LocalLlmError && error.code === ERROR_CODES.LOCAL_LLM_UNAVAILABLE) {
      return errorResponse(error.code, error.message, 503);
    }

    if (error instanceof LocalLlmError) {
      return errorResponse(
        ERROR_CODES.LOCAL_LLM_ERROR,
        "슥구 로컬 LLM 상담 응답을 만들지 못했어.",
        502
      );
    }

    return errorResponse(
      ERROR_CODES.LOCAL_LLM_ERROR,
      "슥구 로컬 LLM 상담 응답을 만들지 못했어.",
      502
    );
  }
}
