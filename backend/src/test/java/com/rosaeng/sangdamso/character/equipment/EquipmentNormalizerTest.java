package com.rosaeng.sangdamso.character.equipment;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class EquipmentNormalizerTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final EquipmentNormalizer normalizer = new EquipmentNormalizer();

    @Test
    void normalizesEquipmentWithoutTooltipAndRemovesExcludedTypes() throws Exception {
        JsonNode equipment = equipment(
            item("무기", "검은 밤의 장검", "https://cdn-lostark.game.onstove.com/sample-weapon.png", "고대",
                tooltip(97, sections(
                    section("기본 효과", "무기 공격력 +12345"),
                    section("추가 효과", "추가 피해 +30.00%")
                ))),
            item("나침반", "프로키온의 나침반", "", "", tooltip(-1, List.of())),
            item("보주", "눈부신 비전의 보주", "https://cdn-lostark.game.onstove.com/sample-orb.png", "유물",
                tooltip(-1, sections(section("특수 효과", "[맥스웰 맥시마]", "시즌2 달성 최대 낙원력 : 48,275,714"))))
        );

        JsonNode normalized = normalizer.normalize(equipment);

        assertThat(normalized.size()).isEqualTo(1);
        JsonNode weapon = normalized.get(0);
        assertThat(weapon.propertyNames()).containsExactly(
            "Type",
            "Name",
            "Icon",
            "Grade",
            "Quality",
            "ItemLevelText",
            "DetailSections",
            "WeaponStats"
        );
        assertThat(weapon.get("Type").asString()).isEqualTo("무기");
        assertThat(weapon.get("Quality").asInt()).isEqualTo(97);
        assertThat(weapon.get("ItemLevelText").asString()).isEqualTo("아이템 레벨 1,740.00");
        assertThat(weapon.get("Tooltip")).isNull();
        assertThat(weapon.get("WeaponStats").get("WeaponPower").get("Value").asInt()).isEqualTo(12345);
        assertThat(weapon.get("WeaponStats").get("AdditionalDamage").get("Value").asDouble()).isEqualTo(30.0);
    }

    @Test
    void extractsAccessoryDetailsMainStatsAndAbilityStoneInfo() throws Exception {
        JsonNode equipment = equipment(
            item("목걸이", "새벽의 목걸이", "https://cdn-lostark.game.onstove.com/sample-necklace.png", "고대",
                tooltip(83, sections(
                    section("기본 효과", "힘 +17831", "민첩 +17831", "지능 +17831", "치명 +420", "특화 +420"),
                    section("연마 효과", "추가 피해 +2.60%"),
                    section("아크 패시브 포인트 효과", "깨달음 +13")
                ))),
            item("어빌리티 스톤", "예리한 둔기 돌", "https://cdn-lostark.game.onstove.com/sample-stone.png", "고대",
                tooltip(
                    68,
                    sections(
                        section("기본 효과", "체력 +15196"),
                        section("세공 단계 보너스", "체력 +3525")
                    ),
                    indentGroups(group("무작위 각인 효과",
                        "[<FONT COLOR='#FFFFAC'>예리한 둔기</FONT>] <img src='emoticon_tooltip_ability_stone_symbol'></img>Lv.3",
                        "[<FONT COLOR='#FFFFAC'>타격의 대가</FONT>] <img src='emoticon_tooltip_ability_stone_symbol'></img>Lv.2",
                        "[<FONT COLOR='#FE2E2E'>공격력 감소</FONT>] <img src='emoticon_tooltip_ability_stone_symbol'></img>Lv.0",
                        "[<FONT COLOR='#73DC04'>레벨 보너스</FONT>] <FONT COLOR='#FFFFFF'>기본 공격력 +1.50%</FONT>"
                    ))
                ))
        );

        JsonNode normalized = normalizer.normalize(equipment);
        JsonNode necklace = normalized.get(0);
        JsonNode abilityStone = normalized.get(1);

        assertThat(necklace.get("DetailSections").get(0).get("title").asString()).isEqualTo("기본 효과");
        assertThat(necklace.get("DetailSections").get(0).get("lines").get(0).asString()).isEqualTo("힘 +17831");
        assertThat(necklace.get("MainStats").size()).isEqualTo(3);
        assertThat(necklace.get("MainStatValue").asInt()).isEqualTo(17831);
        assertThat(necklace.get("MainStatText").asString()).isEqualTo("주스탯 +17,831");

        assertThat(abilityStone.get("Quality").isNull()).isTrue();
        assertThat(abilityStone.get("DetailSections").size()).isZero();
        assertThat(abilityStone.get("AbilityStone").get("Engravings").get(0).get("Name").asString()).isEqualTo("예리한 둔기");
        assertThat(abilityStone.get("AbilityStone").get("Engravings").get(2).get("IsPenalty").asBoolean()).isTrue();
        assertThat(abilityStone.get("AbilityStone").get("Effects").get(2).get("Title").asString()).isEqualTo("레벨 보너스");
    }

    @Test
    void extractsParadiseOrbFromExcludedEquipment() throws Exception {
        JsonNode equipment = equipment(
            item("무기", "검은 밤의 장검", "https://cdn-lostark.game.onstove.com/sample-weapon.png", "고대",
                tooltip(97, sections(section("기본 효과", "무기 공격력 +12345")))),
            item("보주", "눈부신 비전의 보주", "https://cdn-lostark.game.onstove.com/sample-orb.png", "유물",
                tooltip(-1, sections(section(
                    "특수 효과",
                    "[맥스웰 맥시마]",
                    "보스 등급 이상 몬스터에게 304,654,272의 고정 피해를 줍니다.",
                    "시즌2 달성 최대 낙원력 : 48,275,714"
                ))))
        );

        JsonNode paradiseOrb = normalizer.extractParadiseOrb(equipment);

        assertThat(paradiseOrb.get("Type").asString()).isEqualTo("보주");
        assertThat(paradiseOrb.get("EffectName").asString()).isEqualTo("맥스웰 맥시마");
        assertThat(paradiseOrb.get("EffectRole").asString()).isEqualTo("attack");
        assertThat(paradiseOrb.get("MaxParadisePower").get("Value").asInt()).isEqualTo(48275714);
        assertThat(paradiseOrb.get("Tooltip")).isNull();
    }

    @Test
    void extractsAccessoryTradeRemainCountFromTooltipLines() throws Exception {
        JsonNode equipment = equipment(
            item("목걸이", "새벽의 목걸이", "https://cdn-lostark.game.onstove.com/sample-necklace.png", "고대",
                tooltip(83, sections(
                    section("기본 효과", "힘 +17831", "민첩 +17831", "지능 +17831"),
                    section("거래 정보", "거래 가능 횟수 : 2회")
                )))
        );

        JsonNode normalized = normalizer.normalize(equipment);

        assertThat(normalized.get(0).get("TradeRemainCount").asInt()).isEqualTo(2);
    }

    @Test
    void omitsAccessoryTradeRemainCountWhenTooltipDoesNotExposeIt() throws Exception {
        JsonNode equipment = equipment(
            item("반지", "새벽의 반지", "https://cdn-lostark.game.onstove.com/sample-ring.png", "고대",
                tooltip(83, sections(
                    section("기본 효과", "힘 +17831", "민첩 +17831", "지능 +17831"),
                    section("연마 효과", "치명타 적중률 +0.40%")
                )))
        );

        JsonNode normalized = normalizer.normalize(equipment);

        assertThat(normalized.get(0).get("TradeRemainCount")).isNull();
    }

    @Test
    void extractsZeroAccessoryTradeRemainCountFromTooltipLines() throws Exception {
        JsonNode equipment = equipment(
            item("귀걸이", "새벽의 귀걸이", "https://cdn-lostark.game.onstove.com/sample-earring.png", "고대",
                tooltip(83, sections(
                    section("기본 효과", "힘 +17831", "민첩 +17831", "지능 +17831"),
                    section("거래 정보", "거래 가능 횟수 : 0회")
                )))
        );

        JsonNode normalized = normalizer.normalize(equipment);

        assertThat(normalized.get(0).get("TradeRemainCount").asInt()).isEqualTo(0);
    }

    private JsonNode equipment(JsonNode... items) {
        return objectMapper.convertValue(Arrays.asList(items), JsonNode.class);
    }

    private JsonNode item(String type, String name, String icon, String grade, String tooltip) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("Type", type);
        item.put("Name", name);
        item.put("Icon", icon);
        item.put("Grade", grade);
        item.put("Tooltip", tooltip);
        return objectMapper.convertValue(item, JsonNode.class);
    }

    private String tooltip(int qualityValue, List<Section> sections) throws Exception {
        return tooltip(qualityValue, sections, List.of());
    }

    private String tooltip(int qualityValue, List<Section> sections, List<IndentGroup> indentGroups) throws Exception {
        Map<String, Object> root = new LinkedHashMap<>();
        root.put("Element_001", Map.of(
            "value", Map.of(
                "qualityValue", qualityValue,
                "leftStr2", "<FONT COLOR='#FFD200'>아이템 레벨 1,740.00</FONT>"
            )
        ));

        for (int index = 0; index < sections.size(); index++) {
            Section section = sections.get(index);
            root.put("Element_" + String.format("%03d", index + 10), Map.of(
                "type", "ItemPartBox",
                "value", Map.of(
                    "Element_000", "<FONT COLOR='#FFEC50'>" + section.title() + "</FONT>",
                    "Element_001", String.join("<BR>", section.lines())
                )
            ));
        }

        for (int index = 0; index < indentGroups.size(); index++) {
            IndentGroup group = indentGroups.get(index);
            Map<String, Object> content = new LinkedHashMap<>();

            for (int lineIndex = 0; lineIndex < group.lines().size(); lineIndex++) {
                content.put("Element_" + String.format("%03d", lineIndex), Map.of(
                    "bPoint", 0,
                    "contentStr", group.lines().get(lineIndex) + "<BR>",
                    "pointType", 2
                ));
            }

            root.put("Element_" + String.format("%03d", index + 30), Map.of(
                "type", "IndentStringGroup",
                "value", Map.of("Element_000", Map.of(
                    "topStr", "<FONT COLOR='#A9D0F5'>" + group.title() + "</FONT>",
                    "contentStr", content
                ))
            ));
        }

        return objectMapper.writeValueAsString(root);
    }

    private List<Section> sections(Section... sections) {
        return Arrays.asList(sections);
    }

    private Section section(String title, String... lines) {
        return new Section(title, Arrays.asList(lines));
    }

    private List<IndentGroup> indentGroups(IndentGroup... groups) {
        return Arrays.asList(groups);
    }

    private IndentGroup group(String title, String... lines) {
        return new IndentGroup(title, new ArrayList<>(Arrays.asList(lines)));
    }

    private record Section(String title, List<String> lines) {
    }

    private record IndentGroup(String title, List<String> lines) {
    }
}
