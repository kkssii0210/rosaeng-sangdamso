import { stripMarkup } from "./equipment.js";

const ENGRAVING_ICONS = {
  "약자 무시": "https://lostarkcodex.com/icons/achieve_04_30.webp",
  "정기 흡수": "https://lostarkcodex.com/icons/buff_65.webp",
  "에테르 포식자": "https://lostarkcodex.com/icons/buff_74.webp",
  "안정된 상태": "https://lostarkcodex.com/icons/buff_105.webp",
  "원한": "https://lostarkcodex.com/icons/buff_71.webp",
  "슈퍼 차지": "https://lostarkcodex.com/icons/achieve_06_14.webp",
  "굳은 의지": "https://lostarkcodex.com/icons/buff_44.webp",
  "구슬동자": "https://lostarkcodex.com/icons/buff_18.webp",
  "위기 모면": "https://lostarkcodex.com/icons/buff_162.webp",
  "예리한 둔기": "https://lostarkcodex.com/icons/achieve_03_40.webp",
  "급소 타격": "https://lostarkcodex.com/icons/buff_168.webp",
  "최대 마나 증가": "https://lostarkcodex.com/icons/buff_122.webp",
  "마나 효율 증가": "https://lostarkcodex.com/icons/buff_166.webp",
  "탈출의 명수": "https://lostarkcodex.com/icons/buff_10.webp",
  "불굴": "https://lostarkcodex.com/icons/buff_66.webp",
  "분쇄의 주먹": "https://lostarkcodex.com/icons/buff_83.webp",
  "실드관통": "https://lostarkcodex.com/icons/buff_89.webp",
  "달인의 저력": "https://lostarkcodex.com/icons/buff_147.webp",
  "여신의 가호": "https://lostarkcodex.com/icons/buff_229.webp",
  "중갑 착용": "https://lostarkcodex.com/icons/buff_46.webp",
  "폭발물 전문가": "https://lostarkcodex.com/icons/buff_121.webp",
  "강화 방패": "https://lostarkcodex.com/icons/buff_239.webp",
  "강령술": "https://lostarkcodex.com/icons/buff_29.webp",
  "선수필승": "https://lostarkcodex.com/icons/achieve_08_62.webp",
  "부러진 뼈": "https://lostarkcodex.com/icons/buff_94.webp",
  "번개의 분노": "https://lostarkcodex.com/icons/buff_191.webp",
  "저주받은 인형": "https://lostarkcodex.com/icons/buff_237.webp",
  "승부사": "https://lostarkcodex.com/icons/buff_136.webp",
  "기습의 대가": "https://lostarkcodex.com/icons/buff_148.webp",
  "마나의 흐름": "https://lostarkcodex.com/icons/buff_63.webp",
  "바리케이드": "https://lostarkcodex.com/icons/buff_170.webp",
  "돌격대장": "https://lostarkcodex.com/icons/buff_210.webp",
  "각성": "https://lostarkcodex.com/icons/buff_113.webp",
  "결투의 대가": "https://lostarkcodex.com/icons/ability_224.webp",
  "질량 증가": "https://lostarkcodex.com/icons/ability_231.webp",
  "추진력": "https://lostarkcodex.com/icons/ability_232.webp",
  "타격의 대가": "https://lostarkcodex.com/icons/ability_233.webp",
  "시선 집중": "https://lostarkcodex.com/icons/ability_234.webp",
  "아드레날린": "https://lostarkcodex.com/icons/ability_235.webp",
  "속전속결": "https://lostarkcodex.com/icons/ability_236.webp",
  "전문의": "https://lostarkcodex.com/icons/ability_237.webp",
  "긴급구조": "https://lostarkcodex.com/icons/ability_238.webp",
  "정밀 단도": "https://lostarkcodex.com/icons/ability_239.webp",
  "광기": "https://lostarkcodex.com/icons/ability_270.webp",
  "광전사의 비기": "https://lostarkcodex.com/icons/ability_269.webp",
  "강화 무기": "https://lostarkcodex.com/icons/ability_242.webp",
  "핸드거너": "https://lostarkcodex.com/icons/buff_600.webp",
  "화력 강화": "https://lostarkcodex.com/icons/ability_271.webp",
  "포격 강화": "https://lostarkcodex.com/icons/gl_skill_01_26.webp",
  "전투 태세": "https://lostarkcodex.com/icons/ability_266.webp",
  "고독한 기사": "https://lostarkcodex.com/icons/ability_267.webp",
  "오의 강화": "https://lostarkcodex.com/icons/buff_238.webp",
  "초심": "https://lostarkcodex.com/icons/ability_25.webp",
  "극의: 체술": "https://lostarkcodex.com/icons/achieve_07_22.webp",
  "충격 단련": "https://lostarkcodex.com/icons/buff_177.webp",
  "진실된 용맹": "https://lostarkcodex.com/icons/ability_275.webp",
  "절실한 구원": "https://lostarkcodex.com/icons/ability_276.webp",
  "분노의 망치": "https://lostarkcodex.com/icons/achieve_08_49.webp",
  "중력 수련": "https://lostarkcodex.com/icons/ability_268.webp",
  "상급 소환사": "https://lostarkcodex.com/icons/buff_78.webp",
  "넘치는 교감": "https://lostarkcodex.com/icons/ability_274.webp",
  "황후의 은총": "https://lostarkcodex.com/icons/ability_272.webp",
  "황제의 칙령": "https://lostarkcodex.com/icons/ability_273.webp",
  "세맥타통": "https://lostarkcodex.com/icons/buff_235.webp",
  "역천지체": "https://lostarkcodex.com/icons/ability_45.webp",
  "두 번째 동료": "https://lostarkcodex.com/icons/ability_47.webp",
  "죽음의 습격": "https://lostarkcodex.com/icons/buff_245.webp",
  "절정": "https://lostarkcodex.com/icons/ability_207.webp",
  "절제": "https://lostarkcodex.com/icons/ability_208.webp",
  "잔재된 기운": "https://lostarkcodex.com/icons/ability_209.webp",
  "버스트": "https://lostarkcodex.com/icons/ability_210.webp",
  "완벽한 억제": "https://lostarkcodex.com/icons/ability_211.webp",
  "멈출 수 없는 충동": "https://lostarkcodex.com/icons/ability_212.webp",
  "심판자": "https://lostarkcodex.com/icons/ability_214.webp",
  "축복의 오라": "https://lostarkcodex.com/icons/ability_215.webp",
  "아르데타인의 기술": "https://lostarkcodex.com/icons/ability_216.webp",
  "진화의 유산": "https://lostarkcodex.com/icons/ability_217.webp",
  "갈증": "https://lostarkcodex.com/icons/ability_222.webp",
  "달의 소리": "https://lostarkcodex.com/icons/ability_223.webp",
  "피스메이커": "https://lostarkcodex.com/icons/ability_225.webp",
  "사냥의 시간": "https://lostarkcodex.com/icons/ability_228.webp",
  "일격필살": "https://lostarkcodex.com/icons/ability_230.webp",
  "오의난무": "https://lostarkcodex.com/icons/ability_229.webp",
  "점화": "https://lostarkcodex.com/icons/ability_240.webp",
  "환류": "https://lostarkcodex.com/icons/ability_241.webp",
  "회귀": "https://lostarkcodex.com/icons/ability_248.webp",
  "만개": "https://lostarkcodex.com/icons/ability_249.webp",
  "질풍노도": "https://lostarkcodex.com/icons/ability_258.webp",
  "이슬비": "https://lostarkcodex.com/icons/ability_259.webp",
  "포식자": "https://lostarkcodex.com/icons/ability_260.webp",
  "처단자": "https://lostarkcodex.com/icons/ability_261.webp",
  "만월의 집행자": "https://lostarkcodex.com/icons/ability_263.webp",
  "그믐의 경계": "https://lostarkcodex.com/icons/ability_264.webp",
  "권왕파천무": "https://lostarkcodex.com/icons/ability_277.webp",
  "수라의 길": "https://lostarkcodex.com/icons/ability_278.webp"
};

function extractPositivePercentages(description) {
  return Array.from(String(description || "").matchAll(/<FONT COLOR=['"]#99ff99['"]>([^<]*?%)[^<]*<\/FONT>/gi))
    .map((match) => stripMarkup(match[1]))
    .filter(Boolean);
}

export function normalizeEngravingEffect(effect) {
  const metrics = extractPositivePercentages(effect?.Description);

  return {
    Name: effect?.Name || "",
    Grade: effect?.Grade || "",
    Level: effect?.Level ?? null,
    AbilityStoneLevel: effect?.AbilityStoneLevel ?? null,
    Icon: ENGRAVING_ICONS[effect?.Name] || "",
    Description: stripMarkup(effect?.Description || ""),
    EfficiencyText: metrics[0] || "",
    Metrics: metrics
  };
}

export function normalizeEngravings(engravings) {
  const effects = Array.isArray(engravings?.ArkPassiveEffects)
    ? engravings.ArkPassiveEffects
    : Array.isArray(engravings?.Effects)
      ? engravings.Effects
      : Array.isArray(engravings?.Engravings)
        ? engravings.Engravings
        : [];

  return effects.map(normalizeEngravingEffect).filter((effect) => effect.Name);
}
