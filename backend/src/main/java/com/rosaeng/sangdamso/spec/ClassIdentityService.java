package com.rosaeng.sangdamso.spec;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.arrayItems;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.child;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.orderedMap;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.stripMarkup;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.text;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.toJsonNode;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import tools.jackson.databind.JsonNode;

public class ClassIdentityService {

    private static final String UNKNOWN_CONFIDENCE = "unverified";
    private static final Map<String, RuleDefinition> RULES = createRules();

    public JsonNode build(JsonNode profile, Map<String, JsonNode> context) {
        return getClassIdentityEffects(text(profile, "CharacterClassName"), context);
    }

    public JsonNode getClassIdentityEffects(String className, Map<String, JsonNode> context) {
        String normalizedClassName = className == null ? "" : className.trim();
        RuleDefinition rule = RULES.getOrDefault(normalizedClassName, new RuleDefinition(normalizedClassName, List.of(), List.of()));

        return toJsonNode(orderedMap(
            "ClassName", rule.className(),
            "IdentityNames", new ArrayList<>(rule.identityNames()),
            "Effects", rule.effects().stream()
                .map(effect -> applyActivation(effect, context == null ? Map.of() : context))
                .toList(),
            "HasManualRule", RULES.containsKey(normalizedClassName)
        ));
    }

    private Map<String, Object> applyActivation(EffectDefinition effect, Map<String, JsonNode> context) {
        List<String> arkPassiveNames = collectArkPassiveNames(context.get("arkPassive"));
        List<String> engravingNames = collectEngravingNames(context.get("engravings"));
        List<String> contextNames = new ArrayList<>();
        contextNames.addAll(arkPassiveNames);
        contextNames.addAll(engravingNames);
        List<String> matchedAnyNames = matchedNames(contextNames, effect.requiredAnyNames());
        List<String> matchedArkPassiveNames = matchedNames(arkPassiveNames, effect.requiredArkPassiveNames());
        List<String> matchedEngravingNames = matchedNames(engravingNames, effect.requiredEngravingNames());
        boolean hasRequirements = !effect.requiredAnyNames().isEmpty()
            || !effect.requiredArkPassiveNames().isEmpty()
            || !effect.requiredEngravingNames().isEmpty();
        boolean isActive = (effect.requiredAnyNames().isEmpty() || !matchedAnyNames.isEmpty())
            && (effect.requiredArkPassiveNames().isEmpty() || !matchedArkPassiveNames.isEmpty())
            && (effect.requiredEngravingNames().isEmpty() || !matchedEngravingNames.isEmpty());
        Map<String, Object> activation = orderedMap(
            "RequiredAnyNames", effect.requiredAnyNames(),
            "RequiredArkPassiveNames", effect.requiredArkPassiveNames(),
            "RequiredEngravingNames", effect.requiredEngravingNames(),
            "MatchedAnyNames", matchedAnyNames,
            "MatchedArkPassiveNames", matchedArkPassiveNames,
            "MatchedEngravingNames", matchedEngravingNames,
            "IsActive", hasRequirements ? isActive : true
        );
        Map<String, Object> output = effect.toMap();
        output.put("IsActive", activation.get("IsActive"));
        output.put("Activation", activation);

        return output;
    }

    private List<String> collectArkPassiveNames(JsonNode arkPassive) {
        List<String> names = new ArrayList<>();

        for (JsonNode effect : arrayItems(child(arkPassive, "Effects"))) {
            addIfPresent(names, text(effect, "Description"));
            addIfPresent(names, text(effect, "Name"));
        }

        return names;
    }

    private List<String> collectEngravingNames(JsonNode engravings) {
        List<String> names = new ArrayList<>();

        for (JsonNode engraving : arrayItems(engravings)) {
            addIfPresent(names, text(engraving, "Name"));
            addIfPresent(names, text(engraving, "Description"));
        }

        return names;
    }

    private List<String> matchedNames(List<String> values, List<String> requiredNames) {
        List<String> matched = new ArrayList<>();

        for (String requiredName : requiredNames) {
            if (values.stream().anyMatch(value -> includesRuleName(value, requiredName))) {
                matched.add(requiredName);
            }
        }

        return matched;
    }

    private boolean includesRuleName(String value, String requiredName) {
        return cleanText(value).contains(cleanText(requiredName));
    }

    private String cleanText(String value) {
        return stripMarkup(value == null ? "" : value).replaceAll("\\s+", " ").trim();
    }

    private void addIfPresent(List<String> values, String value) {
        if (value != null && !value.isBlank()) {
            values.add(value);
        }
    }

    private static Map<String, RuleDefinition> createRules() {
        Map<String, RuleDefinition> rules = new LinkedHashMap<>();
        rules.put("버서커", rule("버서커", List.of("분노", "폭주"), List.of(effect(
            "berserker-technique-burst-critical-rate",
            "폭주 치명타 적중률",
            "critRate",
            50,
            "폭주 상태",
            "identity",
            "self",
            "user",
            "verified",
            "광전사의 비기 버서커는 폭주 상태에서 치명타 적중률이 50% 증가한다.",
            List.of("광전사의 비기"),
            List.of(),
            List.of()
        ))));
        rules.put("디스트로이어", rule("디스트로이어", List.of("중력 코어", "중력 가중 모드"), List.of()));
        rules.put("워로드", rule("워로드", List.of("방어 태세", "전장의 방패"), List.of()));
        rules.put("홀리나이트", rule("홀리나이트", List.of("신의 집행자", "신성의 오라"), List.of()));
        rules.put("슬레이어", rule("슬레이어", List.of("분노", "폭주"), List.of(effect(
            "slayer-burst-critical-rate",
            "폭주 치명타 적중률",
            "critRate",
            30,
            "폭주 상태",
            "identity",
            "self",
            "user",
            "verified",
            "처단자/포식자 슬레이어는 폭주 상태에서 치명타 적중률이 30% 증가한다.",
            List.of("처단자", "포식자"),
            List.of(),
            List.of()
        ))));
        rules.put("배틀마스터", rule("배틀마스터", List.of("엘리멘탈 버블"), List.of()));
        rules.put("인파이터", rule("인파이터", List.of("기력", "충격"), List.of()));
        rules.put("기공사", rule("기공사", List.of("금강선공"), List.of()));
        rules.put("창술사", rule("창술사", List.of("스탠스 전환"), List.of()));
        rules.put("스트라이커", rule("스트라이커", List.of("엘리멘탈 버블"), List.of()));
        rules.put("브레이커", rule("브레이커", List.of("투지", "권왕태세"), List.of()));
        rules.put("데빌헌터", rule("데빌헌터", List.of("무기 스탠스"), List.of()));
        rules.put("블래스터", rule("블래스터", List.of("화력 게이지", "포격 모드"), List.of()));
        rules.put("호크아이", rule("호크아이", List.of("실버호크"), List.of()));
        rules.put("스카우터", rule("스카우터", List.of("하이퍼 싱크"), List.of()));
        rules.put("건슬링어", rule("건슬링어", List.of("무기 스탠스"), List.of()));
        rules.put("아르카나", rule("아르카나", List.of("카드 덱"), List.of()));
        rules.put("서머너", rule("서머너", List.of("고대 정령"), List.of()));
        rules.put("바드", rule("바드", List.of("세레나데"), List.of()));
        rules.put("소서리스", rule("소서리스", List.of("마력 방출", "점멸"), List.of()));
        rules.put("블레이드", rule("블레이드", List.of("블레이드 아츠"), List.of()));
        rules.put("데모닉", rule("데모닉", List.of("잠식", "악마화"), List.of()));
        rules.put("리퍼", rule("리퍼", List.of("페르소나"), List.of()));
        rules.put("소울이터", rule("소울이터", List.of("빙의 게이지", "영혼석", "사신화"), List.of(effect(
            "souleater-full-moon-reaper-form-critical-rate",
            "사신화 치명타 적중률",
            "critRate",
            20,
            "사신화 상태",
            "identity",
            "사신 스킬",
            "user",
            "verified",
            "만월의 집행자 소울이터는 사신화 시 치명타 적중률이 20% 증가한다.",
            List.of(),
            List.of("만월의 집행자"),
            List.of()
        ))));
        rules.put("도화가", rule("도화가", List.of("조화 게이지"), List.of()));
        rules.put("기상술사", rule("기상술사", List.of("여우비"), List.of()));
        rules.put("환수사", rule("환수사", List.of("둔갑", "환수"), List.of()));

        return Map.copyOf(rules);
    }

    private static RuleDefinition rule(String className, List<String> identityNames, List<EffectDefinition> effects) {
        return new RuleDefinition(className, identityNames, effects);
    }

    private static EffectDefinition effect(
        String id,
        String name,
        String kind,
        Integer value,
        String appliesWhen,
        String scope,
        String target,
        String source,
        String confidence,
        String notes,
        List<String> requiredAnyNames,
        List<String> requiredArkPassiveNames,
        List<String> requiredEngravingNames
    ) {
        return new EffectDefinition(
            id,
            name,
            kind,
            value,
            "percent",
            "additive",
            scope,
            appliesWhen,
            target,
            source,
            confidence,
            notes,
            requiredAnyNames,
            requiredArkPassiveNames,
            requiredEngravingNames
        );
    }

    private record RuleDefinition(String className, List<String> identityNames, List<EffectDefinition> effects) {
    }

    private record EffectDefinition(
        String id,
        String name,
        String kind,
        Integer value,
        String unit,
        String operation,
        String scope,
        String appliesWhen,
        String target,
        String source,
        String confidence,
        String notes,
        List<String> requiredAnyNames,
        List<String> requiredArkPassiveNames,
        List<String> requiredEngravingNames
    ) {
        Map<String, Object> toMap() {
            return orderedMap(
                "Id", id,
                "Name", name,
                "Kind", kind,
                "Value", value,
                "Unit", unit,
                "Operation", operation,
                "Scope", scope,
                "AppliesWhen", appliesWhen,
                "Target", target,
                "Source", source,
                "Confidence", confidence == null ? UNKNOWN_CONFIDENCE : confidence,
                "Notes", notes,
                "RequiredAnyNames", requiredAnyNames,
                "RequiredArkPassiveNames", requiredArkPassiveNames,
                "RequiredEngravingNames", requiredEngravingNames
            );
        }
    }
}
