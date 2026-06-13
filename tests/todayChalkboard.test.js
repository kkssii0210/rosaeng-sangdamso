import test from "node:test";
import assert from "node:assert/strict";
import { buildTodayChalkboardState } from "../lib/ui/todayChalkboard.js";

test("builds idle chalkboard copy before lookup", () => {
  const state = buildTodayChalkboardState({ status: "idle" });

  assert.equal(state.variant, "idle");
  assert.equal(state.title, "캐릭터명을 적으면 오늘의 강의가 시작됩니다.");
  assert.deepEqual(state.notes.map((note) => note.title), [
    "캐릭터명 입력",
    "공식 API 조회",
    "성장 우선순위 정리"
  ]);
  assert.equal(state.primaryActionLabel, "강의 시작");
});

test("builds loading chalkboard copy", () => {
  const state = buildTodayChalkboardState({ status: "loading" });

  assert.equal(state.variant, "loading");
  assert.equal(state.title, "슥구가 장비창을 펼쳐보는 중입니다.");
  assert.equal(state.description, "공식 API와 시장 데이터를 확인하고 있습니다.");
  assert.equal(state.notes.length, 3);
});

test("builds completed chalkboard copy from a top candidate", () => {
  const state = buildTodayChalkboardState({
    status: "ready",
    armory: {
      profile: {
        CharacterName: "붐버",
        CharacterClassName: "스카우터"
      }
    },
    specUpRecommendation: {
      Recommendation: {
        TopCandidates: [
          {
            Label: "겁화 보석 8레벨 -> 9레벨",
            NetCostGold: 92000,
            GainPercent: 1.28,
            Caveat: "경매장 최저가 기준"
          }
        ]
      }
    }
  });

  assert.equal(state.variant, "ready");
  assert.equal(state.kicker, "붐버 · 스카우터");
  assert.equal(state.title, "오늘은 보석부터 보는 게 좋겠습니다.");
  assert.deepEqual(state.notes.map((note) => note.value), [
    "겁화 보석 8레벨 -> 9레벨",
    "92,000골드",
    "+1.28%"
  ]);
  assert.equal(state.caution, "경매장 최저가 기준");
});

test("uses gem candidate type for completed chalkboard title", () => {
  const state = buildTodayChalkboardState({
    status: "ready",
    specUpRecommendation: {
      Recommendation: {
        TopCandidates: [
          {
            Type: "gem",
            Label: "라이징 스피어 7->8",
            NetCostGold: 45000,
            GainPercent: 0.72
          }
        ]
      }
    }
  });

  assert.equal(state.title, "오늘은 보석부터 보는 게 좋겠습니다.");
  assert.deepEqual(state.notes.map((note) => note.value), [
    "라이징 스피어 7->8",
    "45,000골드",
    "+0.72%"
  ]);
});

test("uses accessory candidate type for completed chalkboard title", () => {
  const state = buildTodayChalkboardState({
    status: "ready",
    specUpRecommendation: {
      Recommendation: {
        TopCandidates: [
          {
            Type: "accessory",
            Label: "고대 장신구 후보",
            NetCostGold: 120000,
            GainPercent: 1.01
          }
        ]
      }
    }
  });

  assert.equal(state.title, "악세 교체를 먼저 비교해봅시다.");
});

test("uses honing candidate type for completed chalkboard title", () => {
  const state = buildTodayChalkboardState({
    status: "ready",
    specUpRecommendation: {
      Recommendation: {
        TopCandidates: [
          {
            Type: "weaponHoning",
            Label: "상급 재련 11->12",
            NetCostGold: 250000,
            GainPercent: 0.46
          }
        ]
      }
    }
  });

  assert.equal(state.title, "강화 효율을 먼저 확인합시다.");
});

test("builds idle chalkboard copy from null input", () => {
  const state = buildTodayChalkboardState(null);

  assert.equal(state.variant, "idle");
  assert.equal(state.primaryActionLabel, "강의 시작");
});

test("uses direct top candidates when recommendation is already unwrapped", () => {
  const state = buildTodayChalkboardState({
    status: "ready",
    specUpRecommendation: {
      TopCandidates: [
        {
          Type: "gem",
          Label: "스킬 후보 7->8",
          NetCostGold: 33000,
          GainPercent: 0.64
        }
      ]
    }
  });

  assert.equal(state.title, "오늘은 보석부터 보는 게 좋겠습니다.");
  assert.equal(state.notes[0].value, "스킬 후보 7->8");
});

test("uses fallback completed copy without candidates", () => {
  const state = buildTodayChalkboardState({
    status: "ready",
    armory: { profile: { CharacterName: "붐버" } },
    specUpRecommendation: null
  });

  assert.equal(state.title, "지금은 가격을 다시 확인하는 편이 좋겠습니다.");
  assert.equal(state.notes[0].value, "추천 후보 없음");
});

test("maps lookup error codes to chalkboard copy", () => {
  assert.equal(
    buildTodayChalkboardState({ status: "error", errorCode: "CHARACTER_NOT_FOUND" }).title,
    "출석부에 없는 캐릭터입니다."
  );
  assert.equal(
    buildTodayChalkboardState({ status: "error", errorCode: "MISSING_API_KEY" }).title,
    "상담소 설정을 먼저 확인해야 합니다."
  );
  assert.equal(
    buildTodayChalkboardState({ status: "error", errorCode: "LOSTARK_API_ERROR" }).title,
    "공식 API가 잠시 불안정합니다."
  );
  assert.equal(
    buildTodayChalkboardState({ status: "error", errorCode: "UNKNOWN" }).title,
    "캐릭터 정보를 불러오지 못했습니다."
  );
});
