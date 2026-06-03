package com.rosaeng.sangdamso.consultant;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.arrayItems;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.child;

import java.util.Locale;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

@Component
public class SgguFallbackComposer {

    public SgguConsultationResponse compose(SgguConsultationMode mode, String message, JsonNode context) {
        return compose(mode, SgguConsultationIntent.GROWTH_PRIORITY, message, context);
    }

    public SgguConsultationResponse compose(
        SgguConsultationMode mode,
        SgguConsultationIntent intent,
        String message,
        JsonNode context
    ) {
        SgguConsultationMode safeMode = mode == null ? SgguConsultationMode.MAIN_CHAT : mode;
        SgguConsultationIntent safeIntent = intent == null ? SgguConsultationIntent.DATA_LIMITED : intent;

        if (safeMode == SgguConsultationMode.EFFICIENCY_SUMMARY || safeIntent == SgguConsultationIntent.GROWTH_PRIORITY) {
            return growthPriority(safeMode, context);
        }

        return switch (safeIntent) {
            case CHARACTER_REVIEW -> characterReview(safeMode, context);
            case COMPARISON -> comparison(safeMode, context);
            case INVESTMENT_RISK -> investmentRisk(safeMode, context);
            case DATA_LIMITED -> dataLimited(safeMode);
            case OFF_TOPIC -> offTopic(safeMode);
            case GROWTH_PRIORITY -> growthPriority(safeMode, context);
        };
    }

    private SgguConsultationResponse growthPriority(SgguConsultationMode mode, JsonNode context) {
        JsonNode topCandidate = topCandidate(context);

        if (topCandidate == null || text(topCandidate, "label").isBlank()) {
            return generic(mode);
        }

        String label = text(topCandidate, "label");
        String cost = numberText(topCandidate, "costGold");
        String gain = numberText(topCandidate, "gainPercent");
        String caveat = text(topCandidate, "caveat");
        String costPhrase = cost.isBlank() ? "" : " 예상 순비용은 " + cost + "골드입니다.";
        String gainPhrase = gain.isBlank() ? "" : " 전투력 상승은 약 " + gain + "%로 잡혀 있슥니다.";
        String caution = caveat.isBlank()
            ? "실제 구매 전에는 경매장 매물과 거래 가능 횟수를 다시 확인하시는 게 안전하슥니다."
            : caveat + "이라서 실제 구매 전에는 경매장 매물과 거래 가능 횟수를 다시 확인하시는 게 안전하슥니다.";
        String displayText = label + "을 먼저 보는 게 좋슥니다." + costPhrase + gainPhrase + " " + caution;

        return new SgguConsultationResponse(
            mode,
            "fallback",
            "warm-but-firm",
            "계산 결과는 먼저 정리해뒀슥니다.",
            "현재 1순위 후보는 " + label + "입니다.",
            label + "부터 확인하시는 게 좋슥니다." + costPhrase + gainPhrase,
            caution,
            "구매 전 경매장 가격, 거래 가능 횟수, 회수 가능 금액을 한 번 더 확인해 주세요.",
            displayText.trim()
        );
    }

    private SgguConsultationResponse characterReview(SgguConsultationMode mode, JsonNode context) {
        String characterName = text(child(context, "profile"), "characterName");
        JsonNode topCandidate = topCandidate(context);
        String label = text(topCandidate, "label");
        String target = characterName.isBlank() ? "현재 캐릭터" : characterName + "님";
        String diagnosis = label.isBlank()
            ? target + "은 제공된 데이터만으로는 뚜렷한 1순위 약점을 집기 어렵습니다."
            : target + "은 현재 " + label + " 쪽이 가장 먼저 보이는 개선 포인트입니다.";
        String displayText = diagnosis + " 장비, 보석, 각인 중 사용자가 더 걱정되는 항목을 알려주시면 그쪽부터 자세히 보겠슥니다.";

        return new SgguConsultationResponse(
            mode,
            "fallback",
            "warm-but-firm",
            target + " 상태를 제공된 자료 안에서 확인했슥니다.",
            diagnosis,
            label.isBlank() ? "먼저 비교할 성장 후보가 필요합니다." : label + "을 우선 점검하시는 게 좋슥니다.",
            "제공되지 않은 숙련도, 실제 시세, 파티 선호도는 판단하지 않습니다.",
            "가장 걱정되는 항목 하나를 알려주세요.",
            displayText
        );
    }

    private SgguConsultationResponse comparison(SgguConsultationMode mode, JsonNode context) {
        JsonNode topCandidate = topCandidate(context);
        String label = text(topCandidate, "label");
        String knownCandidate = label.isBlank() ? "현재 제공된 후보" : label;
        String displayText = "비교는 예산과 목표 콘텐츠가 같이 있어야 정확하슥니다. 제공된 계산에서 먼저 확인되는 후보는 "
            + knownCandidate + "입니다. 비교하려는 두 선택지와 예산을 알려주시면 더 정확히 보겠슥니다.";

        return new SgguConsultationResponse(
            mode,
            "fallback",
            "warm-but-firm",
            "비교 기준을 먼저 잡는 게 좋슥니다.",
            "현재 데이터만으로는 두 선택지의 직접 비교 근거가 부족합니다.",
            knownCandidate + "은 후보로 보이지만, 비교 대상의 비용과 기대 상승폭이 함께 필요합니다.",
            "없는 가격이나 시세를 만들어서 결론 내리지는 않겠습니다.",
            "비교하려는 두 선택지와 예산을 알려주세요.",
            displayText
        );
    }

    private SgguConsultationResponse investmentRisk(SgguConsultationMode mode, JsonNode context) {
        JsonNode topCandidate = topCandidate(context);
        String label = text(topCandidate, "label");
        String subject = label.isBlank() ? "그 선택" : label;
        String displayText = "지금 바로 확정 구매로 가는 건 위험하슥니다. " + subject
            + " 기준으로도 실제 가격, 거래 가능 횟수, 회수 가능 금액을 확인한 뒤 판단하시는 게 안전합니다.";

        return new SgguConsultationResponse(
            mode,
            "fallback",
            "warm-but-firm",
            "비싼 선택은 한 번 멈춰 보는 게 좋슥니다.",
            "현재 데이터만으로는 구매나 강화를 승인하기 어렵습니다.",
            "먼저 실제 매물 조건과 계산 후보를 맞춰보세요.",
            "시세와 회수값이 제공되지 않은 상태에서는 확정 판단을 하지 않습니다.",
            "가격, 거래 가능 횟수, 회수 가능 금액을 확인해 주세요.",
            displayText
        );
    }

    private SgguConsultationResponse dataLimited(SgguConsultationMode mode) {
        String displayText = "상담에 필요한 정보가 조금 부족하슥니다. 목표 레이드나 예산 중 하나만 알려주시면 그 기준으로 다시 보겠슥니다.";

        return new SgguConsultationResponse(
            mode,
            "fallback",
            "warm-but-firm",
            "질문 방향은 확인했슥니다.",
            "현재 질문만으로는 추천 기준이 부족합니다.",
            "목표나 예산을 먼저 정하면 추천을 좁힐 수 있습니다.",
            "근거가 부족한 상태에서 비싼 선택을 바로 추천하지 않겠습니다.",
            "목표 레이드나 예산 중 하나를 알려주세요.",
            displayText
        );
    }

    private SgguConsultationResponse offTopic(SgguConsultationMode mode) {
        String displayText = "그 질문은 로스트아크 성장 상담 범위 밖입니다. 캐릭터 스펙업, 장비, 보석, 강화 고민을 알려주시면 바로 보겠슥니다.";

        return new SgguConsultationResponse(
            mode,
            "fallback",
            "warm-but-firm",
            "슥구는 로스트아크 성장 상담을 맡고 있슥니다.",
            "현재 질문은 캐릭터 성장 상담과 직접 관련이 적습니다.",
            "캐릭터 스펙업이나 장비 고민을 알려주시면 상담할 수 있습니다.",
            "로스트아크 데이터 밖의 일반 주제는 판단하지 않습니다.",
            "상담할 캐릭터 성장 고민을 알려주세요.",
            displayText
        );
    }

    private JsonNode topCandidate(JsonNode context) {
        return arrayItems(child(context, "topSpecUps")).stream().findFirst().orElse(null);
    }

    private SgguConsultationResponse generic(SgguConsultationMode mode) {
        String text = "계산 결과를 기준으로 보면 아직 확정된 1순위 추천 후보가 없슥니다. 추천 후보가 생기면 비용과 전투력 상승폭을 같이 보고 판단하겠슥니다.";
        return new SgguConsultationResponse(
            mode,
            "fallback",
            "warm-but-firm",
            "지금은 자료를 차분히 확인하는 게 좋슥니다.",
            "계산 결과에서 바로 집을 수 있는 추천 후보가 부족합니다.",
            "추천 후보가 표시된 뒤 비용 대비 전투력 상승폭을 먼저 비교하세요.",
            "근거가 부족한 상태에서 비싼 매물을 바로 사는 건 피하시는 게 좋습니다.",
            "추천 후보와 경매장 정보를 다시 확인해 주세요.",
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
            return String.format(Locale.US, "%,d", value.asLong());
        }

        return String.format(Locale.US, "%.2f", value.asDouble()).replaceAll("0+$", "").replaceAll("\\.$", "");
    }
}
