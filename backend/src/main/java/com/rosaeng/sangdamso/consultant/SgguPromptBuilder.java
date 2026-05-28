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
        "제공된 데이터와 계산 결과만 근거로 삼는다.",
        "데이터에 없는 내용은 모르면 모른다고 말한다.",
        "가격, 효율, 전투력 상승 수치는 제공된 값만 사용한다.",
        "추천은 비용 대비 효율, 현재 장착 상태, 계산 caveat를 함께 설명한다.",
        "답변은 2~5문장 또는 짧은 bullet로 제한한다.",
        "유저가 다음 행동을 묻는 경우 가장 먼저 할 1개 행동을 분명히 말한다."
    );
    private static final Set<String> SAFE_ROLES = Set.of("user", "assistant", "system");

    public List<Map<String, String>> build(String message, List<Map<String, String>> conversation, JsonNode context) {
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
                "[캐릭터 데이터]",
                context == null ? "{}" : context.toString(),
                "",
                "[유저 질문]",
                message == null ? "" : message
            )
        ));

        return messages;
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
