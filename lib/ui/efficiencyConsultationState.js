import { buildSgguConsultantContext } from "./sgguContext.js";

export const EFFICIENCY_CONSULT_MESSAGE = "전투력 효율 결과를 상담 카드로 요약해줘";

export function createEfficiencyConsultationState() {
  return {
    status: "idle",
    response: null,
    error: ""
  };
}

export function buildEfficiencyConsultRequestBody({ result } = {}) {
  return {
    mode: "efficiency-summary",
    message: EFFICIENCY_CONSULT_MESSAGE,
    conversation: [],
    context: buildSgguConsultantContext({
      armory: {
        profile: {
          CharacterName: result?.CharacterName || result?.Profile?.CharacterName || ""
        }
      },
      specUpRecommendation: result || null
    })
  };
}

export function resolveEfficiencyAdvisorMessage({ isLoading, result, consultation }) {
  if (isLoading) {
    return "슥구가 생각중이다.";
  }

  if (!result) {
    return "캐릭터의 현재 장비를 기준으로 전투력 효율을 계산할게. 아래 버튼을 누르면 최신 자료로 다시 맞춰볼 수 있어.";
  }

  if (consultation?.response?.DisplayText) {
    return consultation.response.DisplayText;
  }

  if (consultation?.status === "loading") {
    return "슥구가 결과를 정리하고 있어.";
  }

  if (consultation?.status === "fallback") {
    return "계산 결과는 정리됐어. 추천 후보의 비용과 전투력 상승폭을 먼저 비교해보자.";
  }

  return "슥구가 결과를 정리하고 있어.";
}
