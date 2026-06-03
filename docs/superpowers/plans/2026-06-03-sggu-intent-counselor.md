# Sggu Intent Counselor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route Sggu consultation by user intent so it answers like a polite, playful Lost Ark counselor instead of repeating the same generic spec-up recommendation.

**Architecture:** Add a deterministic `SgguIntentClassifier` before prompt construction, pass the classified intent through `SgguPromptBuilder`, and use the same intent for deterministic fallback responses. Keep the frontend response contract unchanged and keep memory limited to the conversation included in the request.

**Tech Stack:** Java 21, Spring Boot 4, Jackson 3 `JsonNode`, JUnit 5, AssertJ, Maven wrapper, existing npm smoke script.

---

## File Structure

- Create `backend/src/main/java/com/rosaeng/sangdamso/consultant/SgguConsultationIntent.java`
  - Enum for internal counselor intents and prompt wire values.
- Create `backend/src/main/java/com/rosaeng/sangdamso/consultant/SgguIntentClassifier.java`
  - Deterministic Korean keyword classifier. No LLM call.
- Create `backend/src/test/java/com/rosaeng/sangdamso/consultant/SgguIntentClassifierTest.java`
  - Tests representative Korean messages and precedence rules.
- Modify `backend/src/main/java/com/rosaeng/sangdamso/consultant/SgguPromptBuilder.java`
  - Adds intent-aware build overload and intent-specific instructions.
- Modify `backend/src/test/java/com/rosaeng/sangdamso/consultant/SgguPromptBuilderTest.java`
  - Verifies polite Sggu voice rules and intent instructions.
- Modify `backend/src/main/java/com/rosaeng/sangdamso/consultant/SgguFallbackComposer.java`
  - Adds intent-aware fallback composition while preserving the legacy compose overload.
- Modify `backend/src/test/java/com/rosaeng/sangdamso/consultant/SgguFallbackComposerTest.java`
  - Verifies fallback responses differ by intent and avoid broken Sggu forms.
- Modify `backend/src/main/java/com/rosaeng/sangdamso/consultant/SgguConsultationService.java`
  - Classifies intent once and passes it to prompt/fallback paths.
- Modify `backend/src/test/java/com/rosaeng/sangdamso/consultant/SgguConsultationServiceTest.java`
  - Verifies classified intent reaches prompt and fallback paths.
- Modify `backend/src/test/java/com/rosaeng/sangdamso/consultant/ConsultantControllerTest.java`
  - Updates the fake service constructor after service dependency injection changes.

## Task 1: Add Intent Enum And Classifier

**Files:**
- Create: `backend/src/main/java/com/rosaeng/sangdamso/consultant/SgguConsultationIntent.java`
- Create: `backend/src/main/java/com/rosaeng/sangdamso/consultant/SgguIntentClassifier.java`
- Create: `backend/src/test/java/com/rosaeng/sangdamso/consultant/SgguIntentClassifierTest.java`

- [ ] **Step 1: Write the failing classifier tests**

Create `SgguIntentClassifierTest.java`:

```java
package com.rosaeng.sangdamso.consultant;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class SgguIntentClassifierTest {

    private final SgguIntentClassifier classifier = new SgguIntentClassifier();

    @Test
    void classifiesGrowthPriorityQuestions() {
        assertThat(classifier.classify("뭐부터 올리면 좋을까요?", List.of()))
            .isEqualTo(SgguConsultationIntent.GROWTH_PRIORITY);
        assertThat(classifier.classify("스펙업 우선순위 알려주세요", List.of()))
            .isEqualTo(SgguConsultationIntent.GROWTH_PRIORITY);
    }

    @Test
    void classifiesCharacterReviewQuestions() {
        assertThat(classifier.classify("제 캐릭터 문제점 봐주세요", List.of()))
            .isEqualTo(SgguConsultationIntent.CHARACTER_REVIEW);
        assertThat(classifier.classify("현재 상태 진단해줘", List.of()))
            .isEqualTo(SgguConsultationIntent.CHARACTER_REVIEW);
    }

    @Test
    void classifiesComparisonBeforeGrowthPriority() {
        assertThat(classifier.classify("무기 강화랑 보석 중 뭐부터 가는 게 나아요?", List.of()))
            .isEqualTo(SgguConsultationIntent.COMPARISON);
        assertThat(classifier.classify("무기 vs 보석 비교해주세요", List.of()))
            .isEqualTo(SgguConsultationIntent.COMPARISON);
    }

    @Test
    void classifiesInvestmentRiskQuestions() {
        assertThat(classifier.classify("이 악세 지금 사도 될까요?", List.of()))
            .isEqualTo(SgguConsultationIntent.INVESTMENT_RISK);
        assertThat(classifier.classify("지금 강화 질러도 괜찮나요?", List.of()))
            .isEqualTo(SgguConsultationIntent.INVESTMENT_RISK);
    }

    @Test
    void classifiesDataLimitedQuestions() {
        assertThat(classifier.classify("상담해주세요", List.of()))
            .isEqualTo(SgguConsultationIntent.DATA_LIMITED);
        assertThat(classifier.classify("   ", List.of()))
            .isEqualTo(SgguConsultationIntent.DATA_LIMITED);
    }

    @Test
    void classifiesOffTopicQuestions() {
        assertThat(classifier.classify("오늘 점심 뭐 먹을까요?", List.of()))
            .isEqualTo(SgguConsultationIntent.OFF_TOPIC);
        assertThat(classifier.classify("날씨 어때요?", List.of()))
            .isEqualTo(SgguConsultationIntent.OFF_TOPIC);
    }

    @Test
    void canUseRecentConversationTextForShortFollowUp() {
        assertThat(classifier.classify(
            "이거 사도 될까요?",
            List.of(Map.of("role", "user", "content", "고대 악세 매물을 보고 있어요."))
        )).isEqualTo(SgguConsultationIntent.INVESTMENT_RISK);
    }
}
```

- [ ] **Step 2: Run the classifier test and verify it fails**

Run:

```bash
cd backend && ./mvnw -Dtest=SgguIntentClassifierTest test
```

Expected: FAIL because `SgguIntentClassifier` and `SgguConsultationIntent` do not exist.

- [ ] **Step 3: Create the intent enum**

Create `SgguConsultationIntent.java`:

```java
package com.rosaeng.sangdamso.consultant;

public enum SgguConsultationIntent {
    GROWTH_PRIORITY("growth-priority"),
    CHARACTER_REVIEW("character-review"),
    COMPARISON("comparison"),
    INVESTMENT_RISK("investment-risk"),
    DATA_LIMITED("data-limited"),
    OFF_TOPIC("off-topic");

    private final String wireValue;

    SgguConsultationIntent(String wireValue) {
        this.wireValue = wireValue;
    }

    public String wireValue() {
        return wireValue;
    }
}
```

- [ ] **Step 4: Create the deterministic classifier**

Create `SgguIntentClassifier.java`:

```java
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
```

- [ ] **Step 5: Run the classifier test and verify it passes**

Run:

```bash
cd backend && ./mvnw -Dtest=SgguIntentClassifierTest test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/rosaeng/sangdamso/consultant/SgguConsultationIntent.java backend/src/main/java/com/rosaeng/sangdamso/consultant/SgguIntentClassifier.java backend/src/test/java/com/rosaeng/sangdamso/consultant/SgguIntentClassifierTest.java
git commit -m "feat: classify sggu consultation intent"
```

## Task 2: Add Intent-Aware Prompt Instructions

**Files:**
- Modify: `backend/src/main/java/com/rosaeng/sangdamso/consultant/SgguPromptBuilder.java`
- Modify: `backend/src/test/java/com/rosaeng/sangdamso/consultant/SgguPromptBuilderTest.java`

- [ ] **Step 1: Add failing prompt tests**

Add these tests to `SgguPromptBuilderTest` after `buildsEfficiencySummaryCardInstructions()`:

```java
    @Test
    void buildsIntentInstructionsAndPoliteSgguVoiceRules() {
        var messages = builder.build(
            SgguConsultationMode.MAIN_CHAT,
            SgguConsultationIntent.COMPARISON,
            "무기 강화랑 보석 중 뭐가 나아요?",
            List.of(),
            toJsonNode(Map.of("profile", Map.of("characterName", "붐버")))
        );

        assertThat(messages.get(0).get("content"))
            .contains("사용자의 실제 질문에 먼저 답한다")
            .contains("존댓말 슥구체")
            .contains("확인했슥니다")
            .contains("확인했슥습니다 금지")
            .contains("좋슥다")
            .contains("무섭슥다")
            .contains("하슥다");
        assertThat(messages.getLast().get("content"))
            .contains("Intent: comparison")
            .contains("비교 질문이므로")
            .contains("비교 기준")
            .contains("정보가 부족하면 질문 1개");
    }

    @Test
    void buildsInvestmentRiskInstructions() {
        var messages = builder.build(
            SgguConsultationMode.MAIN_CHAT,
            SgguConsultationIntent.INVESTMENT_RISK,
            "이 악세 사도 될까요?",
            List.of(),
            toJsonNode(Map.of("profile", Map.of("characterName", "붐버")))
        );

        assertThat(messages.getLast().get("content"))
            .contains("Intent: investment-risk")
            .contains("위험하면 부드럽지만 단호하게")
            .contains("없는 가격이나 시세를 만들지 않는다");
    }
```

- [ ] **Step 2: Run prompt tests and verify they fail**

Run:

```bash
cd backend && ./mvnw -Dtest=SgguPromptBuilderTest test
```

Expected: FAIL because the `build(mode, intent, message, conversation, context)` overload and intent instructions do not exist.

- [ ] **Step 3: Update the system prompt**

In `SgguPromptBuilder.java`, replace the `SYSTEM_PROMPT` definition with:

```java
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
        "반드시 다음 필드만 포함한다: Mood, Empathy, Diagnosis, Recommendation, Caution, NextAction, DisplayText.",
        "제공된 데이터와 계산 결과만 근거로 삼는다.",
        "데이터에 없는 내용은 모르면 모른다고 말한다.",
        "가격, 상승량, 회수값, 효율 점수는 제공된 값만 사용하고 추정하거나 지어내지 않는다.",
        "추천 순서를 바꾸지 마. 제공된 추천 배열의 순서를 유지한다.",
        "추천은 비용 대비 효율, 현재 장착 상태, 계산 caveat를 함께 설명한다."
    );
```

- [ ] **Step 4: Add the intent-aware build overload**

Replace the current `build(SgguConsultationMode mode, String message, List<Map<String, String>> conversation, JsonNode context)` method with these two overloads:

```java
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
```

- [ ] **Step 5: Add intent instructions**

Add this method below `modeInstructions(...)`:

```java
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
```

- [ ] **Step 6: Run prompt tests and verify they pass**

Run:

```bash
cd backend && ./mvnw -Dtest=SgguPromptBuilderTest test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/com/rosaeng/sangdamso/consultant/SgguPromptBuilder.java backend/src/test/java/com/rosaeng/sangdamso/consultant/SgguPromptBuilderTest.java
git commit -m "feat: add sggu intent prompt guidance"
```

## Task 3: Make Fallback Intent-Aware

**Files:**
- Modify: `backend/src/main/java/com/rosaeng/sangdamso/consultant/SgguFallbackComposer.java`
- Modify: `backend/src/test/java/com/rosaeng/sangdamso/consultant/SgguFallbackComposerTest.java`

- [ ] **Step 1: Add failing fallback tests**

Add these tests to `SgguFallbackComposerTest` after `buildsMainChatFallbackWhenNoCandidateExists()`:

```java
    @Test
    void buildsComparisonFallbackWithoutGenericFirstCandidateCopy() {
        SgguConsultationResponse response = composer.compose(
            SgguConsultationMode.MAIN_CHAT,
            SgguConsultationIntent.COMPARISON,
            "무기 강화랑 보석 중 뭐가 나아요?",
            contextWithCandidate()
        );

        assertThat(response.source()).isEqualTo("fallback");
        assertThat(response.displayText()).contains("비교", "예산");
        assertThat(response.displayText()).doesNotContain("먼저 보는 게 좋아.");
    }

    @Test
    void buildsInvestmentRiskFallbackWithPoliteWarning() {
        SgguConsultationResponse response = composer.compose(
            SgguConsultationMode.MAIN_CHAT,
            SgguConsultationIntent.INVESTMENT_RISK,
            "이 악세 지금 사도 될까요?",
            contextWithCandidate()
        );

        assertThat(response.displayText()).contains("위험하슥니다");
        assertThat(response.nextAction()).contains("가격", "거래 가능 횟수");
    }

    @Test
    void buildsOffTopicFallbackThatSteersBackToLostArk() {
        SgguConsultationResponse response = composer.compose(
            SgguConsultationMode.MAIN_CHAT,
            SgguConsultationIntent.OFF_TOPIC,
            "오늘 점심 뭐 먹을까요?",
            contextWithCandidate()
        );

        assertThat(response.displayText()).contains("로스트아크", "스펙업");
    }

    @Test
    void fallbackVoiceAvoidsKnownBrokenSgguForms() {
        SgguConsultationResponse response = composer.compose(
            SgguConsultationMode.MAIN_CHAT,
            SgguConsultationIntent.DATA_LIMITED,
            "상담해주세요",
            contextWithCandidate()
        );

        assertThat(response.displayText())
            .doesNotContain("확인했슥습니다")
            .doesNotContain("좋슥다")
            .doesNotContain("무섭슥다")
            .doesNotContain("하슥다");
    }

    private JsonNode contextWithCandidate() {
        return toJsonNode(orderedMap(
            "profile", orderedMap("characterName", "붐버", "className", "스카우터"),
            "topSpecUps", List.of(orderedMap(
                "label", "무기 11->12",
                "costGold", 100000,
                "gainPercent", 0.3,
                "caveat", "노숨 기대비용 기준"
            ))
        ));
    }
```

- [ ] **Step 2: Run fallback tests and verify they fail**

Run:

```bash
cd backend && ./mvnw -Dtest=SgguFallbackComposerTest test
```

Expected: FAIL because the intent-aware `compose(...)` overload does not exist.

- [ ] **Step 3: Replace the compose entry points**

In `SgguFallbackComposer.java`, replace the existing `compose(...)` method with:

```java
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
```

- [ ] **Step 4: Add intent-specific fallback helpers**

Add these helper methods above the existing `text(...)` helper:

```java
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
```

- [ ] **Step 5: Replace the generic fallback text**

Replace the current `generic(...)` method with:

```java
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
```

- [ ] **Step 6: Run fallback tests and verify they pass**

Run:

```bash
cd backend && ./mvnw -Dtest=SgguFallbackComposerTest test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/com/rosaeng/sangdamso/consultant/SgguFallbackComposer.java backend/src/test/java/com/rosaeng/sangdamso/consultant/SgguFallbackComposerTest.java
git commit -m "feat: make sggu fallback intent aware"
```

## Task 4: Wire Intent Through Consultation Service

**Files:**
- Modify: `backend/src/main/java/com/rosaeng/sangdamso/consultant/SgguConsultationService.java`
- Modify: `backend/src/test/java/com/rosaeng/sangdamso/consultant/SgguConsultationServiceTest.java`
- Modify: `backend/src/test/java/com/rosaeng/sangdamso/consultant/ConsultantControllerTest.java`

- [ ] **Step 1: Add failing service integration tests**

Add these tests to `SgguConsultationServiceTest` after `returnsValidatedLlmConsultation()`:

```java
    @Test
    void includesClassifiedIntentInPrompt() {
        localLlmClient.text = """
            {
              "Mood": "warm-but-firm",
              "Diagnosis": "비교 기준을 봐야 해.",
              "Recommendation": "무기와 보석을 비용 대비로 비교하자.",
              "NextAction": "비교 예산을 확인해줘.",
              "DisplayText": "무기와 보석은 예산 기준으로 비교하겠슥니다."
            }
            """;

        service.consult(
            SgguConsultationMode.MAIN_CHAT,
            "무기 강화랑 보석 중 뭐가 나아요?",
            List.of(),
            context()
        );

        assertThat(localLlmClient.messages.getLast().get("content")).contains("Intent: comparison");
    }

    @Test
    void usesClassifiedIntentWhenLlmFallbackRuns() {
        localLlmClient.exception = new LocalLlmClient.LocalLlmException("LOCAL_LLM_UNAVAILABLE", "down");

        SgguConsultationResponse response = service.consult(
            SgguConsultationMode.MAIN_CHAT,
            "무기 강화랑 보석 중 뭐가 나아요?",
            List.of(),
            context()
        );

        assertThat(response.source()).isEqualTo("fallback");
        assertThat(response.displayText()).contains("비교", "예산");
    }
```

- [ ] **Step 2: Run service tests and verify they fail**

Run:

```bash
cd backend && ./mvnw -Dtest=SgguConsultationServiceTest test
```

Expected: FAIL because `SgguConsultationService` does not classify or pass intent into prompt/fallback yet.

- [ ] **Step 3: Inject the classifier**

In `SgguConsultationService.java`, add a field:

```java
    private final SgguIntentClassifier intentClassifier;
```

Replace the constructor with:

```java
    public SgguConsultationService(
        SgguPromptBuilder promptBuilder,
        LocalLlmClient localLlmClient,
        SgguResponseParser responseParser,
        SgguFallbackComposer fallbackComposer,
        SgguIntentClassifier intentClassifier
    ) {
        this.promptBuilder = promptBuilder;
        this.localLlmClient = localLlmClient;
        this.responseParser = responseParser;
        this.fallbackComposer = fallbackComposer;
        this.intentClassifier = intentClassifier;
    }
```

- [ ] **Step 4: Classify once in `consult(...)`**

In `consult(...)`, after `safeMode` is assigned, add:

```java
        SgguConsultationIntent intent = intentClassifier.classify(message, conversation);
```

Then replace:

```java
            List<Map<String, String>> messages = promptBuilder.build(safeMode, message, conversation, context);
```

with:

```java
            List<Map<String, String>> messages = promptBuilder.build(safeMode, intent, message, conversation, context);
```

Replace both fallback calls:

```java
                return fallbackComposer.compose(safeMode, message, context);
```

and:

```java
            return fallbackComposer.compose(safeMode, message, context);
```

with:

```java
                return fallbackComposer.compose(safeMode, intent, message, context);
```

and:

```java
            return fallbackComposer.compose(safeMode, intent, message, context);
```

- [ ] **Step 5: Update tests for constructor injection**

In `SgguConsultationServiceTest.setUp()`, replace:

```java
        service = new SgguConsultationService(
            new SgguPromptBuilder(),
            localLlmClient,
            new SgguResponseParser(new ObjectMapper()),
            new SgguFallbackComposer()
        );
```

with:

```java
        service = new SgguConsultationService(
            new SgguPromptBuilder(),
            localLlmClient,
            new SgguResponseParser(new ObjectMapper()),
            new SgguFallbackComposer(),
            new SgguIntentClassifier()
        );
```

In `ConsultantControllerTest.FakeSgguConsultationService`, replace:

```java
            super(null, null, null, null);
```

with:

```java
            super(null, null, null, null, null);
```

- [ ] **Step 6: Run service and controller tests**

Run:

```bash
cd backend && ./mvnw -Dtest=SgguConsultationServiceTest,ConsultantControllerTest test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/com/rosaeng/sangdamso/consultant/SgguConsultationService.java backend/src/test/java/com/rosaeng/sangdamso/consultant/SgguConsultationServiceTest.java backend/src/test/java/com/rosaeng/sangdamso/consultant/ConsultantControllerTest.java
git commit -m "feat: route sggu consultation by intent"
```

## Task 5: Full Verification And Smoke

**Files:**
- Test-only task unless verification reveals a defect in files touched by earlier tasks.

- [ ] **Step 1: Run all backend tests**

Run:

```bash
cd backend && ./mvnw test
```

Expected: PASS with all backend tests green.

- [ ] **Step 2: Run frontend and smoke tests**

Run:

```bash
npm run test
```

Expected: PASS.

Then run:

```bash
npm run smoke:sggu
```

Expected: PASS with `Sggu consult smoke OK`. If the local backend or Ollama process is unavailable, restart the backend and retry once before reporting an environment blocker.

- [ ] **Step 3: Manually exercise intent examples**

Send these messages through the existing Sggu consult path and confirm the `DisplayText` shape differs by question type:

```text
뭐부터 올리면 좋을까요?
제 캐릭터 문제점 봐주세요.
무기 강화랑 보석 중 뭐가 나아요?
지금 이거 사도 될까요?
오늘 점심 뭐 먹을까요?
```

Expected:

- Growth priority mentions a concrete next candidate when available.
- Character review describes visible strengths or weak points.
- Comparison talks about comparison 기준 and may ask for budget.
- Investment risk gives a polite warning without inventing prices.
- Off-topic steers back to Lost Ark growth consultation.

- [ ] **Step 4: Final status check**

Run:

```bash
git status --short
```

Expected: no uncommitted changes after the task commits, unless a verification-only log file was produced and removed.
