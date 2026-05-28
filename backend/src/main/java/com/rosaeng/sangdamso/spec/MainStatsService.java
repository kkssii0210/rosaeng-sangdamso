package com.rosaeng.sangdamso.spec;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.arrayItems;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.decimal;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.orderedMap;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.text;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.toJsonNode;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import tools.jackson.databind.JsonNode;

public class MainStatsService {

    public JsonNode build(JsonNode equipment) {
        List<Map<String, Object>> items = new ArrayList<>();

        List<JsonNode> equipmentItems = arrayItems(equipment);

        for (int index = 0; index < equipmentItems.size(); index++) {
            JsonNode item = equipmentItems.get(index);
            Double value = decimal(item, "MainStatValue");

            if (value == null || value <= 0) {
                continue;
            }

            items.add(orderedMap(
                "Index", index,
                "Type", text(item, "Type"),
                "Name", text(item, "Name"),
                "Value", wholeNumberWhenPossible(value)
            ));
        }

        double total = items.stream()
            .map(entry -> ((Number) entry.get("Value")).doubleValue())
            .reduce(0.0, Double::sum);

        return toJsonNode(orderedMap(
            "Items", items,
            "MainStatTotal", wholeNumberWhenPossible(total)
        ));
    }

    private Number wholeNumberWhenPossible(double value) {
        return value % 1 == 0 ? (int) value : value;
    }
}
