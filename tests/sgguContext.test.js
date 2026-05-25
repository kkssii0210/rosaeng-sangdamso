import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSgguConsultantContext,
  normalizeConsultConversation,
  sanitizeConsultMessage
} from "../lib/consultant/sgguContext.js";

test("sanitizes consult message with max length", () => {
  assert.equal(sanitizeConsultMessage("  무기 먼저야?  "), "무기 먼저야?");
  assert.equal(sanitizeConsultMessage("무기\n\t  먼저야?"), "무기 먼저야?");
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

const emptyConsultantContext = {
  profile: {
    characterName: "",
    serverName: "",
    className: "",
    itemLevel: "",
    combatLevel: "",
    combatPower: null
  },
  accessories: [],
  keyEquipment: [],
  arkPassiveSummary: {
    points: [],
    effects: []
  },
  skillSummary: [],
  engravingSummary: "",
  gemSummary: [],
  avatarSummary: [],
  topSpecUps: []
};

test("builds compact empty character context without inputs", () => {
  assert.deepEqual(buildSgguConsultantContext(), emptyConsultantContext);
});

test("builds compact empty character context from null input", () => {
  assert.deepEqual(buildSgguConsultantContext(null), emptyConsultantContext);
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
      arkPassive: {
        Points: [{ Name: "진화", Value: 120 }, { Name: "깨달음", Value: 96 }],
        Effects: [
          { Name: "진화", Description: "4티어 달인 Lv.1" },
          { Name: "깨달음", Description: "4티어 아르데타인의 기술 Lv.2" }
        ]
      },
      skills: [
        {
          Name: "라이징 스피어",
          Level: 14,
          Type: "일반",
          Rune: { Name: "질풍" },
          Tripods: [
            { Name: "빠른 준비", IsSelected: true },
            { Name: "강화된 일격", IsSelected: true },
            { Name: "무자비한 사격", IsSelected: false }
          ]
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
  assert.deepEqual(context.arkPassiveSummary.points, ["진화 120", "깨달음 96"]);
  assert.deepEqual(context.arkPassiveSummary.effects, ["진화 4티어 달인 Lv.1", "깨달음 4티어 아르데타인의 기술 Lv.2"]);
  assert.deepEqual(context.skillSummary, ["라이징 스피어 Lv.14 일반 질풍 빠른 준비/강화된 일격"]);
});

test("omits malformed gem summary level suffixes", () => {
  const context = buildSgguConsultantContext({
    armory: {
      gems: [
        { SkillName: "라이징 스피어" },
        { Name: "멸화의 보석" },
        {}
      ]
    }
  });

  assert.deepEqual(context.gemSummary, ["라이징 스피어", "멸화의 보석"]);
});
