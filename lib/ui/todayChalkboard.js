const errorTitles = {
  CHARACTER_NOT_FOUND: "출석부에 없는 캐릭터입니다.",
  MISSING_API_KEY: "상담소 설정을 먼저 확인해야 합니다.",
  LOSTARK_API_ERROR: "공식 API가 잠시 불안정합니다."
};

function valueOf(source, keys, fallback = "") {
  if (!source) {
    return fallback;
  }

  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null && source[key] !== "") {
      return source[key];
    }
  }

  return fallback;
}

function formatGold(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0
    ? `${new Intl.NumberFormat("ko-KR").format(Math.round(number))}골드`
    : "가격 확인 필요";
}

function formatGain(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? `+${number.toFixed(2)}%` : "상승량 확인 필요";
}

function topCandidateOf(specUpRecommendation) {
  const candidates = specUpRecommendation?.Recommendation?.TopCandidates;
  return Array.isArray(candidates) && candidates.length > 0 ? candidates[0] : null;
}

function titleForCandidate(candidate) {
  const label = String(candidate?.Label || candidate?.label || "");

  if (/보석|겁화|작열|멸화|홍염/.test(label)) {
    return "오늘은 보석부터 보는 게 좋겠습니다.";
  }

  if (/악세|목걸이|귀걸이|반지/.test(label)) {
    return "악세 교체를 먼저 비교해봅시다.";
  }

  if (/강화|무기|방어구/.test(label)) {
    return "강화 효율을 먼저 확인합시다.";
  }

  return label ? `오늘의 1순위는 ${label}입니다.` : "지금은 가격을 다시 확인하는 편이 좋겠습니다.";
}

export function buildTodayChalkboardState({
  status = "idle",
  armory = null,
  specUpRecommendation = null,
  errorCode = ""
} = {}) {
  if (status === "loading") {
    return {
      variant: "loading",
      kicker: "자료 확인",
      title: "슥구가 장비창을 펼쳐보는 중입니다.",
      description: "공식 API와 시장 데이터를 확인하고 있습니다.",
      notes: [
        { title: "공식 API", value: "조회 중" },
        { title: "성장 후보", value: "정리 중" },
        { title: "상담 준비", value: "판서 중" }
      ],
      primaryActionLabel: "불러오는 중",
      secondaryActionLabel: ""
    };
  }

  if (status === "error") {
    return {
      variant: "error",
      kicker: "조회 실패",
      title: errorTitles[errorCode] || "캐릭터 정보를 불러오지 못했습니다.",
      description: "캐릭터명과 상담소 설정을 확인한 뒤 다시 조회하세요.",
      notes: [
        { title: "확인 1", value: "캐릭터명" },
        { title: "확인 2", value: "API 상태" },
        { title: "확인 3", value: "잠시 후 재시도" }
      ],
      primaryActionLabel: "다시 조회",
      secondaryActionLabel: ""
    };
  }

  if (status === "ready") {
    const profile = armory?.profile || {};
    const characterName = valueOf(profile, ["CharacterName", "characterName"], "캐릭터");
    const characterClassName = valueOf(profile, ["CharacterClassName", "characterClassName"], "");
    const candidate = topCandidateOf(specUpRecommendation);
    const label = candidate?.Label || candidate?.label || "추천 후보 없음";

    return {
      variant: "ready",
      kicker: characterClassName ? `${characterName} · ${characterClassName}` : characterName,
      title: titleForCandidate(candidate),
      description: "전투력 상승량과 예상 비용을 함께 본 결과입니다.",
      notes: [
        { title: "1순위", value: label },
        { title: "예상 비용", value: formatGold(valueOf(candidate, ["NetCostGold", "netCostGold"])) },
        { title: "예상 상승", value: formatGain(valueOf(candidate, ["GainPercent", "gainPercent"])) }
      ],
      caution: candidate?.Caveat || candidate?.caveat || "",
      primaryActionLabel: "스펙업 추천 보기",
      secondaryActionLabel: "슥구에게 질문하기"
    };
  }

  return {
    variant: "idle",
    kicker: "입장 준비",
    title: "캐릭터명을 적으면 오늘의 강의가 시작됩니다.",
    description: "장비, 보석, 각인, 스펙업 후보를 슥구가 칠판에 정리해드립니다.",
    notes: [
      { title: "캐릭터명 입력", value: "출석부에 이름 적기" },
      { title: "공식 API 조회", value: "장비창 확인" },
      { title: "성장 우선순위 정리", value: "오늘의 숙제 받기" }
    ],
    primaryActionLabel: "강의 시작",
    secondaryActionLabel: ""
  };
}
