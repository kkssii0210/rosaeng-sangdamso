package com.rosaeng.sangdamso.character.cards;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.arrayItems;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.child;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.integer;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.orderedMap;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.parseDouble;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.parseInteger;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.stripMarkup;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.text;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.toJsonNode;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import tools.jackson.databind.JsonNode;

public class CardsNormalizer {

    private static final Pattern CARD_EFFECT_NAME_PATTERN = Pattern.compile(
        "^(?<setName>.+?)\\s+(?<setCount>\\d+)세트(?:\\s*\\((?<awakeTotal>\\d+)각성합계\\))?$"
    );
    private static final Pattern DAMAGE_REDUCTION_PATTERN = Pattern.compile("^(?<damageType>.+?)\\s*피해\\s*감소\\s*\\+?(?<value>\\d+(?:\\.\\d+)?)\\s*%$");
    private static final Pattern ELEMENT_CONVERSION_PATTERN = Pattern.compile("^공격\\s*속성을\\s*(?<element>.+?)속성으로\\s*변환$");
    private static final Pattern ELEMENT_DAMAGE_PATTERN = Pattern.compile("^(?<element>.+?)속성\\s*피해\\s*\\+?(?<value>\\d+(?:\\.\\d+)?)\\s*%$");
    private static final Pattern OUTGOING_DAMAGE_PATTERN = Pattern.compile("^적에게\\s*주는\\s*피해\\s*\\+?(?<value>\\d+(?:\\.\\d+)?)\\s*%$");
    private static final Pattern ADDITIONAL_DAMAGE_PATTERN = Pattern.compile("^추가\\s*피해\\s*\\+?(?<value>\\d+(?:\\.\\d+)?)\\s*%$");
    private static final Pattern CRIT_RATE_PATTERN = Pattern.compile("^치명타\\s*적중률\\s*\\+?(?<value>\\d+(?:\\.\\d+)?)\\s*%$");
    private static final Pattern CRIT_DAMAGE_PATTERN = Pattern.compile("^치명타\\s*피해(?:량)?\\s*\\+?(?<value>\\d+(?:\\.\\d+)?)\\s*%$");

    public JsonNode normalize(JsonNode cards) {
        List<Map<String, Object>> equippedCards = arrayItems(child(cards, "Cards")).stream()
            .map(this::normalizeCard)
            .toList();
        List<Map<String, Object>> effects = arrayItems(child(cards, "Effects")).stream()
            .map(this::normalizeCardEffect)
            .toList();
        List<Map<String, Object>> activeEffects = new ArrayList<>();

        for (Map<String, Object> effect : effects) {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> items = (List<Map<String, Object>>) effect.get("Items");

            for (Map<String, Object> item : items) {
                Map<String, Object> activeEffect = orderedMap();
                activeEffect.putAll(item);
                activeEffect.put("EffectIndex", effect.get("Index"));
                activeEffect.put("CardSlots", effect.get("CardSlots"));
                activeEffects.add(activeEffect);
            }
        }

        int awakeTotal = equippedCards.stream()
            .map(card -> (Integer) card.get("AwakeCount"))
            .filter(value -> value != null)
            .mapToInt(Integer::intValue)
            .sum();

        return toJsonNode(orderedMap(
            "Cards", equippedCards,
            "Effects", effects,
            "ActiveEffects", activeEffects,
            "AwakeTotal", awakeTotal
        ));
    }

    private Map<String, Object> normalizeCard(JsonNode card) {
        return orderedMap(
            "Slot", integer(card, "Slot"),
            "Name", text(card, "Name"),
            "Icon", text(card, "Icon"),
            "Grade", text(card, "Grade"),
            "AwakeCount", integer(card, "AwakeCount"),
            "AwakeTotal", integer(card, "AwakeTotal")
        );
    }

    private Map<String, Object> normalizeCardEffect(JsonNode effect) {
        List<Map<String, Object>> items = arrayItems(child(effect, "Items")).stream()
            .map(this::normalizeCardEffectItem)
            .toList();
        String setName = items.stream()
            .map(item -> String.valueOf(item.get("SetName")))
            .filter(value -> !value.isBlank())
            .findFirst()
            .orElse("");

        return orderedMap(
            "Index", integer(effect, "Index"),
            "CardSlots", toJsonNode(arrayItems(child(effect, "CardSlots"))),
            "SetName", setName,
            "Items", items
        );
    }

    private Map<String, Object> normalizeCardEffectItem(JsonNode item) {
        String name = cleanText(text(item, "Name"));
        String description = cleanText(text(item, "Description"));
        Map<String, Object> normalized = orderedMap("Name", name, "Description", description);

        normalized.putAll(parseCardEffectName(name));
        normalized.putAll(parseCardEffectDescription(description));

        return normalized;
    }

    private Map<String, Object> parseCardEffectName(String name) {
        Matcher match = CARD_EFFECT_NAME_PATTERN.matcher(cleanText(name));

        if (!match.find()) {
            return orderedMap("SetName", cleanText(name), "SetCount", null, "AwakeTotal", null);
        }

        return orderedMap(
            "SetName", match.group("setName"),
            "SetCount", parseInteger(match.group("setCount")),
            "AwakeTotal", parseInteger(match.group("awakeTotal"))
        );
    }

    private Map<String, Object> parseCardEffectDescription(String description) {
        Matcher damageReductionMatch = DAMAGE_REDUCTION_PATTERN.matcher(description);

        if (damageReductionMatch.find()) {
            return orderedMap(
                "Kind", "damageReduction",
                "DamageType", damageReductionMatch.group("damageType"),
                "Value", parseDouble(damageReductionMatch.group("value")),
                "Unit", "%"
            );
        }

        Matcher elementConversionMatch = ELEMENT_CONVERSION_PATTERN.matcher(description);

        if (elementConversionMatch.find()) {
            return orderedMap("Kind", "elementConversion", "Element", elementConversionMatch.group("element"));
        }

        Matcher elementDamageMatch = ELEMENT_DAMAGE_PATTERN.matcher(description);

        if (elementDamageMatch.find()) {
            return orderedMap(
                "Kind", "elementDamage",
                "Element", elementDamageMatch.group("element"),
                "Value", parseDouble(elementDamageMatch.group("value")),
                "Unit", "%"
            );
        }

        return parseDamagePercentDescription(description);
    }

    private Map<String, Object> parseDamagePercentDescription(String description) {
        Matcher outgoingDamageMatch = OUTGOING_DAMAGE_PATTERN.matcher(description);

        if (outgoingDamageMatch.find()) {
            return orderedMap("Kind", "outgoingDamage", "Value", parseDouble(outgoingDamageMatch.group("value")), "Unit", "%");
        }

        Matcher additionalDamageMatch = ADDITIONAL_DAMAGE_PATTERN.matcher(description);

        if (additionalDamageMatch.find()) {
            return orderedMap("Kind", "additionalDamage", "Value", parseDouble(additionalDamageMatch.group("value")), "Unit", "%");
        }

        Matcher critRateMatch = CRIT_RATE_PATTERN.matcher(description);

        if (critRateMatch.find()) {
            return orderedMap("Kind", "critRate", "Value", parseDouble(critRateMatch.group("value")), "Unit", "%");
        }

        Matcher critDamageMatch = CRIT_DAMAGE_PATTERN.matcher(description);

        if (critDamageMatch.find()) {
            return orderedMap("Kind", "critDamage", "Value", parseDouble(critDamageMatch.group("value")), "Unit", "%");
        }

        return orderedMap("Kind", "unknown");
    }

    private String cleanText(String value) {
        return stripMarkup(value)
            .replace("||", " ")
            .replace("\\r", " ")
            .replace("\\n", " ")
            .replaceAll("\\s+", " ")
            .trim();
    }
}
