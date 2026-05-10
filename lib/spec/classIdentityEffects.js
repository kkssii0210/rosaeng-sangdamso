const UNKNOWN_CONFIDENCE = "unverified";

function createEffect({
  id,
  name,
  kind,
  value = null,
  unit = "percent",
  operation = "additive",
  scope = "identity",
  appliesWhen = "",
  target = "self",
  source = "manual",
  confidence = UNKNOWN_CONFIDENCE,
  notes = "",
  requiredAnyNames = [],
  requiredArkPassiveNames = [],
  requiredEngravingNames = []
}) {
  return {
    Id: id,
    Name: name,
    Kind: kind,
    Value: value,
    Unit: unit,
    Operation: operation,
    Scope: scope,
    AppliesWhen: appliesWhen,
    Target: target,
    Source: source,
    Confidence: confidence,
    Notes: notes,
    RequiredAnyNames: requiredAnyNames,
    RequiredArkPassiveNames: requiredArkPassiveNames,
    RequiredEngravingNames: requiredEngravingNames
  };
}

function createClassRule(className, identityNames, effects = []) {
  return {
    ClassName: className,
    IdentityNames: identityNames,
    Effects: effects
  };
}

function cloneRule(rule) {
  return {
    ClassName: rule.ClassName,
    IdentityNames: [...rule.IdentityNames],
    Effects: rule.Effects.map((effect) => ({ ...effect }))
  };
}

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

function listOf(source, keys) {
  const value = valueOf(source, keys, []);

  return Array.isArray(value) ? value : [];
}

function cleanText(value) {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function includesRuleName(values, requiredName) {
  const normalizedRequiredName = cleanText(requiredName);

  return values.some((value) => cleanText(value).includes(normalizedRequiredName));
}

function collectArkPassiveNames(arkPassive = {}) {
  return listOf(arkPassive, ["Effects", "effects"]).flatMap((effect) => [
    valueOf(effect, ["Description", "description"], ""),
    valueOf(effect, ["Name", "name"], "")
  ]).filter(Boolean);
}

function collectEngravingNames(engravings = []) {
  return listOf({ engravings }, ["engravings"]).flatMap((engraving) => [
    valueOf(engraving, ["Name", "name"], ""),
    valueOf(engraving, ["Description", "description"], "")
  ]).filter(Boolean);
}

function buildActivation(effect, context = {}) {
  const requiredAnyNames = listOf(effect, ["RequiredAnyNames", "requiredAnyNames"]);
  const requiredArkPassiveNames = listOf(effect, ["RequiredArkPassiveNames", "requiredArkPassiveNames"]);
  const requiredEngravingNames = listOf(effect, ["RequiredEngravingNames", "requiredEngravingNames"]);
  const arkPassiveNames = collectArkPassiveNames(valueOf(context, ["arkPassive"], {}));
  const engravingNames = collectEngravingNames(valueOf(context, ["engravings"], []));
  const contextNames = [...arkPassiveNames, ...engravingNames];
  const matchedAnyNames = requiredAnyNames.filter((name) => includesRuleName(contextNames, name));
  const matchedArkPassiveNames = requiredArkPassiveNames.filter((name) => includesRuleName(arkPassiveNames, name));
  const matchedEngravingNames = requiredEngravingNames.filter((name) => includesRuleName(engravingNames, name));
  const hasRequirements = requiredAnyNames.length > 0 || requiredArkPassiveNames.length > 0 || requiredEngravingNames.length > 0;
  const isActive = (!requiredAnyNames.length || matchedAnyNames.length > 0)
    && (!requiredArkPassiveNames.length || matchedArkPassiveNames.length > 0)
    && (!requiredEngravingNames.length || matchedEngravingNames.length > 0);

  return {
    RequiredAnyNames: requiredAnyNames,
    RequiredArkPassiveNames: requiredArkPassiveNames,
    RequiredEngravingNames: requiredEngravingNames,
    MatchedAnyNames: matchedAnyNames,
    MatchedArkPassiveNames: matchedArkPassiveNames,
    MatchedEngravingNames: matchedEngravingNames,
    IsActive: hasRequirements ? isActive : true
  };
}

function applyActivation(rule, context = {}) {
  return {
    ...rule,
    Effects: rule.Effects.map((effect) => {
      const activation = buildActivation(effect, context);

      return {
        ...effect,
        IsActive: activation.IsActive,
        Activation: activation
      };
    })
  };
}

const berserkerIdentityEffects = [
  createEffect({
    id: "berserker-technique-burst-critical-rate",
    name: "폭주 치명타 적중률",
    kind: "critRate",
    value: 50,
    appliesWhen: "폭주 상태",
    source: "user",
    confidence: "verified",
    requiredAnyNames: ["광전사의 비기"],
    notes: "광전사의 비기 버서커는 폭주 상태에서 치명타 적중률이 50% 증가한다."
  })
];

const souleaterIdentityEffects = [
  createEffect({
    id: "souleater-full-moon-reaper-form-critical-rate",
    name: "사신화 치명타 적중률",
    kind: "critRate",
    value: 20,
    appliesWhen: "사신화 상태",
    target: "사신 스킬",
    source: "user",
    confidence: "verified",
    requiredArkPassiveNames: ["만월의 집행자"],
    notes: "만월의 집행자 소울이터는 사신화 시 치명타 적중률이 20% 증가한다."
  })
];

const slayerIdentityEffects = [
  createEffect({
    id: "slayer-burst-critical-rate",
    name: "폭주 치명타 적중률",
    kind: "critRate",
    value: 30,
    appliesWhen: "폭주 상태",
    source: "user",
    confidence: "verified",
    requiredAnyNames: ["처단자", "포식자"],
    notes: "처단자/포식자 슬레이어는 폭주 상태에서 치명타 적중률이 30% 증가한다."
  })
];

const classIdentityEffectsByClass = {
  버서커: createClassRule("버서커", ["분노", "폭주"], berserkerIdentityEffects),
  디스트로이어: createClassRule("디스트로이어", ["중력 코어", "중력 가중 모드"]),
  워로드: createClassRule("워로드", ["방어 태세", "전장의 방패"]),
  홀리나이트: createClassRule("홀리나이트", ["신의 집행자", "신성의 오라"]),
  슬레이어: createClassRule("슬레이어", ["분노", "폭주"], slayerIdentityEffects),
  배틀마스터: createClassRule("배틀마스터", ["엘리멘탈 버블"]),
  인파이터: createClassRule("인파이터", ["기력", "충격"]),
  기공사: createClassRule("기공사", ["금강선공"]),
  창술사: createClassRule("창술사", ["스탠스 전환"]),
  스트라이커: createClassRule("스트라이커", ["엘리멘탈 버블"]),
  브레이커: createClassRule("브레이커", ["투지", "권왕태세"]),
  데빌헌터: createClassRule("데빌헌터", ["무기 스탠스"]),
  블래스터: createClassRule("블래스터", ["화력 게이지", "포격 모드"]),
  호크아이: createClassRule("호크아이", ["실버호크"]),
  스카우터: createClassRule("스카우터", ["하이퍼 싱크"]),
  건슬링어: createClassRule("건슬링어", ["무기 스탠스"]),
  아르카나: createClassRule("아르카나", ["카드 덱"]),
  서머너: createClassRule("서머너", ["고대 정령"]),
  바드: createClassRule("바드", ["세레나데"]),
  소서리스: createClassRule("소서리스", ["마력 방출", "점멸"]),
  블레이드: createClassRule("블레이드", ["블레이드 아츠"]),
  데모닉: createClassRule("데모닉", ["잠식", "악마화"]),
  리퍼: createClassRule("리퍼", ["페르소나"]),
  소울이터: createClassRule("소울이터", ["빙의 게이지", "영혼석", "사신화"], souleaterIdentityEffects),
  도화가: createClassRule("도화가", ["조화 게이지"]),
  기상술사: createClassRule("기상술사", ["여우비"]),
  환수사: createClassRule("환수사", ["둔갑", "환수"])
};

function createEmptyRule(className = "") {
  return {
    ClassName: className,
    IdentityNames: [],
    Effects: []
  };
}

export function getClassIdentityEffects(className, context = {}) {
  const normalizedClassName = String(className || "").trim();
  const rule = classIdentityEffectsByClass[normalizedClassName] || createEmptyRule(normalizedClassName);

  return {
    ...applyActivation(cloneRule(rule), context),
    HasManualRule: Boolean(classIdentityEffectsByClass[normalizedClassName])
  };
}

export function buildClassIdentityEffects(profile = {}, context = {}) {
  return getClassIdentityEffects(valueOf(profile, ["CharacterClassName", "characterClassName"], ""), context);
}

export { classIdentityEffectsByClass };
