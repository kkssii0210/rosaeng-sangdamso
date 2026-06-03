package com.rosaeng.sangdamso.consultant;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class SgguIntentClassifier {

    private static final Set<String> SAFE_ROLES = Set.of("user", "assistant", "system");
    private static final List<String> COMPARISON_TERMS = List.of(
        " vs ", "vs", "비교", "중 뭐", "중에", "둘 중", "랑", "하고"
    );
    private static final List<String> INVESTMENT_RISK_TERMS = List.of(
        "사도", "살까", "구매", "매물", "강화해도", "질러도", "투자", "위험", "괜찮"
    );
    private static final List<String> CHARACTER_REVIEW_TERMS = List.of(
        "문제점", "문제", "진단", "어때", "평가", "상태", "약점", "부족", "봐줘", "봐주세요"
    );
    private static final List<String> GROWTH_PRIORITY_TERMS = List.of(
        "뭐부터", "먼저", "우선", "우선순위", "순서", "1순위", "스펙업", "올릴", "올려"
    );
    private static final List<String> OFF_TOPIC_TERMS = List.of(
        "점심", "저녁", "아침", "먹을", "날씨", "주식", "연애", "영화", "여행", "정치", "축구", "코딩"
    );
    private static final List<String> LOST_ARK_TERMS = List.of(
        "로아", "로스트아크", "캐릭", "스펙", "스펙업", "무기", "보석", "악세", "각인", "엘릭서",
        "초월", "강화", "레이드", "전투력", "아이템", "장비"
    );

    public SgguConsultationIntent classify(String message, List<Map<String, String>> conversation) {
        String current = normalize(message);
        String combined = (current + " " + normalizeConversation(conversation)).trim();

        if (current.isBlank()) {
            return SgguConsultationIntent.DATA_LIMITED;
        }

        if (containsAny(current, OFF_TOPIC_TERMS) && !containsAny(current, LOST_ARK_TERMS)) {
            return SgguConsultationIntent.OFF_TOPIC;
        }

        if (containsComparison(current)) {
            return SgguConsultationIntent.COMPARISON;
        }

        if (containsAny(combined, INVESTMENT_RISK_TERMS)) {
            return SgguConsultationIntent.INVESTMENT_RISK;
        }

        if (containsAny(current, CHARACTER_REVIEW_TERMS)) {
            return SgguConsultationIntent.CHARACTER_REVIEW;
        }

        if (containsAny(current, GROWTH_PRIORITY_TERMS)) {
            return SgguConsultationIntent.GROWTH_PRIORITY;
        }

        return SgguConsultationIntent.DATA_LIMITED;
    }

    private boolean containsComparison(String value) {
        if (containsAny(value, COMPARISON_TERMS)) {
            return true;
        }

        return value.contains("중") && (value.contains("나아") || value.contains("좋") || value.contains("먼저"));
    }

    private String normalizeConversation(List<Map<String, String>> conversation) {
        if (conversation == null || conversation.isEmpty()) {
            return "";
        }

        StringBuilder builder = new StringBuilder();

        for (Map<String, String> entry : conversation) {
            if (!isSafeConversationEntry(entry)) {
                continue;
            }

            builder.append(' ').append(normalize(entry.get("content")));
        }

        return builder.toString().trim();
    }

    private boolean isSafeConversationEntry(Map<String, String> entry) {
        if (entry == null) {
            return false;
        }

        String role = entry.get("role");
        String content = entry.get("content");

        return SAFE_ROLES.contains(role) && content != null && !content.trim().isEmpty();
    }

    private boolean containsAny(String value, List<String> terms) {
        return terms.stream().anyMatch(value::contains);
    }

    private String normalize(String value) {
        return String.valueOf(value == null ? "" : value)
            .replaceAll("\\s+", " ")
            .trim()
            .toLowerCase(Locale.ROOT);
    }
}
