import { buildSgguConsultantContext } from "../lib/ui/sgguContext.js";

const DEFAULT_BASE_URL = "http://127.0.0.1:3000";
const DEFAULT_MESSAGE = "지금 뭐부터 올릴까?";
const DEFAULT_TIMEOUT_MS = 45000;

function readOption(name, fallback) {
  const value = process.env[name];

  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function buildRequestBody(message) {
  const armory = {
    profile: {
      CharacterName: "스모크테스트",
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
        Name: "테스트 목걸이",
        MainStatValue: 68000,
        SpecialOptionSummary: ["적에게 주는 피해 상", "추가 피해 중"]
      }
    ],
    engravings: [{ Name: "원한", Level: 3 }, { Name: "아드레날린", Level: 4 }],
    gems: [{ Name: "7레벨 겁화의 보석", SkillName: "라이징 스피어", Level: 7 }],
    avatars: [{ Type: "머리 아바타", Grade: "영웅" }]
  };
  const specUpRecommendation = {
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
  };

  return {
    mode: "main-chat",
    message,
    conversation: [
      { role: "user", content: "현재 캐릭터 상태를 보고 우선순위를 알려줘." },
      { role: "sggu", content: "스펙업 후보와 현재 장비를 같이 볼게." }
    ],
    context: buildSgguConsultantContext({ armory, specUpRecommendation })
  };
}

async function main() {
  const baseUrl = readOption("SGGU_CONSULT_BASE_URL", DEFAULT_BASE_URL).replace(/\/+$/, "");
  const message = readOption("SGGU_SMOKE_MESSAGE", DEFAULT_MESSAGE);
  const timeoutMs = Number(readOption("SGGU_SMOKE_TIMEOUT_MS", String(DEFAULT_TIMEOUT_MS)));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}/api/consult/sggu`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json"
      },
      body: JSON.stringify(buildRequestBody(message)),
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(`${response.status} ${data?.code || "UNKNOWN_ERROR"}: ${data?.message || "No response message"}`);
    }

    const requiredFields = ["DisplayText", "Mode", "Source", "Diagnosis", "Recommendation", "NextAction"];
    const missingFields = requiredFields.filter((field) => typeof data?.[field] !== "string" || !data[field].trim());

    if (missingFields.length) {
      throw new Error(`200 OK but response did not include required structured field(s): ${missingFields.join(", ")}`);
    }

    console.log("Sggu consult smoke OK");
    console.log(`Provider: ${data.Provider || "unknown"}`);
    console.log(`Model: ${data.Model || "unknown"}`);
    console.log(`Source: ${data.Source.trim()}`);
    console.log(`DisplayText: ${data.DisplayText.trim()}`);
  } finally {
    clearTimeout(timeout);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);

  console.error("Sggu consult smoke FAILED");
  console.error(message);
  console.error("");
  console.error("Check: Next dev server is running, Spring Boot is running, Ollama is running, and LOCAL_LLM_BASE_URL points to Ollama from the Spring Boot process.");
  process.exitCode = 1;
});
