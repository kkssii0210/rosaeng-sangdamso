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
        "JSON object only로 답한다. 마크다운, 코드블록, 추가 설명을 붙이지 않는다.",
        "반드시 다음 필드만 포함한다: Mood, Empathy, Diagnosis, Recommendation, Caution, NextAction, DisplayText.",
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

    private boolean isSafeConversationEntry(Map<String, String> entry) {
        if (entry == null) {
            return false;
        }

        String role = entry.get("role");
        String content = entry.get("content");

        return SAFE_ROLES.contains(role) && content != null && !content.trim().isEmpty();
    }
}
