package com.rosaeng.sangdamso.spec;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.data.Offset.offset;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class UpgradeEfficiencyServiceTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final UpgradeEfficiencyService service = new UpgradeEfficiencyService();

    @Test
    void returnsUnavailableCandidatesUntilMarketSnapshotExists() {
        JsonNode result = service.build(Map.of(
            "profile", objectMapper.createObjectNode().put("CharacterName", "도화가"),
            "equipment", objectMapper.createArrayNode()
        ));

        assertThat(result.get("MarketDataStatus").asString()).isEqualTo("unavailable");
        assertThat(result.get("Candidates").size()).isZero();
    }

    @Test
    void buildsHoningCandidatesFromMarketCostInputs() {
        JsonNode result = service.build(Map.of(
            "profile", objectMapper.createObjectNode().put("CharacterName", "도화가"),
            "equipment", equipmentForHoning(),
            "marketSnapshot", marketSnapshot()
        ));

        assertThat(result.get("MarketDataStatus").asString()).isEqualTo("ready");
        JsonNode costInputs = result.get("CostInputs");
        assertThat(costInputs).isNotNull();
        JsonNode honing = costInputs.get("Honing");
        assertThat(honing).isNotNull();
        assertThat(honing.get("WeaponMaterials").size()).isEqualTo(5);
        assertThat(honing.get("WeaponMaterials").get(0).get("UnitPrice").asDouble()).isEqualTo(16.88);
        assertThat(honing.get("ArmorMaterials").get(0).get("UnitPrice").asDouble()).isEqualTo(0.5);
        assertThat(result.get("Candidates")).anySatisfy(candidate ->
            assertThat(candidate.get("Type").asString()).isEqualTo("weaponHoning"));
        assertThat(result.get("Candidates")).anySatisfy(candidate ->
            assertThat(candidate.get("Type").asString()).isEqualTo("armorHoning"));
    }

    @Test
    void buildsLegendaryAvatarCandidatesForSlotsBelowTargetStatPercent() {
        JsonNode result = service.build(Map.of(
            "profile", objectMapper.createObjectNode().put("CharacterName", "도화가"),
            "equipment", objectMapper.createArrayNode(),
            "avatars", objectMapper.convertValue(List.of(
                avatar("머리 아바타", 1),
                avatar("상의 아바타", 2)
            ), JsonNode.class),
            "marketSnapshot", marketSnapshot()
        ));

        JsonNode headCandidate = candidateByTypeAndTarget(result, "legendaryAvatar", "머리");

        assertThat(headCandidate).isNotNull();
        assertThat(headCandidate.get("Label").asString()).isEqualTo("전설 아바타 머리");
        assertThat(headCandidate.get("NetCostGold").asInt()).isEqualTo(50000);
        assertThat(headCandidate.get("GainPercent").asDouble()).isEqualTo(1.0);
        assertThat(candidateByTypeAndTarget(result, "legendaryAvatar", "상의")).isNull();
    }

    @Test
    void buildsGemCandidatesFromNextLevelMarketPriceAndCombatPowerDelta() {
        JsonNode result = service.build(Map.of(
            "profile", profileWithBasicAttack(),
            "equipment", objectMapper.createArrayNode(),
            "gems", objectMapper.convertValue(List.of(Map.of(
                "Slot", 0,
                "Name", "7레벨 겁화의 보석",
                "Level", 7,
                "SkillName", "라이징 스피어",
                "EffectType", "damage",
                "EffectValue", 24,
                "AdditionalEffects", List.of(Map.of("Name", "기본 공격력", "Value", 0.6))
            )), JsonNode.class),
            "marketSnapshot", marketSnapshot()
        ));

        JsonNode gemCandidate = candidateByType(result, "gem");

        assertThat(gemCandidate).isNotNull();
        assertThat(gemCandidate.get("Label").asString()).isEqualTo("라이징 스피어 7->8");
        assertThat(gemCandidate.get("NetCostGold").asInt()).isEqualTo(100000);
        assertThat(gemCandidate.get("GainType").asString()).isEqualTo("combatPower");
        assertThat(gemCandidate.get("GainPercent").asDouble()).isGreaterThan(0);
    }

    @Test
    void buildsEngravingBookCandidatesFromFiveBookPricesAndCombatPowerDelta() {
        JsonNode result = service.build(Map.of(
            "profile", profileWithBasicAttack(),
            "equipment", objectMapper.createArrayNode(),
            "engravings", objectMapper.convertValue(List.of(
                Map.of("Name", "원한", "Grade", "유물", "Level", 3),
                Map.of("Name", "아드레날린", "Grade", "유물", "Level", 4)
            ), JsonNode.class),
            "engravingBookPrices", objectMapper.convertValue(List.of(
                Map.of("EngravingName", "원한", "UnitPrice", 200000, "CostForFiveBooks", 1000000, "IsAvailable", true),
                Map.of("EngravingName", "아드레날린", "UnitPrice", 150000, "CostForFiveBooks", 750000, "IsAvailable", true)
            ), JsonNode.class),
            "marketSnapshot", marketSnapshot()
        ));

        JsonNode engravingCandidate = candidateByType(result, "engravingBook");

        assertThat(engravingCandidate).isNotNull();
        assertThat(engravingCandidate.get("Label").asString()).isEqualTo("원한 각인 3->4");
        assertThat(engravingCandidate.get("NetCostGold").asInt()).isEqualTo(1000000);
        assertThat(engravingCandidate.get("CurrentLevel").asInt()).isEqualTo(3);
        assertThat(engravingCandidate.get("TargetLevel").asInt()).isEqualTo(4);
        assertThat(result.get("Candidates")).noneSatisfy(candidate ->
            assertThat(candidate.get("Label").asString()).isEqualTo("아드레날린 각인 4->5"));
    }

    @Test
    void matchesSupportedFieldsFromUpgradeEfficiencyGoldenFixture() throws IOException {
        JsonNode fixture = readFixture("golden/upgrade-efficiency.json");
        JsonNode input = fixture.get("input");
        JsonNode expected = fixture.get("expected");
        JsonNode result = service.build(Map.of(
            "profile", input.get("profile"),
            "equipment", input.get("equipment"),
            "marketSnapshot", input.get("marketSnapshot")
        ));

        assertThat(result.get("MarketDataStatus").asString()).isEqualTo(expected.get("MarketDataStatus").asString());
        assertThat(result.get("CostInputs").get("Honing").get("WeaponMaterials").get(0).get("UnitPrice").asDouble())
            .isCloseTo(expected.get("CostInputs").get("Honing").get("WeaponMaterials").get(0).get("UnitPrice").asDouble(), offset(0.000000001));
        assertThat(candidateByType(result, "weaponHoning")).isNotNull();
        assertThat(candidateByType(result, "armorHoning")).isNotNull();

        JsonNode expectedAvatar = candidateByType(expected, "legendaryAvatar");
        JsonNode actualAvatar = candidateByType(result, "legendaryAvatar");
        assertThat(actualAvatar).isNotNull();
        assertThat(actualAvatar.get("Label").asString()).isEqualTo(expectedAvatar.get("Label").asString());
        assertThat(actualAvatar.get("NetCostGold").asInt()).isEqualTo(expectedAvatar.get("NetCostGold").asInt());
        assertThat(actualAvatar.get("GainPercent").asDouble())
            .isCloseTo(expectedAvatar.get("GainPercent").asDouble(), offset(0.000000001));
    }

    private JsonNode candidateByType(JsonNode result, String type) {
        for (JsonNode candidate : result.get("Candidates")) {
            if (type.equals(candidate.get("Type").asString())) {
                return candidate;
            }
        }

        return null;
    }

    private JsonNode candidateByTypeAndTarget(JsonNode result, String type, String target) {
        for (JsonNode candidate : result.get("Candidates")) {
            if (type.equals(candidate.get("Type").asString()) && target.equals(candidate.get("Target").asString())) {
                return candidate;
            }
        }

        return null;
    }

    private JsonNode profileWithBasicAttack() {
        return objectMapper.convertValue(Map.of(
            "CharacterLevel", 70,
            "Stats", List.of(Map.of(
                "Type", "공격력",
                "Value", "100000",
                "Tooltip", List.of(
                    "힘, 민첩, 지능과 무기 공격력을 기반으로 증가한 기본 공격력은 <font color='#99ff99'>100000</font> 입니다.",
                    "공격력 증감 효과로 공격력이 <font color='#99ff99'>0</font> 증가되었습니다."
                )
            ))
        ), JsonNode.class);
    }

    private Map<String, Object> avatar(String type, int value) {
        return Map.of(
            "Type", type,
            "Grade", value >= 2 ? "전설" : "영웅",
            "IsStatApplied", true,
            "StatEffects", List.of(Map.of("Stat", "민첩", "Value", value))
        );
    }

    private JsonNode equipmentForHoning() {
        return objectMapper.convertValue(List.of(
            Map.of("Type", "무기", "Name", "+11 세르카 고대 무기", "WeaponStats", Map.of("WeaponPower", Map.of("Value", 167706))),
            Map.of("Type", "투구", "Name", "+11 세르카 고대 투구", "MainStatValue", 96801),
            Map.of("Type", "어깨", "Name", "+11 세르카 고대 어깨", "MainStatValue", 103023),
            Map.of("Type", "상의", "Name", "+11 세르카 고대 상의", "MainStatValue", 77441),
            Map.of("Type", "하의", "Name", "+11 세르카 고대 하의", "MainStatValue", 83664),
            Map.of("Type", "장갑", "Name", "+11 세르카 고대 장갑", "MainStatValue", 116161)
        ), JsonNode.class);
    }

    private JsonNode marketSnapshot() {
        return objectMapper.convertValue(Map.of(
            "updatedAt", "2026-05-29T00:00:00Z",
            "groups", List.of(
                group("honing-materials", List.of(
                    item("운명의 파괴석 결정", 1688, 100),
                    item("운명의 수호석 결정", 50, 100),
                    item("위대한 운명의 돌파석", 14, 1),
                    item("상급 아비도스 융화 재료", 142, 1),
                    item("운명의 파편 주머니(소)", 60, 1),
                    item("운명의 파편 주머니(대)", 173, 1)
                )),
                group("honing-supports", List.of(
                    item("용암의 숨결", 365, 1),
                    item("빙하의 숨결", 290, 1)
                )),
                group("legendary-avatars", List.of(
                    item("전설 머리", 50000, 1, "머리"),
                    item("전설 상의", 60000, 1, "상의")
                )),
                group("gems", List.of(
                    gemItem("7레벨 겁화의 보석", 100000, 7, "damage", 24),
                    gemItem("8레벨 겁화의 보석", 200000, 8, "damage", 30)
                ))
            )
        ), JsonNode.class);
    }

    private Map<String, Object> group(String id, List<Map<String, Object>> items) {
        return Map.of("id", id, "items", items);
    }

    private Map<String, Object> item(String name, int price, int bundleCount) {
        return Map.of("name", name, "currentMinPrice", price, "bundleCount", bundleCount);
    }

    private Map<String, Object> item(String name, int price, int bundleCount, String categoryName) {
        return Map.of("name", name, "currentMinPrice", price, "bundleCount", bundleCount, "categoryName", categoryName);
    }

    private Map<String, Object> gemItem(String name, int price, int level, String effectType, int effectValue) {
        return Map.of(
            "name", name,
            "currentMinPrice", price,
            "bundleCount", 1,
            "gemLevel", level,
            "gemEffectType", effectType,
            "gemEffectValue", effectValue
        );
    }

    private JsonNode readFixture(String fixture) throws IOException {
        try (InputStream inputStream = getClass().getClassLoader().getResourceAsStream(fixture)) {
            assertThat(inputStream).as("fixture %s should exist", fixture).isNotNull();
            return objectMapper.readTree(inputStream);
        }
    }
}
