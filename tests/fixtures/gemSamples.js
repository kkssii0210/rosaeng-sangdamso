function createGemTooltip(effectLines) {
  return JSON.stringify({
    Element_001: {
      type: "ItemTitle",
      value: {
        leftStr2: "<FONT SIZE='14'>아이템 레벨 1640 (티어 4)</FONT>",
        qualityValue: -1
      }
    },
    Element_006: {
      type: "ItemPartBox",
      value: {
        Element_000: "<FONT COLOR='#A9D0F5'>효과</FONT>",
        Element_001: effectLines.join("<BR>")
      }
    }
  });
}

export const damageGemSample = {
  Slot: 0,
  Name: "<P ALIGN='CENTER'><FONT COLOR='#E3C7A1'>10레벨 광휘의 보석</FONT></P>",
  Icon: "https://cdn-lostark.game.onstove.com/sample-gem.png",
  Level: 10,
  Grade: "고대",
  Tooltip: createGemTooltip([
    "[소울이터] <FONT COLOR='#FFD200'>글러트니</FONT> 피해 44.00% 증가",
    "",
    "<FONT COLOR='#A9D0F5'>추가 효과</FONT>",
    "기본 공격력 1.20% 증가"
  ])
};

export const cooldownGemSample = {
  Slot: 1,
  Name: "<P ALIGN='CENTER'><FONT COLOR='#E3C7A1'>10레벨 광휘의 보석</FONT></P>",
  Icon: "https://cdn-lostark.game.onstove.com/sample-gem.png",
  Level: 10,
  Grade: "고대",
  Tooltip: createGemTooltip([
    "[소울이터] <FONT COLOR='#FFD200'>데스 오더</FONT> 재사용 대기시간 24.00% 감소",
    "",
    "<FONT COLOR='#A9D0F5'>추가 효과</FONT>",
    "기본 공격력 1.20% 증가"
  ])
};
