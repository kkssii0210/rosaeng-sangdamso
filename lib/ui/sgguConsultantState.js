import { buildSgguConsultantContext } from "./sgguContext.js";

const MAX_VISIBLE_MESSAGES = 12;
const DEFAULT_CONSULT_ERROR_MESSAGE = "슥구 상담 응답을 불러오지 못했어.";
const consultErrorMessages = {
  LOCAL_LLM_UNAVAILABLE: "현재 슥구가 자고있슥니다."
};

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

export function getConsultErrorMessage(data, fallback = DEFAULT_CONSULT_ERROR_MESSAGE) {
  return consultErrorMessages[data?.code] || data?.message || fallback;
}

export function buildConsultRequestBody({ message, conversation, armory, specUpRecommendation } = {}) {
  return {
    message,
    conversation,
    context: buildSgguConsultantContext({ armory, specUpRecommendation })
  };
}
