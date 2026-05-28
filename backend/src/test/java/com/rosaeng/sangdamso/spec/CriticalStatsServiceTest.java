package com.rosaeng.sangdamso.spec;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class CriticalStatsServiceTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final CriticalStatsService service = new CriticalStatsService();

    @Test
    void parsesCriticalEffectTextByKind() {
        JsonNode critRate = service.parseCriticalEffectText("치명타 적중률 +1.55%");
        JsonNode critDamage = service.parseCriticalEffectText("치명타 피해가 6.8% 증가한다.");
        JsonNode outgoing = service.parseCriticalEffectText("공격이 치명타로 적중 시 적에게 주는 피해가 1.5% 증가한다.");

        assertThat(critRate.get(0).get("Kind").asString()).isEqualTo("critRate");
        assertThat(critRate.get(0).get("Value").asDouble()).isEqualTo(1.55);
        assertThat(critDamage.get(0).get("Kind").asString()).isEqualTo("critDamage");
        assertThat(outgoing.get(0).get("Kind").asString()).isEqualTo("criticalOutgoingDamage");
    }

    @Test
    void buildsGlobalConditionalAndSkillCriticalBuckets() {
        JsonNode result = service.build(Map.of(
            "profile", json(Map.of("Stats", List.of(Map.of(
                "Type", "치명",
                "Tooltip", List.of("<textformat>치명타 적중률이 <font color='#99ff99'>24.37%</font> 증가합니다.</textformat>")
            )))),
            "equipment", json(List.of(
                Map.of("Type", "반지", "Name", "도래한 결전의 반지", "DetailSections", List.of(Map.of(
                    "title", "연마 효과",
                    "lines", List.of("치명타 적중률 +1.55%", "치명타 피해 +4.00%")
                ))),
                Map.of("Type", "팔찌", "Name", "찬란한 구원자의 팔찌", "DetailSections", List.of(Map.of(
                    "title", "팔찌 효과",
                    "lines", List.of("치명타 피해가 6.8% 증가한다.", "공격이 치명타로 적중 시 적에게 주는 피해가 1.5% 증가한다.")
                )))
            )),
            "engravings", json(List.of(
                Map.of("Name", "예리한 둔기", "Description", "치명타 피해량이 52.00% 증가하지만, 공격 시 일정 확률로 20.00% 감소된 피해를 준다."),
                Map.of("Name", "아드레날린", "Description", "최대 6중첩 도달 시 치명타 적중률이 추가로 20.00% 증가한다.")
            )),
            "skills", json(List.of(Map.of(
                "Name", "루나틱 엣지",
                "Tripods", List.of(
                    Map.of("Name", "예리한 일격", "IsSelected", true, "Tooltip", "<font>치명타 피해가 <FONT COLOR='#99ff99'>80.0%</FONT> 증가한다.</font>"),
                    Map.of("Name", "미선택 치명", "IsSelected", false, "Tooltip", "<font>치명타 피해가 <FONT COLOR='#99ff99'>999.0%</FONT> 증가한다.</font>")
                )
            ))),
            "arkPassive", json(Map.of("Effects", List.of(Map.of(
                "Description", "깨달음 1티어 영혼친화력 Lv.3",
                "ToolTip", "{\"Element_002\":{\"type\":\"MultiTextBox\",\"value\":\"치명타 적중률이 <FONT COLOR='#99ff99'>14.0%</FONT> 증가하고 영혼석 사용 시 빙의 게이지가 <FONT COLOR='#99ff99'>5.0%</FONT> 회복된다.\"}}"
            )))),
            "arkGrid", json(Map.of("Slots", List.of(Map.of(
                "Name", "혼돈의 달 코어",
                "Tooltip", "{\"Element_006\":{\"type\":\"ItemPartBox\",\"value\":{\"Element_001\":\"치명타 시 적에게 주는 피해가 <FONT COLOR='#99ff99'>0.55%</FONT> 증가한다.\"}}}",
                "Gems", List.of()
            ))))
        ));

        assertThat(result.get("GlobalCriticalRatePercent").asDouble()).isEqualTo(39.92);
        assertThat(result.get("ConditionalCriticalRatePercent").asDouble()).isEqualTo(20.0);
        assertThat(result.get("GlobalCriticalDamageBonusPercent").asDouble()).isEqualTo(62.8);
        assertThat(result.get("ConditionalCriticalOutgoingDamagePercent").asDouble()).isEqualTo(2.05);
        assertThat(result.get("SkillSources").get(0).get("SourceName").asString()).isEqualTo("예리한 일격");
    }

    @Test
    void modelsMasterStacksAndBluntThornConversion() {
        JsonNode master = service.build(Map.of("arkPassive", json(Map.of("Effects", List.of(Map.of(
            "Description", "진화 4티어 달인 Lv.1",
            "ToolTip", "{\"Element_002\":{\"type\":\"MultiTextBox\",\"value\":\"치명타 적중률 <FONT COLOR='#99ff99'>+1.4%</FONT> / 추가 피해 <FONT COLOR='#99ff99'>+1.7%</FONT>, 최대 <FONT COLOR='#99ff99'>5</FONT>중첩\"}}"
        ))))));
        JsonNode bluntThorn = service.build(Map.of(
            "profile", json(Map.of("Stats", List.of(Map.of("Type", "치명", "Tooltip", List.of("치명타 적중률이 73.56% 증가합니다."))))),
            "engravings", json(List.of(Map.of(
                "Name", "아드레날린",
                "Description", "공격력이 0.90% 증가하며 (최대 6중첩) 해당 효과가 최대 중첩 도달 시 치명타 적중률이 추가로 20.00% 증가한다."
            ))),
            "arkPassive", json(Map.of("Effects", List.of(
                Map.of("Description", "진화 2티어 예리한 감각 Lv.1", "ToolTip", "{\"Element_002\":{\"type\":\"MultiTextBox\",\"value\":\"치명타 적중률이 <FONT COLOR='#99ff99'>4.0% </font>증가하고, 진화형 피해가 <FONT COLOR='#99ff99'>5.0% </font>증가합니다.\"}}"),
                Map.of("Description", "진화 3티어 혼신의 강타 Lv.2", "ToolTip", "{\"Element_002\":{\"type\":\"MultiTextBox\",\"value\":\"치명타 적중률이 <FONT COLOR='#99ff99'>24.0% </font>증가하고, 진화형 피해가 <FONT COLOR='#99ff99'>4.0% </font>증가합니다.\"}}"),
                Map.of("Description", "진화 5티어 뭉툭한 가시 Lv.2", "ToolTip", "{\"Element_002\":{\"type\":\"MultiTextBox\",\"value\":\"진화형 피해가 <FONT COLOR='#99ff99'>15.0% </font>증가합니다. 치명타가 발생할 확률이 최대 <FONT COLOR='#ff9999'>80.0% </font>로 제한됩니다. 공격 시, 초과한 모든 치명타가 발생할 확률의 <FONT COLOR='#99ff99'>150.0%</font>가 진화형 피해로 전환됩니다. 이 노드에 의한 진화형 피해는 최대 <FONT COLOR='#99ff99'>75.0%</font>까지 적용됩니다.\"}}")
            )))
        ));

        assertThat(master.get("GlobalCriticalRatePercent").asDouble()).isEqualTo(7.0);
        assertThat(master.get("GlobalAdditionalDamagePercent").asDouble()).isEqualTo(8.5);
        assertThat(bluntThorn.get("EffectiveCriticalRatePercent").asDouble()).isEqualTo(80.0);
        assertThat(bluntThorn.get("FixedEvolutionDamagePercent").asDouble()).isEqualTo(24.0);
        assertThat(bluntThorn.get("ConvertedEvolutionDamagePercent").asDouble()).isEqualTo(62.34);
        assertThat(bluntThorn.get("EvolutionDamagePercent").asDouble()).isEqualTo(86.34);
    }

    @Test
    void usesOnlyActiveVerifiedClassIdentityEffects() {
        JsonNode result = service.build(Map.of("classIdentityEffects", json(Map.of(
            "ClassName", "소울이터",
            "Effects", List.of(
                Map.of("Name", "사신화 치명타 적중률", "Kind", "critRate", "Scope", "identity", "Confidence", "unverified"),
                Map.of("Name", "검증된 아이덴티티 치명타", "Kind", "critRate", "Value", 10, "Scope", "identity", "AppliesWhen", "아이덴티티 상태", "Target", "특정 스킬", "Confidence", "verified"),
                Map.of("Name", "비활성 아이덴티티 치명타", "Kind", "critRate", "Value", 99, "Scope", "identity", "Target", "특정 스킬", "Confidence", "verified", "IsActive", false)
            )
        ))));

        assertThat(result.get("ConditionalCriticalRatePercent").asDouble()).isEqualTo(10.0);
        assertThat(result.get("ConditionalSources").size()).isEqualTo(1);
        assertThat(result.get("ConditionalSources").get(0).get("SourceType").asString()).isEqualTo("classIdentity");
    }

    private JsonNode json(Object value) {
        return objectMapper.convertValue(value, JsonNode.class);
    }
}
