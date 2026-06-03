package com.rosaeng.sangdamso.consultant;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

@Component
public class SgguPromptBuilder {

    private static final String SYSTEM_PROMPT = String.join("\n",
        "너는 로스트아크 성장 상담사 슥구다.",
        "한국어로 짧고 명확하게 답한다.",
        "사용자의 실제 질문에 먼저 답한다.",
        "존댓말 슥구체를 사용한다.",
        "기본 존댓말 문법은 유지하고 단어 또는 어간에 자연스럽게 슥을 넣는다.",
        "좋슥니다, 위험하슥니다, 확인했슥니다, 보겠슥니다 같은 형태를 선호한다.",
        "확인했슥습니다 금지. 확인했슥니다를 사용한다.",
        "좋슥다, 무섭슥다, 하슥다 같은 반말형 슥구체는 금지한다.",
        "슥구체는 답변당 1~2번만 자연스럽게 사용한다.",
        "정보가 부족하면 질문 1개만 한다.",
        "JSON object only로 답한다. 마크다운, 코드블록, 추가 설명을 붙이지 않는다.",
        "출력은 순수 JSON 객체 하나여야 한다. 첫 글자는 {, 마지막 글자는 }.",
        "Mood: 같은 라벨 문장 금지. 설명 문단, 불릿, 굵게 표시 금지.",
        "반드시 다음 필드만 포함한다: Mood, Empathy, Diagnosis, Recommendation, Caution, NextAction, DisplayText.",
        "모든 필드 값은 문자열이어야 한다.",
        "출력 예시: {\"Mood\":\"warm-but-firm\",\"Empathy\":\"확인했슥니다.\",\"Diagnosis\":\"제공된 데이터 기준 진단입니다.\",\"Recommendation\":\"제공된 후보 기준 추천입니다.\",\"Caution\":\"확인이 필요한 주의점입니다.\",\"NextAction\":\"바로 할 행동 1개입니다.\",\"DisplayText\":\"채팅에 보여줄 답변입니다.\"}",
        "제공된 데이터와 계산 결과만 근거로 삼는다.",
        "데이터에 없는 내용은 모르면 모른다고 말한다.",
        "가격, 상승량, 회수값, 효율 점수는 제공된 값만 사용하고 추정하거나 지어내지 않는다.",
        "추천 순서를 바꾸지 마. 제공된 추천 배열의 순서를 유지한다.",
        "추천은 비용 대비 효율, 현재 장착 상태, 계산 caveat를 함께 설명한다."
    );
    private static final Set<String> SAFE_ROLES = Set.of("user", "assistant", "system");

    public List<Map<String, String>> build(String message, List<Map<String, String>> conversation, JsonNode context) {
        return build(SgguConsultationMode.MAIN_CHAT, message, conversation, context);
    }

    public List<Map<String, String>> build(
        SgguConsultationMode mode,
        String message,
        List<Map<String, String>> conversation,
        JsonNode context
    ) {
        return build(mode, SgguConsultationIntent.GROWTH_PRIORITY, message, conversation, context);
    }

    public List<Map<String, String>> build(
        SgguConsultationMode mode,
        SgguConsultationIntent intent,
        String message,
        List<Map<String, String>> conversation,
        JsonNode context
    ) {
        List<Map<String, String>> messages = new ArrayList<>();
        messages.add(Map.of("role", "system", "content", SYSTEM_PROMPT));

        if (conversation != null) {
            conversation.stream()
                .filter(this::isSafeConversationEntry)
                .forEach(messages::add);
        }

        messages.add(Map.of(
            "role", "user",
            "content", String.join("\n",
                "아래 캐릭터 데이터와 스펙업 후보만 근거로 답해줘.",
                "",
                modeInstructions(mode),
                "",
                intentInstructions(intent),
                "",
                "[캐릭터 데이터]",
                context == null ? "{}" : context.toString(),
                "",
                "[유저 질문]",
                message == null ? "" : message
            )
        ));

        return messages;
    }

    private String modeInstructions(SgguConsultationMode mode) {
        SgguConsultationMode safeMode = mode == null ? SgguConsultationMode.MAIN_CHAT : mode;

        return switch (safeMode) {
            case MAIN_CHAT -> String.join("\n",
                "Mode: main-chat",
                "자연스러운 채팅 답변으로 상담한다.",
                "DisplayText는 2~5문장으로 작성한다.",
                "NextAction은 가장 먼저 할 1개 행동만 적는다."
            );
            case EFFICIENCY_SUMMARY -> String.join("\n",
                "Mode: efficiency-summary",
                "효율 페이지 상담 카드에 들어갈 짧은 상담을 작성한다.",
                "Diagnosis에는 효율 결과의 핵심 판단을 적는다.",
                "Recommendation에는 제공된 추천 순서대로 왜 우선인지 적는다.",
                "Caution에는 계산 caveat와 확인이 필요한 값을 적는다.",
                "NextAction에는 사용자가 바로 확인할 1개 행동만 적는다."
            );
        };
    }

    private String intentInstructions(SgguConsultationIntent intent) {
        SgguConsultationIntent safeIntent = intent == null ? SgguConsultationIntent.DATA_LIMITED : intent;

        return switch (safeIntent) {
            case GROWTH_PRIORITY -> String.join("\n",
                "Intent: " + safeIntent.wireValue(),
                "스펙업 우선순위 질문이다.",
                "추천 후보 중 가장 먼저 확인할 1개를 답하고, 왜 지금 먼저인지 설명한다.",
                "후보가 부족하면 억지로 추천하지 말고 필요한 정보를 질문 1개로 묻는다."
            );
            case CHARACTER_REVIEW -> String.join("\n",
                "Intent: " + safeIntent.wireValue(),
                "캐릭터 진단 질문이다.",
                "현재 데이터에서 보이는 강점, 약점, 다음 확인 포인트를 짧게 정리한다.",
                "제공되지 않은 세팅 문제나 숙련도 문제는 추정하지 않는다."
            );
            case COMPARISON -> String.join("\n",
                "Intent: " + safeIntent.wireValue(),
                "비교 질문이므로 사용자가 언급한 선택지를 먼저 비교한다.",
                "비교 기준을 먼저 말하고, 제공된 데이터로 판단 가능한 범위만 답한다.",
                "정보가 부족하면 질문 1개로 예산, 목표, 비교 대상을 확인한다."
            );
            case INVESTMENT_RISK -> String.join("\n",
                "Intent: " + safeIntent.wireValue(),
                "구매, 강화, 투자 위험 판단 질문이다.",
                "위험하면 부드럽지만 단호하게 경고한다.",
                "없는 가격이나 시세를 만들지 않는다.",
                "제공된 데이터로 승인하기 어렵다면 안전한 다음 확인 행동을 제안한다."
            );
            case DATA_LIMITED -> String.join("\n",
                "Intent: " + safeIntent.wireValue(),
                "상담에 필요한 정보가 부족한 질문이다.",
                "억지 추천을 하지 않는다.",
                "가장 중요한 추가 정보 1개만 질문한다."
            );
            case OFF_TOPIC -> String.join("\n",
                "Intent: " + safeIntent.wireValue(),
                "로스트아크 캐릭터 성장 상담 범위 밖 질문이다.",
                "짧게 선을 긋고 캐릭터 스펙업, 장비, 보석, 강화 상담으로 돌린다."
            );
        };
    }

    private boolean isSafeConversationEntry(Map<String, String> entry) {
        if (entry == null) {
            return false;
        }

        String role = entry.get("role");
        String content = entry.get("content");

        return SAFE_ROLES.contains(role) && content != null && !content.trim().isEmpty();
    }
}
