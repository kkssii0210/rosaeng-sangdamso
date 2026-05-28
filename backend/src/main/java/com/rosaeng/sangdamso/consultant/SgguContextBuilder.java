package com.rosaeng.sangdamso.consultant;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.arrayItems;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.child;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.isArray;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.isObject;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.orderedMap;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.stripMarkup;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

@Component
public class SgguContextBuilder {

    private static final int MAX_MESSAGE_CHARS = 800;
    private static final int MAX_CONVERSATION_TURNS = 8;
    private static final Pattern WHITESPACE = Pattern.compile("\\s+");
    private static final Set<String> SUPPORTED_CONVERSATION_ROLES = Set.of("user", "assistant", "sggu");
    private static final Set<String> ACCESSORY_TYPES = Set.of("목걸이", "귀걸이", "반지", "팔찌");
    private static final Set<String> KEY_EQUIPMENT_TYPES = Set.of("무기", "투구", "어깨", "상의", "하의", "장갑");

    public String sanitizeMessage(String message) {
        String normalized = WHITESPACE.matcher(String.valueOf(message == null ? "" : message)).replaceAll(" ").trim();

        if (normalized.length() <= MAX_MESSAGE_CHARS) {
            return normalized;
        }

        return normalized.substring(0, MAX_MESSAGE_CHARS);
    }

    public List<Map<String, String>> normalizeConversation(JsonNode conversation) {
        JsonNode source = isArray(conversation) ? conversation : child(conversation, "conversation");
        List<Map<String, String>> normalized = new ArrayList<>();

        for (JsonNode item : arrayItems(source)) {
            String rawRole = textValue(item, "role", "Role");
            String content = sanitizeMessage(textValue(item, "content", "text", "Text"));

            if (!SUPPORTED_CONVERSATION_ROLES.contains(rawRole) || content.isEmpty()) {
                continue;
            }

            normalized.add(Map.of("role", "sggu".equals(rawRole) ? "assistant" : rawRole, "content", content));
        }

        int fromIndex = Math.max(0, normalized.size() - MAX_CONVERSATION_TURNS);
        return normalized.subList(fromIndex, normalized.size());
    }

    public Map<String, Object> build(JsonNode armory, JsonNode specUpRecommendation) {
        JsonNode profile = objectValue(armory, "profile");
        JsonNode equipment = arrayValue(armory, "equipment");
        JsonNode arkPassive = objectValue(armory, "arkPassive");
        JsonNode skills = arrayValue(armory, "skills");
        JsonNode engravings = arrayValue(armory, "engravings");
        JsonNode gems = arrayValue(armory, "gems");
        JsonNode avatars = arrayValue(armory, "avatars");
        JsonNode recommendation = objectValue(specUpRecommendation, "Recommendation", "recommendation");

        if (!isObject(recommendation)) {
            recommendation = specUpRecommendation;
        }

        return orderedMap(
            "profile", orderedMap(
                "characterName", textValue(profile, "CharacterName", "characterName"),
                "serverName", textValue(profile, "ServerName", "serverName"),
                "className", textValue(profile, "CharacterClassName", "characterClassName"),
                "itemLevel", textValue(profile, "ItemAvgLevel", "itemAvgLevel"),
                "combatLevel", textValue(profile, "CharacterLevel", "characterLevel"),
                "combatPower", numberValue(profile, "CombatPower", "combatPower")
            ),
            "accessories", arrayItems(equipment).stream()
                .filter(item -> ACCESSORY_TYPES.contains(textValue(item, "Type", "type")))
                .map(this::summarizeEquipmentItem)
                .toList(),
            "keyEquipment", arrayItems(equipment).stream()
                .filter(item -> KEY_EQUIPMENT_TYPES.contains(textValue(item, "Type", "type")))
                .map(this::summarizeEquipmentItem)
                .toList(),
            "arkPassiveSummary", orderedMap(
                "points", arrayItems(arrayValue(arkPassive, "Points", "points")).stream()
                    .map(this::summarizeArkPassivePoint)
                    .filter(value -> !value.isBlank())
                    .limit(6)
                    .toList(),
                "effects", arrayItems(arrayValue(arkPassive, "Effects", "effects")).stream()
                    .map(this::summarizeArkPassiveEffect)
                    .filter(value -> !value.isBlank())
                    .limit(10)
                    .toList()
            ),
            "skillSummary", arrayItems(skills).stream()
                .map(this::summarizeSkill)
                .filter(value -> !value.isBlank())
                .limit(12)
                .toList(),
            "engravingSummary", String.join(", ", arrayItems(engravings).stream()
                .map(engraving -> (textValue(engraving, "Name", "name") + " " + textValue(engraving, "Level", "level")).trim())
                .filter(value -> !value.isBlank())
                .toList()),
            "gemSummary", arrayItems(gems).stream()
                .map(this::summarizeGem)
                .filter(value -> !value.isBlank())
                .limit(12)
                .toList(),
            "avatarSummary", arrayItems(avatars).stream()
                .map(avatar -> (textValue(avatar, "Type", "type") + " " + textValue(avatar, "Grade", "grade")).trim())
                .filter(value -> !value.isBlank())
                .limit(8)
                .toList(),
            "topSpecUps", arrayItems(arrayValue(recommendation, "TopCandidates", "topCandidates")).stream()
                .map(this::summarizeSpecUp)
                .limit(5)
                .toList()
        );
    }

    private Map<String, Object> summarizeEquipmentItem(JsonNode item) {
        return orderedMap(
            "slot", textValue(item, "Type", "type"),
            "name", textValue(item, "Name", "name"),
            "mainStat", numberValue(item, "MainStatValue", "mainStatValue"),
            "specialOptions", arrayItems(arrayValue(item, "SpecialOptionSummary", "specialOptionSummary")).stream()
                .map(JsonNode::asString)
                .limit(4)
                .toList()
        );
    }

    private Map<String, Object> summarizeSpecUp(JsonNode candidate) {
        return orderedMap(
            "type", textValue(candidate, "Type", "type"),
            "label", textValue(candidate, "Label", "label"),
            "target", textValue(candidate, "Target", "target"),
            "costGold", numberValue(candidate, "NetCostGold", "netCostGold", "CostGold", "costGold"),
            "gainPercent", numberValue(candidate, "GainPercent", "gainPercent"),
            "efficiencyScore", numberValue(candidate, "EfficiencyScore", "efficiencyScore"),
            "caveat", textValue(candidate, "Caveat", "caveat")
        );
    }

    private String summarizeGem(JsonNode gem) {
        String label = textValue(gem, "SkillName", "skillName", "Name", "name");
        String level = textValue(gem, "Level", "level");

        if (label.isBlank()) {
            return "";
        }

        return level.isBlank() ? label : label + " " + level + "레벨";
    }

    private String summarizeArkPassivePoint(JsonNode point) {
        return (textValue(point, "Name", "name", "Type", "type") + " "
            + textValue(point, "Value", "value", "Point", "point")).trim();
    }

    private String summarizeArkPassiveEffect(JsonNode effect) {
        return (textValue(effect, "Name", "name") + " "
            + stripMarkup(textValue(effect, "Description", "description"))).trim();
    }

    private String summarizeSkill(JsonNode skill) {
        String name = textValue(skill, "Name", "name");

        if (name.isBlank()) {
            return "";
        }

        String level = textValue(skill, "Level", "level");
        String type = textValue(skill, "Type", "type", "SkillType", "skillType");
        String rune = textValue(objectValue(skill, "Rune", "rune"), "Name", "name");
        String tripods = String.join("/", arrayItems(arrayValue(skill, "Tripods", "tripods")).stream()
            .filter(tripod -> !"false".equalsIgnoreCase(textValue(tripod, "IsSelected", "isSelected")))
            .map(tripod -> textValue(tripod, "Name", "name"))
            .filter(value -> !value.isBlank())
            .limit(3)
            .toList());
        List<String> parts = new ArrayList<>();
        parts.add(name);

        if (!level.isBlank()) {
            parts.add("Lv." + level);
        }

        if (!type.isBlank()) {
            parts.add(type);
        }

        if (!rune.isBlank()) {
            parts.add(rune);
        }

        if (!tripods.isBlank()) {
            parts.add(tripods);
        }

        return String.join(" ", parts);
    }

    private JsonNode objectValue(JsonNode node, String... keys) {
        JsonNode value = nodeValue(node, keys);
        return isObject(value) ? value : null;
    }

    private JsonNode arrayValue(JsonNode node, String... keys) {
        JsonNode value = nodeValue(node, keys);
        return isArray(value) ? value : null;
    }

    private JsonNode nodeValue(JsonNode node, String... keys) {
        if (node == null || node.isNull()) {
            return null;
        }

        for (String key : keys) {
            JsonNode value = child(node, key);

            if (value != null && !value.isNull()) {
                return value;
            }
        }

        return null;
    }

    private String textValue(JsonNode node, String... keys) {
        JsonNode value = nodeValue(node, keys);

        if (value == null || value.isNull()) {
            return "";
        }

        return value.asString();
    }

    private Double numberValue(JsonNode node, String... keys) {
        JsonNode value = nodeValue(node, keys);

        if (value == null || value.isNull()) {
            return null;
        }

        if (value.isNumber()) {
            return value.asDouble();
        }

        try {
            return Double.parseDouble(value.asString().replace(",", "").trim());
        } catch (NumberFormatException exception) {
            return null;
        }
    }
}
