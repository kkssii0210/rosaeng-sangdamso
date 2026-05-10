import test from "node:test";
import assert from "node:assert/strict";
import { buildCriticalStats, parseCriticalEffectText } from "../lib/spec/criticalStats.js";
import { buildClassIdentityEffects } from "../lib/spec/classIdentityEffects.js";

test("parses critical rate, critical damage, and critical outgoing damage separately", () => {
  assert.deepEqual(parseCriticalEffectText("치명타 적중률 +1.55%"), [
    {
      Kind: "critRate",
      Value: 1.55,
      Text: "치명타 적중률 +1.55%"
    }
  ]);
  assert.deepEqual(parseCriticalEffectText("치명타 피해가 6.8% 증가한다."), [
    {
      Kind: "critDamage",
      Value: 6.8,
      Text: "치명타 피해가 6.8% 증가한다."
    }
  ]);
  assert.deepEqual(parseCriticalEffectText("공격이 치명타로 적중 시 적에게 주는 피해가 1.5% 증가한다."), [
    {
      Kind: "criticalOutgoingDamage",
      Value: 1.5,
      Text: "공격이 치명타로 적중 시 적에게 주는 피해가 1.5% 증가한다."
    }
  ]);
});

test("builds global, conditional, and skill-specific critical stat buckets", () => {
  const result = buildCriticalStats({
    profile: {
      Stats: [
        {
          Type: "치명",
          Tooltip: ["<textformat>치명타 적중률이 <font color='#99ff99'>24.37%</font> 증가합니다.</textformat>"]
        }
      ]
    },
    equipment: [
      {
        Type: "반지",
        Name: "도래한 결전의 반지",
        DetailSections: [
          {
            title: "연마 효과",
            lines: ["치명타 적중률 +1.55%", "치명타 피해 +4.00%"]
          }
        ]
      },
      {
        Type: "팔찌",
        Name: "찬란한 구원자의 팔찌",
        DetailSections: [
          {
            title: "팔찌 효과",
            lines: ["치명타 피해가 6.8% 증가한다.", "공격이 치명타로 적중 시 적에게 주는 피해가 1.5% 증가한다."]
          }
        ]
      }
    ],
    engravings: [
      {
        Name: "예리한 둔기",
        Description: "치명타 피해량이 52.00% 증가하지만, 공격 시 일정 확률로 20.00% 감소된 피해를 준다."
      },
      {
        Name: "아드레날린",
        Description: "최대 6중첩 도달 시 치명타 적중률이 추가로 20.00% 증가한다."
      }
    ],
    skills: [
      {
        Name: "루나틱 엣지",
        Tripods: [
          {
            Name: "예리한 일격",
            IsSelected: true,
            Tooltip: "<font>치명타 피해가 <FONT COLOR='#99ff99'>80.0%</FONT> 증가한다.</font>"
          },
          {
            Name: "미선택 치명",
            IsSelected: false,
            Tooltip: "<font>치명타 피해가 <FONT COLOR='#99ff99'>999.0%</FONT> 증가한다.</font>"
          }
        ]
      }
    ],
    arkPassive: {
      Effects: [
        {
          Description: "깨달음 1티어 영혼친화력 Lv.3",
          ToolTip: "{\"Element_002\":{\"type\":\"MultiTextBox\",\"value\":\"치명타 적중률이 <FONT COLOR='#99ff99'>14.0%</FONT> 증가하고 영혼석 사용 시 빙의 게이지가 <FONT COLOR='#99ff99'>5.0%</FONT> 회복된다.\"}}"
        }
      ]
    },
    arkGrid: {
      Slots: [
        {
          Name: "혼돈의 달 코어",
          Tooltip: "{\"Element_006\":{\"type\":\"ItemPartBox\",\"value\":{\"Element_001\":\"치명타 시 적에게 주는 피해가 <FONT COLOR='#99ff99'>0.55%</FONT> 증가한다.\"}}}",
          Gems: []
        }
      ]
    }
  });

  assert.equal(result.GlobalCriticalRatePercent, 39.92);
  assert.equal(result.ConditionalCriticalRatePercent, 20);
  assert.equal(result.GlobalCriticalDamageBonusPercent, 62.8);
  assert.equal(result.GlobalCriticalDamagePercent, 262.8);
  assert.equal(result.ConditionalCriticalOutgoingDamagePercent, 2.05);
  assert.deepEqual(
    result.SkillSources.map((source) => [source.SourceName, source.SkillName, source.Kind, source.Value]),
    [["예리한 일격", "루나틱 엣지", "critDamage", 80]]
  );
});

test("uses only verified class identity critical effects", () => {
  const result = buildCriticalStats({
    classIdentityEffects: {
      ClassName: "소울이터",
      Effects: [
        {
          Name: "사신화 치명타 적중률",
          Kind: "critRate",
          Value: null,
          Scope: "identity",
          AppliesWhen: "사신화 상태",
          Target: "사신 스킬",
          Confidence: "unverified"
        },
        {
          Name: "검증된 아이덴티티 치명타",
          Kind: "critRate",
          Value: 10,
          Scope: "identity",
          AppliesWhen: "아이덴티티 상태",
          Target: "특정 스킬",
          Confidence: "verified"
        },
        {
          Name: "비활성 아이덴티티 치명타",
          Kind: "critRate",
          Value: 99,
          Scope: "identity",
          AppliesWhen: "다른 직각 상태",
          Target: "특정 스킬",
          Confidence: "verified",
          IsActive: false
        }
      ]
    }
  });

  assert.equal(result.GlobalCriticalRatePercent, 0);
  assert.equal(result.ConditionalCriticalRatePercent, 10);
  assert.deepEqual(
    result.ConditionalSources.map((source) => [source.SourceType, source.SourceName, source.SkillName, source.Value]),
    [["classIdentity", "소울이터 검증된 아이덴티티 치명타", "특정 스킬", 10]]
  );
});

test("uses max stacks for master critical rate effects", () => {
  const result = buildCriticalStats({
    arkPassive: {
      Effects: [
        {
          Description: "진화 4티어 달인 Lv.1",
          ToolTip: "{\"Element_002\":{\"type\":\"MultiTextBox\",\"value\":\"치명타 적중률 <FONT COLOR='#99ff99'>+1.4%</FONT> / 추가 피해 <FONT COLOR='#99ff99'>+1.7%</FONT>, 최대 <FONT COLOR='#99ff99'>5</FONT>중첩\"}}"
        }
      ]
    }
  });

  assert.equal(result.GlobalCriticalRatePercent, 7);
  assert.equal(result.GlobalAdditionalDamagePercent, 8.5);
  assert.deepEqual(
    result.GlobalSources.map((source) => [source.SourceType, source.SourceName, source.Kind, source.Value]),
    [["arkPassive", "진화 4티어 달인 Lv.1", "critRate", 7]]
  );
  assert.deepEqual(
    result.SpecialEngravingSources.map((source) => [source.SourceType, source.SourceName, source.Kind, source.Value, source.BaseValue]),
    [["arkPassive", "진화 4티어 달인 Lv.1", "additionalDamage", 8.5, 1.7]]
  );
});

test("keeps skill-family ark passive critical effects out of global buckets", () => {
  const result = buildCriticalStats({
    arkPassive: {
      Effects: [
        {
          Description: "깨달음 3티어 포격 출력 강화 Lv.3",
          ToolTip: "{\"Element_002\":{\"type\":\"MultiTextBox\",\"value\":\"포격 스킬의 피해량이 <FONT COLOR='#99ff99'>14.0%</FONT> 증가하고, 포격 스킬의 치명타 적중률이 <FONT COLOR='#99ff99'>40.0%</FONT> 증가한다.\"}}"
        },
        {
          Description: "깨달음 3티어 신속 포격 Lv.2",
          ToolTip: "{\"Element_002\":{\"type\":\"MultiTextBox\",\"value\":\"포격 스킬의 공격 속도가 <FONT COLOR='#99ff99'>4.0%</FONT> 증가하고, 포격 스킬의 치명타 피해량이 <FONT COLOR='#99ff99'>8.0%</FONT> 증가한다.\"}}"
        }
      ]
    }
  });

  assert.equal(result.GlobalCriticalRatePercent, 0);
  assert.equal(result.GlobalCriticalDamageBonusPercent, 0);
  assert.deepEqual(
    result.SkillFamilySources.map((source) => [source.SourceName, source.SkillFamily, source.Kind, source.Value]),
    [
      ["깨달음 3티어 포격 출력 강화 Lv.3", "포격 스킬", "critRate", 40],
      ["깨달음 3티어 신속 포격 Lv.2", "포격 스킬", "critDamage", 8]
    ]
  );
});

test("models adrenaline max-stack attack power and keen blunt expected penalty separately", () => {
  const result = buildCriticalStats({
    engravings: [
      {
        Name: "아드레날린",
        Description: "이동기 및 기본공격을 제외한 스킬 사용 시 6초 동안 공격력이 1.50% 증가하며 (최대 6중첩) 해당 효과가 최대 중첩에 도달할 경우 치명타 적중률이 추가로 18.50% 증가한다."
      },
      {
        Name: "예리한 둔기",
        Description: "치명타 피해량이 50.00% 증가하지만, 공격 시 일정 확률로 20.00% 감소된 피해를 준다."
      }
    ]
  });

  assert.equal(result.ConditionalCriticalRatePercent, 18.5);
  assert.equal(result.GlobalCriticalDamageBonusPercent, 50);
  assert.equal(result.ConditionalAttackPowerPercent, 9);
  assert.equal(result.ExpectedDamagePenaltyMultiplier, 0.98);
  assert.equal(result.ExpectedDamagePenaltyPercent, 2);
  assert.deepEqual(
    result.SpecialEngravingSources.map((source) => [source.SourceName, source.Kind, source.Value]),
    [
      ["아드레날린", "attackPower", 9],
      ["예리한 둔기", "expectedDamagePenalty", 2]
    ]
  );
});

test("extracts blunt thorn critical cap and converted evolution damage", () => {
  const result = buildCriticalStats({
    profile: {
      Stats: [
        {
          Type: "치명",
          Tooltip: ["치명타 적중률이 73.56% 증가합니다."]
        }
      ]
    },
    engravings: [
      {
        Name: "아드레날린",
        Description: "공격력이 0.90% 증가하며 (최대 6중첩) 해당 효과가 최대 중첩 도달 시 치명타 적중률이 추가로 20.00% 증가한다."
      }
    ],
    arkPassive: {
      Effects: [
        {
          Description: "진화 2티어 예리한 감각 Lv.1",
          ToolTip: "{\"Element_002\":{\"type\":\"MultiTextBox\",\"value\":\"치명타 적중률이 <FONT COLOR='#99ff99'>4.0% </font>증가하고, 진화형 피해가 <FONT COLOR='#99ff99'>5.0% </font>증가합니다.\"}}"
        },
        {
          Description: "진화 3티어 혼신의 강타 Lv.2",
          ToolTip: "{\"Element_002\":{\"type\":\"MultiTextBox\",\"value\":\"치명타 적중률이 <FONT COLOR='#99ff99'>24.0% </font>증가하고, 진화형 피해가 <FONT COLOR='#99ff99'>4.0% </font>증가합니다.\"}}"
        },
        {
          Description: "진화 5티어 뭉툭한 가시 Lv.2",
          ToolTip: "{\"Element_002\":{\"type\":\"MultiTextBox\",\"value\":\"진화형 피해가 <FONT COLOR='#99ff99'>15.0% </font>증가합니다. 치명타가 발생할 확률이 최대 <FONT COLOR='#ff9999'>80.0% </font>로 제한됩니다. 공격 시, 초과한 모든 치명타가 발생할 확률의 <FONT COLOR='#99ff99'>150.0%</font>가 진화형 피해로 전환됩니다. 이 노드에 의한 진화형 피해는 최대 <FONT COLOR='#99ff99'>75.0%</font>까지 적용됩니다.\"}}"
        }
      ]
    }
  });

  assert.equal(result.GlobalCriticalRatePercent, 101.56);
  assert.equal(result.ConditionalCriticalRatePercent, 20);
  assert.equal(result.EffectiveCriticalRatePercent, 80);
  assert.equal(result.FixedEvolutionDamagePercent, 24);
  assert.equal(result.ConvertedEvolutionDamagePercent, 62.34);
  assert.equal(result.EvolutionDamagePercent, 86.34);
  assert.deepEqual(result.CriticalRateLimit, {
    IsActive: true,
    SourceName: "진화 5티어 뭉툭한 가시 Lv.2",
    CapPercent: 80,
    OverflowConversionRatePercent: 150,
    MaxConvertedEvolutionDamagePercent: 75
  });
});

test("adds hidden ark passive point bonuses", () => {
  const result = buildCriticalStats({
    arkPassive: {
      Points: [
        {
          Name: "진화",
          Description: "6랭크 21레벨"
        },
        {
          Name: "깨달음",
          Description: "6랭크 25레벨"
        },
        {
          Name: "도약",
          Description: "6랭크 21레벨"
        }
      ]
    }
  });

  assert.equal(result.FixedEvolutionDamagePercent, 6);
  assert.equal(result.EvolutionDamagePercent, 6);
  assert.equal(result.GlobalWeaponPowerPercent, 2.5);
  assert.equal(result.ConditionalWeaponPowerPercent, 0);
  assert.deepEqual(
    result.SpecialEngravingSources.map((source) => [source.SourceType, source.SourceName, source.Kind, source.Value]),
    [
      ["arkPassivePoint", "진화 6랭크 달성 보너스", "evolutionDamage", 6],
      ["arkPassivePoint", "깨달음 레벨 보너스", "weaponPower", 2.5]
    ]
  );
});

test("does not apply ark passive effects or point bonuses when ark passive is off", () => {
  const result = buildCriticalStats({
    arkPassive: {
      IsArkPassive: false,
      Points: [
        {
          Name: "진화",
          Description: "6랭크 21레벨"
        },
        {
          Name: "깨달음",
          Description: "6랭크 25레벨"
        }
      ],
      Effects: [
        {
          Description: "진화 4티어 달인 Lv.1",
          ToolTip: "{\"Element_002\":{\"type\":\"MultiTextBox\",\"value\":\"치명타 적중률 <FONT COLOR='#99ff99'>+1.4%</FONT> / 추가 피해 <FONT COLOR='#99ff99'>+1.7%</FONT>, 최대 <FONT COLOR='#99ff99'>5</FONT>중첩\"}}"
        }
      ]
    }
  });

  assert.equal(result.GlobalCriticalRatePercent, 0);
  assert.equal(result.GlobalAdditionalDamagePercent, 0);
  assert.equal(result.FixedEvolutionDamagePercent, 0);
  assert.equal(result.GlobalWeaponPowerPercent, 0);
  assert.deepEqual(result.SpecialSources, []);
});

test("keeps duplicate equipment critical effects from separate accessories", () => {
  const result = buildCriticalStats({
    equipment: [
      {
        Type: "반지",
        Name: "도래한 결전의 반지",
        DetailSections: [
          {
            title: "연마 효과",
            lines: ["치명타 피해 +4.00%"]
          }
        ]
      },
      {
        Type: "반지",
        Name: "도래한 결전의 반지",
        DetailSections: [
          {
            title: "연마 효과",
            lines: ["치명타 피해 +4.00%"]
          }
        ]
      }
    ]
  });

  assert.equal(result.GlobalCriticalDamageBonusPercent, 8);
  assert.equal(result.GlobalSources.filter((source) => source.Kind === "critDamage").length, 2);
});

test("adds active burst identity critical rate to conditional critical rate", () => {
  const berserkerIdentityEffects = buildClassIdentityEffects({
    CharacterClassName: "버서커"
  }, {
    engravings: [
      {
        Name: "광전사의 비기"
      }
    ]
  });
  const slayerIdentityEffects = buildClassIdentityEffects({
    CharacterClassName: "슬레이어"
  }, {
    arkPassive: {
      Effects: [
        {
          Description: "깨달음 2티어 포식자 Lv.3"
        }
      ]
    }
  });

  assert.equal(buildCriticalStats({ classIdentityEffects: berserkerIdentityEffects }).ConditionalCriticalRatePercent, 50);
  assert.equal(buildCriticalStats({ classIdentityEffects: slayerIdentityEffects }).ConditionalCriticalRatePercent, 30);
});
