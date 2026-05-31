package com.rosaeng.sangdamso.consultant;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.arrayItems;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.child;

import java.text.NumberFormat;
import java.util.Locale;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

@Component
public class SgguFallbackComposer {

    private static final NumberFormat GOLD_FORMAT = NumberFormat.getIntegerInstance(Locale.US);

    public SgguConsultationResponse compose(SgguConsultationMode mode, String message, JsonNode context) {
        JsonNode topCandidate = arrayItems(child(context, "topSpecUps")).stream().findFirst().orElse(null);

        if (topCandidate == null || text(topCandidate, "label").isBlank()) {
            return generic(mode);
        }

        String label = text(topCandidate, "label");
        String cost = numberText(topCandidate, "costGold");
        String gain = numberText(topCandidate, "gainPercent");
        String caveat = text(topCandidate, "caveat");
        String costPhrase = cost.isBlank() ? "" : " 예상 순비용은 " + cost + "골드야.";
        String gainPhrase = gain.isBlank() ? "" : " 전투력 상승은 약 " + gain + "%로 잡혀 있어.";
        String caution = caveat.isBlank()
            ? "실제 구매 전에는 경매장 매물과 거래 가능 횟수를 다시 확인하자."
            : caveat + "이라서 실제 구매 전에는 경매장 매물과 거래 가능 횟수를 다시 확인하자.";
        String displayText = label + "을 먼저 보는 게 좋아." + costPhrase + gainPhrase + " " + caution;

        return new SgguConsultationResponse(
            mode,
            "fallback",
            "warm-but-firm",
            "계산 결과는 먼저 정리해뒀어.",
            "현재 1순위 후보는 " + label + "이야.",
            label + "부터 확인하자." + costPhrase + gainPhrase,
            caution,
            "구매 전 경매장 가격, 거래 가능 횟수, 회수 가능 금액을 한 번 더 확인해줘.",
            displayText.trim()
        );
    }

    private SgguConsultationResponse generic(SgguConsultationMode mode) {
        String text = "계산 결과를 기준으로 보면 아직 확정된 1순위 추천 후보가 없어. 추천 후보가 생기면 비용과 전투력 상승폭을 같이 보고 판단하자.";
        return new SgguConsultationResponse(
            mode,
            "fallback",
            "warm-but-firm",
            "지금은 자료를 차분히 확인하는 게 좋아.",
            "계산 결과에서 바로 집을 수 있는 추천 후보가 부족해.",
            "추천 후보가 표시된 뒤 비용 대비 전투력 상승폭을 먼저 비교하자.",
            "근거가 부족한 상태에서 비싼 매물을 바로 사는 건 피하자.",
            "추천 후보와 경매장 정보를 다시 확인해줘.",
            text
        );
    }

    private String text(JsonNode node, String fieldName) {
        JsonNode value = child(node, fieldName);
        return value == null || value.isNull() ? "" : value.asString().trim();
    }

    private String numberText(JsonNode node, String fieldName) {
        JsonNode value = child(node, fieldName);

        if (value == null || value.isNull() || !value.isNumber()) {
            return "";
        }

        if ("costGold".equals(fieldName)) {
            return GOLD_FORMAT.format(value.asLong());
        }

        return String.format(Locale.US, "%.2f", value.asDouble()).replaceAll("0+$", "").replaceAll("\\.$", "");
    }
}
