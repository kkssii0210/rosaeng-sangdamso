import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEfficiencyConsultRequestBody,
  createEfficiencyConsultationState,
  resolveEfficiencyAdvisorMessage
} from "../lib/ui/efficiencyConsultationState.js";

test("shows thinking copy while calculation is loading", () => {
  assert.equal(
    resolveEfficiencyAdvisorMessage({ isLoading: true, result: null, consultation: createEfficiencyConsultationState() }),
    "슥구가 생각중이다."
  );
});

test("shows consultation loading copy after calculation is ready", () => {
  assert.equal(
    resolveEfficiencyAdvisorMessage({
      isLoading: false,
      result: { CharacterName: "붐버" },
      consultation: { status: "loading", response: null, error: "" }
    }),
    "슥구가 결과를 정리하고 있어."
  );
});

test("shows consultation display text when ready", () => {
  assert.equal(
    resolveEfficiencyAdvisorMessage({
      isLoading: false,
      result: { CharacterName: "붐버" },
      consultation: {
        status: "ready",
        response: { DisplayText: "지금은 보석부터 보는 게 좋아." },
        error: ""
      }
    }),
    "지금은 보석부터 보는 게 좋아."
  );
});

test("builds efficiency-summary request body from calculation result", () => {
  const body = buildEfficiencyConsultRequestBody({
    result: {
      CharacterName: "붐버",
      Recommendation: {
        TopCandidates: [{ Label: "무기 11->12", NetCostGold: 100000 }]
      }
    }
  });

  assert.equal(body.mode, "efficiency-summary");
  assert.equal(body.message, "전투력 효율 결과를 상담 카드로 요약해줘");
  assert.equal(body.context.profile.characterName, "붐버");
  assert.equal(body.context.topSpecUps[0].label, "무기 11->12");
});
