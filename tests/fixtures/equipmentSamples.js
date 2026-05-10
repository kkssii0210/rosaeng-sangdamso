function createTooltip({ qualityValue, itemLevelText = "아이템 레벨 1,740.00", sections = [], indentGroups = [] }) {
  return JSON.stringify({
    Element_001: {
      value: {
        qualityValue,
        leftStr2: `<FONT COLOR='#FFD200'>${itemLevelText}</FONT>`
      }
    },
    ...Object.fromEntries(
      sections.map((section, index) => [
        `Element_${String(index + 10).padStart(3, "0")}`,
        {
          type: "ItemPartBox",
          value: {
            Element_000: `<FONT COLOR='#FFEC50'>${section.title}</FONT>`,
            Element_001: section.lines.join("<BR>")
          }
        }
      ])
    ),
    ...Object.fromEntries(
      indentGroups.map((group, index) => [
        `Element_${String(index + 30).padStart(3, "0")}`,
        {
          type: "IndentStringGroup",
          value: {
            Element_000: {
              topStr: `<FONT COLOR='#A9D0F5'>${group.title}</FONT>`,
              contentStr: Object.fromEntries(
                group.lines.map((line, lineIndex) => [
                  `Element_${String(lineIndex).padStart(3, "0")}`,
                  {
                    bPoint: 0,
                    contentStr: `${line}<BR>`,
                    pointType: 2
                  }
                ])
              )
            }
          }
        }
      ])
    )
  });
}

export const weaponSample = {
  Type: "무기",
  Name: "검은 밤의 장검",
  Icon: "https://cdn-lostark.game.onstove.com/sample-weapon.png",
  Grade: "고대",
  Tooltip: createTooltip({
    qualityValue: 97,
    sections: [
      { title: "기본 효과", lines: ["무기 공격력 +12345"] },
      { title: "추가 효과", lines: ["추가 피해 +30.00%"] }
    ]
  })
};

export const armorSample = {
  Type: "투구",
  Name: "+25 운명의 전율 머리장식",
  Icon: "https://cdn-lostark.game.onstove.com/sample-helmet.png",
  Grade: "고대",
  Tooltip: createTooltip({
    qualityValue: 91,
    sections: [
      { title: "기본 효과", lines: ["물리 방어력 +10481", "마법 방어력 +11645", "민첩 +139346", "체력 +12405"] },
      { title: "아크 패시브 포인트 효과", lines: ["진화 +24"] }
    ]
  })
};

export const necklaceSample = {
  Type: "목걸이",
  Name: "새벽의 목걸이",
  Icon: "https://cdn-lostark.game.onstove.com/sample-necklace.png",
  Grade: "고대",
  Tooltip: createTooltip({
    qualityValue: 83,
    sections: [
      { title: "기본 효과", lines: ["힘 +17831", "민첩 +17831", "지능 +17831", "치명 +420", "특화 +420"] },
      { title: "연마 효과", lines: ["추가 피해 +2.60%"] },
      { title: "아크 패시브 포인트 효과", lines: ["깨달음 +13"] }
    ]
  })
};

export const abilityStoneSample = {
  Type: "어빌리티 스톤",
  Name: "예리한 둔기 돌",
  Icon: "https://cdn-lostark.game.onstove.com/sample-stone.png",
  Grade: "고대",
  Tooltip: createTooltip({
    qualityValue: 68,
    sections: [
      { title: "기본 효과", lines: ["체력 +15196"] },
      { title: "세공 단계 보너스", lines: ["체력 +3525"] }
    ],
    indentGroups: [
      {
        title: "무작위 각인 효과",
        lines: [
          "[<FONT COLOR='#FFFFAC'>예리한 둔기</FONT>] <img src='emoticon_tooltip_ability_stone_symbol'></img>Lv.3",
          "[<FONT COLOR='#FFFFAC'>타격의 대가</FONT>] <img src='emoticon_tooltip_ability_stone_symbol'></img>Lv.2",
          "[<FONT COLOR='#FE2E2E'>공격력 감소</FONT>] <img src='emoticon_tooltip_ability_stone_symbol'></img>Lv.0",
          "[<FONT COLOR='#73DC04'>레벨 보너스</FONT>] <FONT COLOR='#FFFFFF'>기본 공격력 +1.50%</FONT>"
        ]
      }
    ]
  })
};

export const braceletSample = {
  Type: "팔찌",
  Name: "푸른 맹세 팔찌",
  Icon: "https://cdn-lostark.game.onstove.com/sample-bracelet.png",
  Grade: "고대",
  Tooltip: createTooltip({
    qualityValue: 44,
    sections: [
      { title: "팔찌 효과", lines: ["특화 +120", "순환 : 공격 적중 시 30초 동안 피해량 증가"] },
      { title: "아크 패시브 포인트 효과", lines: ["도약 +9"] }
    ]
  })
};

export const excludedSamples = [
  { Type: "나침반", Name: "프로키온의 나침반", Tooltip: createTooltip({ qualityValue: -1 }) },
  { Type: "부적", Name: "세계수의 부적", Tooltip: createTooltip({ qualityValue: -1 }) },
  { Type: "보주", Name: "오르페우스의 별", Tooltip: createTooltip({ qualityValue: -1 }) }
];
