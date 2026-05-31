package com.rosaeng.sangdamso.efficiency;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.arrayItems;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.child;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.orderedMap;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.toJsonNode;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

@Component
public class AccessoryNormalizer {

    private static final Set<String> SUPPORTED_TYPES = Set.of("목걸이", "귀걸이", "반지");
    private static final Set<String> MAIN_STAT_NAMES = Set.of("힘", "민첩", "지능");
    private static final Set<String> COMBAT_STAT_NAMES = Set.of("치명", "특화", "신속");
    private static final int REFINEMENT_FIRST_OPTION = 7;
    private static final Pattern SECTION_VALUE_PATTERN = Pattern.compile("\\+\\s*(?<value>\\d+(?:,\\d{3})*(?:\\.\\d+)?)");
    private static final List<Rule> REFINEMENT_RULES = List.of(
        new Rule("목걸이", 42, "적에게 주는 피해", true, List.of(24, 30, 37, 54, 55, 69, 84, 90, 115, 120, 140, 200),
            Pattern.compile("^적에게 주는 피해(?:\\s*증가)?\\s*\\+?\\s*(?<value>\\d+(?:\\.\\d+)?)\\s*%")),
        new Rule("목걸이", 41, "추가 피해", true, List.of(31, 39, 48, 70, 90, 109, 117, 150, 160, 182, 260),
            Pattern.compile("^추가 피해\\s*\\+?\\s*(?<value>\\d+(?:\\.\\d+)?)\\s*%")),
        new Rule("귀걸이", 45, "공격력", true, List.of(19, 24, 29, 40, 42, 54, 66, 70, 89, 95, 109, 155),
            Pattern.compile("^공격력\\s*\\+?\\s*(?<value>\\d+(?:\\.\\d+)?)\\s*%")),
        new Rule("귀걸이", 46, "무기 공격력", true, List.of(36, 46, 56, 80, 82, 104, 126, 136, 172, 180, 210, 300),
            Pattern.compile("^무기 공격력\\s*\\+?\\s*(?<value>\\d+(?:\\.\\d+)?)\\s*%")),
        new Rule("반지", 49, "치명타 적중률", true, List.of(19, 24, 29, 40, 42, 54, 66, 70, 89, 95, 109, 155),
            Pattern.compile("^치명타 적중률\\s*\\+?\\s*(?<value>\\d+(?:\\.\\d+)?)\\s*%")),
        new Rule("반지", 50, "치명타 피해", true, List.of(48, 61, 74, 109, 110, 138, 170, 179, 230, 240, 282, 400),
            Pattern.compile("^치명타 피해\\s*\\+?\\s*(?<value>\\d+(?:\\.\\d+)?)\\s*%")),
        new Rule("", 53, "공격력", false, List.of(9, 14, 19, 24, 33, 40, 61, 68, 80, 118, 195, 390),
            Pattern.compile("^공격력\\s*\\+?\\s*(?<value>\\d+)$")),
        new Rule("", 54, "무기 공격력", false, List.of(23, 32, 50, 57, 75, 105, 147, 155, 195, 285, 480, 960),
            Pattern.compile("^무기 공격력\\s*\\+?\\s*(?<value>\\d+)$"))
    );

    public List<SearchOption> buildRefinementSearchOptions(JsonNode accessory) {
        String type = text(accessory, "Type", "type");
        List<SearchOption> options = new ArrayList<>();

        for (String line : refinementLinesOf(accessory)) {
            SearchOption option = searchOptionForLine(type, line);

            if (option != null && options.stream().noneMatch(existing -> existing.secondOption() == option.secondOption())) {
                options.add(option);
            }
        }

        return options;
    }

    public JsonNode normalizeAuctionAccessoryItem(JsonNode item, String type) {
        JsonNode statOption = firstOption(item, "STAT", MAIN_STAT_NAMES);
        List<JsonNode> combatStats = options(item, "STAT", COMBAT_STAT_NAMES);
        List<JsonNode> refinementOptions = options(item, "ACCESSORY_UPGRADE", null);
        JsonNode enlightenmentOption = firstArkPassivePoint(item);
        List<Map<String, Object>> sections = new ArrayList<>();
        List<String> basicLines = new ArrayList<>();

        if (statOption != null) {
            basicLines.add(formatStatLine(statOption));
        }
        combatStats.stream().map(this::formatStatLine).forEach(basicLines::add);
        if (!basicLines.isEmpty()) {
            sections.add(orderedMap("title", "기본 효과", "lines", basicLines));
        }
        if (!refinementOptions.isEmpty()) {
            sections.add(orderedMap("title", "연마 효과", "lines", refinementOptions.stream().map(this::formatRefinementLine).toList()));
        }
        if (enlightenmentOption != null) {
            sections.add(orderedMap("title", "아크 패시브 포인트 효과", "lines", List.of(formatStatLine(enlightenmentOption))));
        }

        return toJsonNode(orderedMap(
            "Type", type,
            "Name", text(item, "Name"),
            "Icon", text(item, "Icon"),
            "Grade", text(item, "Grade"),
            "Quality", intValue(item, "GradeQuality"),
            "Tier", intValue(item, "Tier"),
            "ItemLevel", intValue(item, "Level"),
            "BuyPrice", intValue(child(item, "AuctionInfo"), "BuyPrice"),
            "UpgradeLevel", intValue(child(item, "AuctionInfo"), "UpgradeLevel"),
            "TradeRemainCount", intValue(child(item, "AuctionInfo"), "TradeAllowCount"),
            "EndDate", text(child(item, "AuctionInfo"), "EndDate"),
            "MainStatValue", statOption == null ? null : number(statOption, "Value"),
            "EnlightenmentPoint", enlightenmentOption == null ? null : number(enlightenmentOption, "Value"),
            "DetailSections", sections
        ));
    }

    public Eligibility isEligibleAccessoryCandidate(JsonNode accessory) {
        String type = text(accessory, "Type", "type");

        if (!SUPPORTED_TYPES.contains(type)) {
            return new Eligibility(false, "UNSUPPORTED_TYPE");
        }
        if (!"고대".equals(text(accessory, "Grade", "grade"))) {
            return new Eligibility(false, "UNSUPPORTED_GRADE");
        }
        if (intValue(accessory, "Tier", "tier") != 4) {
            return new Eligibility(false, "UNSUPPORTED_TIER");
        }
        if (intValue(accessory, "BuyPrice", "buyPrice") <= 0) {
            return new Eligibility(false, "MISSING_BUY_PRICE");
        }

        int point = intValue(accessory, "EnlightenmentPoint", "enlightenmentPoint");
        int quality = intValue(accessory, "Quality", "quality");
        boolean maxPoint = ("목걸이".equals(type) && point >= 13) || (!"목걸이".equals(type) && point >= 9);

        if (maxPoint && quality < 90) {
            return new Eligibility(false, "QUALITY_BELOW_MAX_ENLIGHTENMENT_THRESHOLD");
        }

        return new Eligibility(true, "");
    }

    public String fingerprint(JsonNode accessory) {
        return String.join("|",
            text(accessory, "Type", "type"),
            text(accessory, "Name", "name"),
            String.valueOf(intValue(accessory, "Quality", "quality")),
            String.valueOf(resolvedMainStatValue(accessory)),
            String.valueOf(resolvedEnlightenmentPoint(accessory)),
            refinementLinesOf(accessory).toString()
        );
    }

    public List<String> dealerImpactRefinementSignature(JsonNode accessory) {
        String type = text(accessory, "Type", "type");
        List<String> signature = new ArrayList<>();

        for (String line : refinementLinesOf(accessory)) {
            String signatureLine = dealerImpactRefinementSignatureLine(type, line);

            if (!signatureLine.isBlank() && !signature.contains(signatureLine)) {
                signature.add(signatureLine);
            }
        }

        Collections.sort(signature);
        return signature;
    }

    private int resolvedMainStatValue(JsonNode accessory) {
        int value = intValue(accessory, "MainStatValue", "mainStatValue");

        return value > 0 ? value : sectionValue(accessory, "기본 효과").orElse(0);
    }

    private int resolvedEnlightenmentPoint(JsonNode accessory) {
        int value = intValue(accessory, "EnlightenmentPoint", "enlightenmentPoint");

        return value > 0 ? value : sectionValue(accessory, "아크 패시브 포인트 효과").orElse(0);
    }

    private Optional<Integer> sectionValue(JsonNode accessory, String sectionTitle) {
        for (JsonNode section : arrayItems(child(accessory, "DetailSections"))) {
            String title = text(section, "title", "Title");

            if (!sectionTitle.equals(title)) {
                continue;
            }

            Optional<Integer> value = firstLineValue(section, "lines");

            if (value.isPresent()) {
                return value;
            }

            return firstLineValue(section, "Lines");
        }

        return Optional.empty();
    }

    private Optional<Integer> firstLineValue(JsonNode section, String field) {
        List<JsonNode> lines = arrayItems(child(section, field));

        if (lines.isEmpty()) {
            return Optional.empty();
        }

        Matcher matcher = SECTION_VALUE_PATTERN.matcher(lines.get(0).asString());

        if (!matcher.find()) {
            return Optional.empty();
        }

        return Optional.of((int) Math.round(Double.parseDouble(matcher.group("value").replace(",", ""))));
    }

    private SearchOption searchOptionForLine(String type, String line) {
        String normalizedLine = line.replaceFirst("^(상|중|하)\\s+", "").replaceAll("\\s+", " ").trim();

        for (Rule rule : REFINEMENT_RULES) {
            if (!rule.type().isBlank() && !rule.type().equals(type)) {
                continue;
            }

            Matcher matcher = rule.pattern().matcher(normalizedLine);

            if (!matcher.find()) {
                continue;
            }

            double parsedValue = Double.parseDouble(matcher.group("value"));
            int minValue = rule.percentage() ? (int) Math.round(parsedValue * 100) : (int) Math.round(parsedValue);
            int maxValue = rule.values().stream().mapToInt(Integer::intValue).max().orElse(minValue);
            String labelValue = rule.percentage() ? formatPercent(minValue / 100.0) : formatWhole(minValue);

            return new SearchOption(
                REFINEMENT_FIRST_OPTION,
                rule.secondOption(),
                minValue,
                maxValue,
                rule.name() + " " + labelValue + " 이상"
            );
        }

        return null;
    }

    private String dealerImpactRefinementSignatureLine(String type, String line) {
        String normalizedLine = line.replaceFirst("^(상|중|하)\\s+", "").replaceAll("\\s+", " ").trim();

        for (Rule rule : REFINEMENT_RULES) {
            if (!rule.type().isBlank() && !rule.type().equals(type)) {
                continue;
            }

            Matcher matcher = rule.pattern().matcher(normalizedLine);

            if (!matcher.find()) {
                continue;
            }

            double parsedValue = Double.parseDouble(matcher.group("value"));
            int normalizedValue = rule.percentage() ? (int) Math.round(parsedValue * 100) : (int) Math.round(parsedValue);
            String labelValue = rule.percentage() ? formatPercent(normalizedValue / 100.0) : formatWhole(normalizedValue);
            return rule.name() + " +" + labelValue;
        }

        return "";
    }

    private List<String> refinementLinesOf(JsonNode accessory) {
        List<String> lines = new ArrayList<>();

        for (JsonNode section : arrayItems(child(accessory, "DetailSections"))) {
            String title = text(section, "title", "Title");

            if (!title.contains("연마")) {
                continue;
            }

            for (JsonNode line : arrayItems(child(section, "lines"))) {
                lines.add(line.asString());
            }
            for (JsonNode line : arrayItems(child(section, "Lines"))) {
                lines.add(line.asString());
            }
        }

        return lines;
    }

    private JsonNode firstArkPassivePoint(JsonNode item) {
        return arrayItems(child(item, "Options")).stream()
            .filter(option -> Set.of("ARK_PASSIVE", "ARK_PASSIVE_POINT").contains(text(option, "Type")))
            .filter(option -> "깨달음".equals(text(option, "OptionName")))
            .findFirst()
            .orElse(null);
    }

    private JsonNode firstOption(JsonNode item, String type, Set<String> names) {
        return options(item, type, names).stream().findFirst().orElse(null);
    }

    private List<JsonNode> options(JsonNode item, String type, Set<String> names) {
        return arrayItems(child(item, "Options")).stream()
            .filter(option -> type.equals(text(option, "Type")))
            .filter(option -> names == null || names.contains(text(option, "OptionName")))
            .toList();
    }

    private String formatStatLine(JsonNode option) {
        return text(option, "OptionName") + " +" + formatWhole(number(option, "Value"));
    }

    private String formatRefinementLine(JsonNode option) {
        String name = "적에게 주는 피해 증가".equals(text(option, "OptionName"))
            ? "적에게 주는 피해"
            : text(option, "OptionName");
        double value = number(option, "Value");
        boolean percentage = Boolean.TRUE.equals(bool(option, "IsValuePercentage"));

        return name + " +" + (percentage ? formatPercent(value) : formatWhole(value));
    }

    private String text(JsonNode node, String... fields) {
        for (String field : fields) {
            JsonNode value = child(node, field);

            if (value != null && !value.isNull() && !value.asString().isBlank()) {
                return value.asString();
            }
        }

        return "";
    }

    private int intValue(JsonNode node, String... fields) {
        for (String field : fields) {
            JsonNode value = child(node, field);

            if (value != null && value.isNumber()) {
                return value.asInt();
            }
        }

        return 0;
    }

    private double number(JsonNode node, String field) {
        JsonNode value = child(node, field);

        return value == null || !value.isNumber() ? 0 : value.asDouble();
    }

    private Boolean bool(JsonNode node, String field) {
        JsonNode value = child(node, field);

        return value == null || !value.isBoolean() ? null : value.asBoolean();
    }

    private String formatPercent(double value) {
        return String.format(java.util.Locale.ROOT, "%.2f%%", value);
    }

    private String formatWhole(double value) {
        if (Math.rint(value) == value) {
            return String.valueOf((long) value);
        }

        return String.valueOf(value);
    }

    public record SearchOption(int firstOption, int secondOption, int minValue, int maxValue, String label) {

        public Map<String, Object> requestMap() {
            return orderedMap(
                "FirstOption", firstOption,
                "SecondOption", secondOption,
                "MinValue", minValue,
                "MaxValue", maxValue
            );
        }
    }

    public record Eligibility(boolean eligible, String reason) {
    }

    private record Rule(String type, int secondOption, String name, boolean percentage, List<Integer> values, Pattern pattern) {
    }
}
