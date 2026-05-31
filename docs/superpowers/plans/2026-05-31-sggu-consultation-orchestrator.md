# Sggu Consultation Orchestrator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build V1 of the Sggu consultation orchestrator so calculation results render quickly while Sggu produces warm-but-firm structured consultation for main chat and the efficiency page.

**Architecture:** Keep deterministic recommendations in Spring services. Add a focused `SgguConsultationService` that builds mode-specific prompts, calls the existing local LLM client, parses structured JSON, validates it, and falls back to deterministic counselor copy. The efficiency page renders calculation results first and requests `mode: efficiency-summary` consultation asynchronously.

**Tech Stack:** Java 21, Spring Boot 4 WebMVC, Jackson `JsonNode`/`ObjectMapper`, JUnit 5, AssertJ, MockMvc, React/Next.js, Node `node:test`, local Ollama chat API.

---

## File Structure

- Create `backend/src/main/java/com/rosaeng/sangdamso/consultant/SgguConsultationMode.java`
  - Defines supported consultation modes and safe fallback parsing.
- Create `backend/src/main/java/com/rosaeng/sangdamso/consultant/SgguConsultationResponse.java`
  - Internal response record converted to the public JSON shape.
- Create `backend/src/main/java/com/rosaeng/sangdamso/consultant/SgguResponseParser.java`
  - Parses raw LLM JSON or fenced JSON and validates required fields.
- Create `backend/src/test/java/com/rosaeng/sangdamso/consultant/SgguResponseParserTest.java`
  - Covers raw JSON, fenced JSON, malformed JSON, and missing required fields.
- Create `backend/src/main/java/com/rosaeng/sangdamso/consultant/SgguFallbackComposer.java`
  - Builds deterministic consultation responses from compact facts.
- Create `backend/src/test/java/com/rosaeng/sangdamso/consultant/SgguFallbackComposerTest.java`
  - Covers main-chat and efficiency-summary fallback copy.
- Modify `backend/src/main/java/com/rosaeng/sangdamso/consultant/SgguPromptBuilder.java`
  - Adds mode-aware structured prompt generation.
- Modify `backend/src/test/java/com/rosaeng/sangdamso/consultant/SgguPromptBuilderTest.java`
  - Verifies schema, no-rerank rules, and mode-specific instructions.
- Create `backend/src/main/java/com/rosaeng/sangdamso/consultant/SgguConsultationService.java`
  - Orchestrates prompt, LLM call, parser, validation, fallback, and short-lived cache.
- Create `backend/src/test/java/com/rosaeng/sangdamso/consultant/SgguConsultationServiceTest.java`
  - Covers LLM success, unavailable LLM, malformed output, and cache reuse.
- Modify `backend/src/main/java/com/rosaeng/sangdamso/consultant/ConsultantController.java`
  - Delegates to `SgguConsultationService` and returns the new response contract.
- Modify `backend/src/test/java/com/rosaeng/sangdamso/consultant/ConsultantControllerTest.java`
  - Updates expected JSON shape and mode handling.
- Modify `lib/ui/sgguConsultantState.js`
  - Sends `mode: "main-chat"` and reads `DisplayText`.
- Modify `tests/sgguConsultantState.test.js`
  - Covers request body mode and response text extraction.
- Modify `components/CombatPowerEfficiencyPage.jsx`
  - Adds always-present async consultation state and card rendering.
- Create `tests/efficiencyConsultationState.test.js`
  - Pure helper tests for efficiency consultation states.
- Modify `scripts/smoke-sggu-consult.mjs`
  - Verifies structured consultation response from local Ollama.

## Task 1: Backend Consultation Response Contract

**Files:**
- Create: `backend/src/main/java/com/rosaeng/sangdamso/consultant/SgguConsultationMode.java`
- Create: `backend/src/main/java/com/rosaeng/sangdamso/consultant/SgguConsultationResponse.java`
- Create: `backend/src/main/java/com/rosaeng/sangdamso/consultant/SgguResponseParser.java`
- Create: `backend/src/test/java/com/rosaeng/sangdamso/consultant/SgguResponseParserTest.java`

- [ ] **Step 1: Write failing parser tests**

Create `backend/src/test/java/com/rosaeng/sangdamso/consultant/SgguResponseParserTest.java`:

```java
package com.rosaeng.sangdamso.consultant;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class SgguResponseParserTest {

    private final SgguResponseParser parser = new SgguResponseParser(new ObjectMapper());

    @Test
    void parsesRawStructuredJson() {
        SgguConsultationResponse response = parser.parse(
            SgguConsultationMode.EFFICIENCY_SUMMARY,
            """
                {
                  "Mood": "warm-but-firm",
                  "Empathy": "후보가 많아서 헷갈릴 수 있어.",
                  "Diagnosis": "보석 효율이 안정적이야.",
                  "Recommendation": "1순위는 7겁 보석 교체야.",
                  "Caution": "악세는 회수값 변동이 있어.",
                  "NextAction": "보석 가격을 먼저 확인해줘.",
                  "DisplayText": "지금은 보석부터 보는 게 좋아."
                }
                """
        );

        assertThat(response.mode()).isEqualTo(SgguConsultationMode.EFFICIENCY_SUMMARY);
        assertThat(response.source()).isEqualTo("llm");
        assertThat(response.mood()).isEqualTo("warm-but-firm");
        assertThat(response.recommendation()).contains("7겁 보석");
        assertThat(response.displayText()).contains("보석부터");
    }

    @Test
    void parsesJsonWrappedInMarkdownFence() {
        SgguConsultationResponse response = parser.parse(
            SgguConsultationMode.MAIN_CHAT,
            """
                ```json
                {
                  "Mood": "warm-but-firm",
                  "Diagnosis": "무기 강화보다 보석이 먼저야.",
                  "Recommendation": "보석 후보를 먼저 보자.",
                  "NextAction": "거래소 가격을 확인해줘.",
                  "DisplayText": "지금은 보석을 먼저 보는 게 좋아."
                }
                ```
                """
        );

        assertThat(response.mode()).isEqualTo(SgguConsultationMode.MAIN_CHAT);
        assertThat(response.source()).isEqualTo("llm");
        assertThat(response.empathy()).isEqualTo("");
        assertThat(response.caution()).isEqualTo("");
    }

    @Test
    void rejectsMalformedJson() {
        try {
            parser.parse(SgguConsultationMode.MAIN_CHAT, "지금은 보석부터 보는 게 좋아.");
        } catch (SgguResponseParser.InvalidSgguResponseException exception) {
            assertThat(exception.getMessage()).contains("valid JSON");
            return;
        }

        throw new AssertionError("Expected InvalidSgguResponseException");
    }

    @Test
    void rejectsMissingRequiredFields() {
        try {
            parser.parse(
                SgguConsultationMode.MAIN_CHAT,
                """
                    {
                      "Mood": "warm-but-firm",
                      "Diagnosis": "보석이 먼저야.",
                      "DisplayText": "보석부터 보자."
                    }
                    """
            );
        } catch (SgguResponseParser.InvalidSgguResponseException exception) {
            assertThat(exception.getMessage()).contains("Recommendation");
            return;
        }

        throw new AssertionError("Expected InvalidSgguResponseException");
    }
}
```

- [ ] **Step 2: Run RED**

Run:

```bash
cd backend && ./mvnw -Dtest=SgguResponseParserTest test
```

Expected: FAIL because `SgguResponseParser`, `SgguConsultationMode`, and `SgguConsultationResponse` do not exist.

- [ ] **Step 3: Add mode enum**

Create `backend/src/main/java/com/rosaeng/sangdamso/consultant/SgguConsultationMode.java`:

```java
package com.rosaeng.sangdamso.consultant;

public enum SgguConsultationMode {
    MAIN_CHAT("main-chat"),
    EFFICIENCY_SUMMARY("efficiency-summary");

    private final String wireValue;

    SgguConsultationMode(String wireValue) {
        this.wireValue = wireValue;
    }

    public String wireValue() {
        return wireValue;
    }

    public static SgguConsultationMode from(String value) {
        String normalized = String.valueOf(value == null ? "" : value).trim();

        for (SgguConsultationMode mode : values()) {
            if (mode.wireValue.equals(normalized)) {
                return mode;
            }
        }

        return MAIN_CHAT;
    }
}
```

- [ ] **Step 4: Add response record**

Create `backend/src/main/java/com/rosaeng/sangdamso/consultant/SgguConsultationResponse.java`:

```java
package com.rosaeng.sangdamso.consultant;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.orderedMap;

import java.util.Map;

public record SgguConsultationResponse(
    SgguConsultationMode mode,
    String source,
    String mood,
    String empathy,
    String diagnosis,
    String recommendation,
    String caution,
    String nextAction,
    String displayText
) {

    public Map<String, Object> toResponseMap() {
        return orderedMap(
            "Mode", mode.wireValue(),
            "Source", source,
            "Mood", mood,
            "Empathy", empathy,
            "Diagnosis", diagnosis,
            "Recommendation", recommendation,
            "Caution", caution,
            "NextAction", nextAction,
            "DisplayText", displayText
        );
    }
}
```

- [ ] **Step 5: Add parser implementation**

Create `backend/src/main/java/com/rosaeng/sangdamso/consultant/SgguResponseParser.java`:

```java
package com.rosaeng.sangdamso.consultant;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.child;

import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Component
public class SgguResponseParser {

    private static final Pattern FENCED_JSON = Pattern.compile("```(?:json)?\\s*([\\s\\S]*?)\\s*```", Pattern.CASE_INSENSITIVE);
    private static final List<String> REQUIRED_FIELDS = List.of("Mood", "Diagnosis", "Recommendation", "NextAction", "DisplayText");
    private static final int MAX_FIELD_CHARS = 500;

    private final ObjectMapper objectMapper;

    public SgguResponseParser(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public SgguConsultationResponse parse(SgguConsultationMode mode, String rawText) {
        JsonNode root = parseJson(extractJson(rawText));

        for (String field : REQUIRED_FIELDS) {
            if (text(root, field).isBlank()) {
                throw new InvalidSgguResponseException("Sggu response is missing required field: " + field);
            }
        }

        return new SgguConsultationResponse(
            mode,
            "llm",
            clamp(text(root, "Mood")),
            clamp(text(root, "Empathy")),
            clamp(text(root, "Diagnosis")),
            clamp(text(root, "Recommendation")),
            clamp(text(root, "Caution")),
            clamp(text(root, "NextAction")),
            clamp(text(root, "DisplayText"))
        );
    }

    private String extractJson(String rawText) {
        String value = String.valueOf(rawText == null ? "" : rawText).trim();
        Matcher matcher = FENCED_JSON.matcher(value);

        if (matcher.find()) {
            return matcher.group(1).trim();
        }

        return value;
    }

    private JsonNode parseJson(String value) {
        try {
            return objectMapper.readTree(value);
        } catch (JacksonException exception) {
            throw new InvalidSgguResponseException("Sggu response was not valid JSON.", exception);
        }
    }

    private String text(JsonNode node, String fieldName) {
        JsonNode value = child(node, fieldName);
        return value == null || value.isNull() ? "" : value.asString().trim();
    }

    private String clamp(String value) {
        String normalized = String.valueOf(value == null ? "" : value).replaceAll("\\s+", " ").trim();
        return normalized.length() <= MAX_FIELD_CHARS ? normalized : normalized.substring(0, MAX_FIELD_CHARS).trim();
    }

    public static class InvalidSgguResponseException extends RuntimeException {

        public InvalidSgguResponseException(String message) {
            super(message);
        }

        public InvalidSgguResponseException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
```

- [ ] **Step 6: Run GREEN**

Run:

```bash
cd backend && ./mvnw -Dtest=SgguResponseParserTest test
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add backend/src/main/java/com/rosaeng/sangdamso/consultant/SgguConsultationMode.java \
  backend/src/main/java/com/rosaeng/sangdamso/consultant/SgguConsultationResponse.java \
  backend/src/main/java/com/rosaeng/sangdamso/consultant/SgguResponseParser.java \
  backend/src/test/java/com/rosaeng/sangdamso/consultant/SgguResponseParserTest.java
git commit -m "feat: add sggu consultation response parser"
```

## Task 2: Deterministic Fallback Composer

**Files:**
- Create: `backend/src/main/java/com/rosaeng/sangdamso/consultant/SgguFallbackComposer.java`
- Create: `backend/src/test/java/com/rosaeng/sangdamso/consultant/SgguFallbackComposerTest.java`

- [ ] **Step 1: Write failing fallback tests**

Create `backend/src/test/java/com/rosaeng/sangdamso/consultant/SgguFallbackComposerTest.java`:

```java
package com.rosaeng.sangdamso.consultant;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.orderedMap;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.toJsonNode;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;

class SgguFallbackComposerTest {

    private final SgguFallbackComposer composer = new SgguFallbackComposer();

    @Test
    void buildsEfficiencySummaryFromTopCandidate() {
        JsonNode context = toJsonNode(orderedMap(
            "profile", orderedMap("characterName", "붐버"),
            "topSpecUps", List.of(orderedMap(
                "label", "무기 11->12",
                "costGold", 100000,
                "gainPercent", 0.3,
                "caveat", "노숨 기대비용 기준"
            ))
        ));

        SgguConsultationResponse response = composer.compose(
            SgguConsultationMode.EFFICIENCY_SUMMARY,
            "전투력 효율 결과를 상담 카드로 요약해줘",
            context
        );

        assertThat(response.source()).isEqualTo("fallback");
        assertThat(response.mode()).isEqualTo(SgguConsultationMode.EFFICIENCY_SUMMARY);
        assertThat(response.diagnosis()).contains("무기 11->12");
        assertThat(response.recommendation()).contains("100,000");
        assertThat(response.caution()).contains("노숨 기대비용 기준");
        assertThat(response.nextAction()).contains("경매장");
    }

    @Test
    void buildsMainChatFallbackWhenNoCandidateExists() {
        JsonNode context = toJsonNode(orderedMap(
            "profile", orderedMap("characterName", "붐버"),
            "topSpecUps", List.of()
        ));

        SgguConsultationResponse response = composer.compose(
            SgguConsultationMode.MAIN_CHAT,
            "뭐부터 올릴까?",
            context
        );

        assertThat(response.source()).isEqualTo("fallback");
        assertThat(response.displayText()).contains("계산 결과");
        assertThat(response.nextAction()).contains("추천 후보");
    }
}
```

- [ ] **Step 2: Run RED**

Run:

```bash
cd backend && ./mvnw -Dtest=SgguFallbackComposerTest test
```

Expected: FAIL because `SgguFallbackComposer` does not exist.

- [ ] **Step 3: Add fallback composer**

Create `backend/src/main/java/com/rosaeng/sangdamso/consultant/SgguFallbackComposer.java`:

```java
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
```

- [ ] **Step 4: Run GREEN**

Run:

```bash
cd backend && ./mvnw -Dtest=SgguFallbackComposerTest test
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add backend/src/main/java/com/rosaeng/sangdamso/consultant/SgguFallbackComposer.java \
  backend/src/test/java/com/rosaeng/sangdamso/consultant/SgguFallbackComposerTest.java
git commit -m "feat: add sggu fallback consultation composer"
```

## Task 3: Mode-Aware Structured Prompt

**Files:**
- Modify: `backend/src/main/java/com/rosaeng/sangdamso/consultant/SgguPromptBuilder.java`
- Modify: `backend/src/test/java/com/rosaeng/sangdamso/consultant/SgguPromptBuilderTest.java`

- [ ] **Step 1: Write failing prompt tests**

Replace `SgguPromptBuilderTest` with:

```java
package com.rosaeng.sangdamso.consultant;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.toJsonNode;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class SgguPromptBuilderTest {

    private final SgguPromptBuilder builder = new SgguPromptBuilder();

    @Test
    void buildsMainChatPromptWithStructuredSchemaAndGroundingRules() {
        var messages = builder.build(
            SgguConsultationMode.MAIN_CHAT,
            "뭐부터 올릴까?",
            List.of(Map.of("role", "assistant", "content", "후보를 볼게.")),
            toJsonNode(Map.of("profile", Map.of("characterName", "붐버")))
        );

        assertThat(messages).hasSize(3);
        assertThat(messages.get(0)).containsEntry("role", "system");
        assertThat(messages.get(0).get("content"))
            .contains("로스트아크 성장 상담사 슥구")
            .contains("JSON 객체만")
            .contains("추천 순서를 바꾸지 않는다")
            .contains("Mode: main-chat")
            .contains("Mood")
            .contains("DisplayText");
        assertThat(messages.get(1)).containsEntry("role", "assistant");
        assertThat(messages.get(2).get("content"))
            .contains("[캐릭터 데이터]")
            .contains("\"characterName\":\"붐버\"")
            .contains("[유저 질문]")
            .contains("뭐부터 올릴까?");
    }

    @Test
    void buildsEfficiencySummaryPromptWithCardInstructions() {
        var messages = builder.build(
            SgguConsultationMode.EFFICIENCY_SUMMARY,
            "전투력 효율 결과를 상담 카드로 요약해줘",
            List.of(),
            toJsonNode(Map.of("topSpecUps", List.of(Map.of("label", "무기 11->12"))))
        );

        assertThat(messages.get(0).get("content"))
            .contains("Mode: efficiency-summary")
            .contains("효율 페이지 상담 카드")
            .contains("진단")
            .contains("다음 행동");
    }
}
```

- [ ] **Step 2: Run RED**

Run:

```bash
cd backend && ./mvnw -Dtest=SgguPromptBuilderTest test
```

Expected: FAIL because `SgguPromptBuilder.build` does not accept `SgguConsultationMode`.

- [ ] **Step 3: Update prompt builder**

Replace `SgguPromptBuilder` with:

```java
package com.rosaeng.sangdamso.consultant;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

@Component
public class SgguPromptBuilder {

    private static final String BASE_SYSTEM_PROMPT = String.join("\n",
        "너는 로스트아크 성장 상담사 슥구다.",
        "한국어로 따뜻하지만 필요할 때는 단호하게 답한다.",
        "반드시 JSON 객체만 출력한다. Markdown, 설명문, 코드블록을 출력하지 않는다.",
        "제공된 데이터와 계산 결과만 근거로 삼는다.",
        "데이터에 없는 내용은 모르면 모른다고 말한다.",
        "가격, 효율, 전투력 상승 수치, 회수 가격은 제공된 값만 사용한다.",
        "추천 순서를 바꾸지 않는다.",
        "비용이 큰 선택이나 회수값 변동이 큰 선택은 단호하게 주의시킨다.",
        "JSON 필드는 Mood, Empathy, Diagnosis, Recommendation, Caution, NextAction, DisplayText를 사용한다.",
        "Mood 값은 warm-but-firm을 기본으로 둔다."
    );
    private static final String MAIN_CHAT_INSTRUCTIONS = String.join("\n",
        "Mode: main-chat",
        "메인 채팅 말풍선에 들어갈 자연스러운 상담 답변을 만든다.",
        "DisplayText는 2~5문장으로 제한한다.",
        "마지막에는 사용자가 바로 할 수 있는 다음 행동 1개를 제안한다."
    );
    private static final String EFFICIENCY_SUMMARY_INSTRUCTIONS = String.join("\n",
        "Mode: efficiency-summary",
        "효율 페이지 상담 카드에 들어갈 구조화 답변을 만든다.",
        "Diagnosis에는 계산 결과의 핵심 진단을 쓴다.",
        "Recommendation에는 계산상 1순위 후보를 그대로 설명한다.",
        "Caution에는 caveat, 경매장 변동, 거래 가능 횟수, 회수값 위험을 쓴다.",
        "NextAction에는 다음 행동 1개를 쓴다."
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
        messages.add(Map.of("role", "system", "content", systemPrompt(mode)));

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

    private String systemPrompt(SgguConsultationMode mode) {
        return BASE_SYSTEM_PROMPT + "\n" + switch (mode) {
            case EFFICIENCY_SUMMARY -> EFFICIENCY_SUMMARY_INSTRUCTIONS;
            case MAIN_CHAT -> MAIN_CHAT_INSTRUCTIONS;
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
```

- [ ] **Step 4: Run GREEN**

Run:

```bash
cd backend && ./mvnw -Dtest=SgguPromptBuilderTest test
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add backend/src/main/java/com/rosaeng/sangdamso/consultant/SgguPromptBuilder.java \
  backend/src/test/java/com/rosaeng/sangdamso/consultant/SgguPromptBuilderTest.java
git commit -m "feat: make sggu prompt mode aware"
```

## Task 4: Consultation Orchestrator Service

**Files:**
- Create: `backend/src/main/java/com/rosaeng/sangdamso/consultant/SgguConsultationService.java`
- Create: `backend/src/test/java/com/rosaeng/sangdamso/consultant/SgguConsultationServiceTest.java`

- [ ] **Step 1: Write failing service tests**

Create `backend/src/test/java/com/rosaeng/sangdamso/consultant/SgguConsultationServiceTest.java`:

```java
package com.rosaeng.sangdamso.consultant;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.orderedMap;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.toJsonNode;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class SgguConsultationServiceTest {

    private FakeLocalLlmClient localLlmClient;
    private SgguConsultationService service;

    @BeforeEach
    void setUp() {
        localLlmClient = new FakeLocalLlmClient();
        service = new SgguConsultationService(
            new SgguPromptBuilder(),
            localLlmClient,
            new SgguResponseParser(new ObjectMapper()),
            new SgguFallbackComposer()
        );
    }

    @Test
    void returnsValidatedLlmConsultation() {
        localLlmClient.text = """
            {
              "Mood": "warm-but-firm",
              "Diagnosis": "보석 효율이 좋아.",
              "Recommendation": "7겁 보석부터 보자.",
              "NextAction": "보석 가격을 확인해줘.",
              "DisplayText": "지금은 보석부터 보는 게 좋아."
            }
            """;

        SgguConsultationResponse response = service.consult(
            SgguConsultationMode.MAIN_CHAT,
            "뭐부터 올릴까?",
            List.of(Map.of("role", "assistant", "content", "후보를 볼게.")),
            context()
        );

        assertThat(response.source()).isEqualTo("llm");
        assertThat(response.displayText()).contains("보석부터");
        assertThat(localLlmClient.messages.get(0).get("content")).contains("Mode: main-chat");
    }

    @Test
    void returnsFallbackWhenLlmIsUnavailable() {
        localLlmClient.exception = new LocalLlmClient.LocalLlmException("LOCAL_LLM_UNAVAILABLE", "down");

        SgguConsultationResponse response = service.consult(
            SgguConsultationMode.EFFICIENCY_SUMMARY,
            "전투력 효율 결과를 상담 카드로 요약해줘",
            List.of(),
            context()
        );

        assertThat(response.source()).isEqualTo("fallback");
        assertThat(response.recommendation()).contains("무기 11->12");
    }

    @Test
    void returnsFallbackWhenLlmReturnsMalformedJson() {
        localLlmClient.text = "보석부터 보는 게 좋아.";

        SgguConsultationResponse response = service.consult(
            SgguConsultationMode.MAIN_CHAT,
            "뭐부터 올릴까?",
            List.of(),
            context()
        );

        assertThat(response.source()).isEqualTo("fallback");
        assertThat(response.displayText()).contains("무기 11->12");
    }

    @Test
    void reusesCachedValidatedResponseForSameFacts() {
        localLlmClient.text = """
            {
              "Mood": "warm-but-firm",
              "Diagnosis": "무기 강화가 1순위야.",
              "Recommendation": "무기 11->12부터 보자.",
              "NextAction": "강화 재료 가격을 확인해줘.",
              "DisplayText": "무기 11->12부터 보자."
            }
            """;

        service.consult(SgguConsultationMode.MAIN_CHAT, "뭐부터?", List.of(), context());
        service.consult(SgguConsultationMode.MAIN_CHAT, "뭐부터?", List.of(), context());

        assertThat(localLlmClient.callCount).isEqualTo(1);
    }

    @Test
    void returnsFallbackWhenEfficiencySummaryDoesNotUseTopCandidate() {
        localLlmClient.text = """
            {
              "Mood": "warm-but-firm",
              "Diagnosis": "보석 효율이 좋아.",
              "Recommendation": "7겁 보석부터 보자.",
              "NextAction": "보석 가격을 확인해줘.",
              "DisplayText": "지금은 보석부터 보는 게 좋아."
            }
            """;

        SgguConsultationResponse response = service.consult(
            SgguConsultationMode.EFFICIENCY_SUMMARY,
            "전투력 효율 결과를 상담 카드로 요약해줘",
            List.of(),
            context()
        );

        assertThat(response.source()).isEqualTo("fallback");
        assertThat(response.recommendation()).contains("무기 11->12");
    }

    private JsonNode context() {
        return toJsonNode(orderedMap(
            "profile", orderedMap("characterName", "붐버"),
            "topSpecUps", List.of(orderedMap(
                "label", "무기 11->12",
                "costGold", 100000,
                "gainPercent", 0.3,
                "caveat", "노숨 기대비용 기준"
            ))
        ));
    }

    private static class FakeLocalLlmClient implements LocalLlmClient {

        private String text = "";
        private LocalLlmException exception;
        private int callCount;
        private List<Map<String, String>> messages;

        @Override
        public Completion createChatCompletion(List<Map<String, String>> messages) {
            this.messages = messages;
            callCount++;

            if (exception != null) {
                throw exception;
            }

            return new Completion(text, "ollama", "qwen2.5:7b", Map.of());
        }
    }
}
```

- [ ] **Step 2: Run RED**

Run:

```bash
cd backend && ./mvnw -Dtest=SgguConsultationServiceTest test
```

Expected: FAIL because `SgguConsultationService` does not exist.

- [ ] **Step 3: Implement orchestrator service**

Create `backend/src/main/java/com/rosaeng/sangdamso/consultant/SgguConsultationService.java`:

```java
package com.rosaeng.sangdamso.consultant;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.arrayItems;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.child;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

@Service
public class SgguConsultationService {

    private static final long CACHE_TTL_MS = 5 * 60 * 1000L;

    private final SgguPromptBuilder promptBuilder;
    private final LocalLlmClient localLlmClient;
    private final SgguResponseParser responseParser;
    private final SgguFallbackComposer fallbackComposer;
    private final Map<String, CachedConsultation> cache = new ConcurrentHashMap<>();

    public SgguConsultationService(
        SgguPromptBuilder promptBuilder,
        LocalLlmClient localLlmClient,
        SgguResponseParser responseParser,
        SgguFallbackComposer fallbackComposer
    ) {
        this.promptBuilder = promptBuilder;
        this.localLlmClient = localLlmClient;
        this.responseParser = responseParser;
        this.fallbackComposer = fallbackComposer;
    }

    public SgguConsultationResponse consult(
        SgguConsultationMode mode,
        String message,
        List<Map<String, String>> conversation,
        JsonNode context
    ) {
        String cacheKey = cacheKey(mode, message, context);
        long now = Instant.now().toEpochMilli();
        CachedConsultation cached = cache.get(cacheKey);

        if (cached != null && cached.expiresAtEpochMs() > now) {
            return cached.response();
        }

        try {
            List<Map<String, String>> messages = promptBuilder.build(mode, message, conversation, context);
            LocalLlmClient.Completion completion = localLlmClient.createChatCompletion(messages);
            SgguConsultationResponse response = responseParser.parse(mode, completion.text());

            if (!isGrounded(mode, context, response)) {
                return fallbackComposer.compose(mode, message, context);
            }

            cache.put(cacheKey, new CachedConsultation(response, now + CACHE_TTL_MS));
            return response;
        } catch (LocalLlmClient.LocalLlmException | SgguResponseParser.InvalidSgguResponseException exception) {
            return fallbackComposer.compose(mode, message, context);
        }
    }

    private boolean isGrounded(SgguConsultationMode mode, JsonNode context, SgguConsultationResponse response) {
        if (mode != SgguConsultationMode.EFFICIENCY_SUMMARY) {
            return true;
        }

        JsonNode topCandidate = arrayItems(child(context, "topSpecUps")).stream().findFirst().orElse(null);
        String label = text(topCandidate, "label");

        if (label.isBlank()) {
            return true;
        }

        String responseText = String.join(" ",
            response.diagnosis(),
            response.recommendation(),
            response.nextAction(),
            response.displayText()
        );

        return responseText.contains(label);
    }

    private String cacheKey(SgguConsultationMode mode, String message, JsonNode context) {
        return mode.wireValue() + "|" + normalize(message) + "|" + sha256(context == null ? "{}" : context.toString());
    }

    private String normalize(String value) {
        return String.valueOf(value == null ? "" : value).replaceAll("\\s+", " ").trim();
    }

    private String text(JsonNode node, String fieldName) {
        JsonNode value = child(node, fieldName);
        return value == null || value.isNull() ? "" : value.asString().trim();
    }

    private String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hashed);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }

    private record CachedConsultation(SgguConsultationResponse response, long expiresAtEpochMs) {
    }
}
```

- [ ] **Step 4: Run GREEN**

Run:

```bash
cd backend && ./mvnw -Dtest=SgguConsultationServiceTest test
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add backend/src/main/java/com/rosaeng/sangdamso/consultant/SgguConsultationService.java \
  backend/src/test/java/com/rosaeng/sangdamso/consultant/SgguConsultationServiceTest.java
git commit -m "feat: orchestrate sggu consultations"
```

## Task 5: Controller Contract Migration

**Files:**
- Modify: `backend/src/main/java/com/rosaeng/sangdamso/consultant/ConsultantController.java`
- Modify: `backend/src/test/java/com/rosaeng/sangdamso/consultant/ConsultantControllerTest.java`

- [ ] **Step 1: Update controller tests for the new response contract**

In `ConsultantControllerTest`, change `TestConfig` to provide a fake `SgguConsultationService` instead of `FakeLocalLlmClient`. Replace the successful response test with:

```java
    @Autowired
    private FakeSgguConsultationService consultationService;

    @BeforeEach
    void resetClient() {
        consultationService.reset();
    }

    @Test
    void returnsStructuredConsultationResponseWithCompactContext() throws Exception {
        mockMvc.perform(post("/api/consult/sggu")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "mode": "main-chat",
                      "message": "뭐부터 올릴까?",
                      "conversation": [
                        {"role": "user", "content": "현재 상태 봐줘"},
                        {"role": "sggu", "content": "후보를 볼게."}
                      ],
                      "context": {
                        "profile": {"characterName": "붐버", "className": "스카우터"},
                        "topSpecUps": [{"label": "무기 11->12", "gainPercent": 0.3}]
                      }
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.Mode").value("main-chat"))
            .andExpect(jsonPath("$.Source").value("llm"))
            .andExpect(jsonPath("$.DisplayText").value("지금은 보석부터 올려."))
            .andExpect(jsonPath("$.NextAction").value("보석 가격을 확인해줘."));

        assertThat(consultationService.mode).isEqualTo(SgguConsultationMode.MAIN_CHAT);
        assertThat(consultationService.message).isEqualTo("뭐부터 올릴까?");
        assertThat(consultationService.conversation).hasSize(2);
        assertThat(consultationService.context.toString()).contains("\"characterName\":\"붐버\"");
    }
```

Add an efficiency mode test:

```java
    @Test
    void acceptsEfficiencySummaryMode() throws Exception {
        mockMvc.perform(post("/api/consult/sggu")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "mode": "efficiency-summary",
                      "message": "전투력 효율 결과를 상담 카드로 요약해줘",
                      "context": {
                        "profile": {"characterName": "붐버"},
                        "topSpecUps": [{"label": "무기 11->12"}]
                      }
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.Mode").value("efficiency-summary"));

        assertThat(consultationService.mode).isEqualTo(SgguConsultationMode.EFFICIENCY_SUMMARY);
    }
```

Use this fake service inside the test class:

```java
    static class FakeSgguConsultationService extends SgguConsultationService {

        private SgguConsultationMode mode;
        private String message;
        private List<Map<String, String>> conversation;
        private JsonNode context;

        FakeSgguConsultationService() {
            super(null, null, null, null);
        }

        @Override
        public SgguConsultationResponse consult(
            SgguConsultationMode mode,
            String message,
            List<Map<String, String>> conversation,
            JsonNode context
        ) {
            this.mode = mode;
            this.message = message;
            this.conversation = conversation;
            this.context = context;
            return new SgguConsultationResponse(
                mode,
                "llm",
                "warm-but-firm",
                "후보를 같이 볼게.",
                "보석 효율이 좋아.",
                "보석부터 올려.",
                "경매장 가격은 다시 확인해.",
                "보석 가격을 확인해줘.",
                "지금은 보석부터 올려."
            );
        }

        void reset() {
            mode = null;
            message = "";
            conversation = List.of();
            context = null;
        }
    }
```

In `TestConfig`, replace `FakeLocalLlmClient` bean with:

```java
        @Bean
        FakeSgguConsultationService sgguConsultationService() {
            return new FakeSgguConsultationService();
        }
```

- [ ] **Step 2: Run RED**

Run:

```bash
cd backend && ./mvnw -Dtest=ConsultantControllerTest test
```

Expected: FAIL because `ConsultantController` still calls `LocalLlmClient` directly and returns `Answer`.

- [ ] **Step 3: Update controller implementation**

Replace `ConsultantController` with:

```java
package com.rosaeng.sangdamso.consultant;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.child;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.isObject;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.text;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.toJsonNode;

import com.rosaeng.sangdamso.common.BffException;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/api/consult")
public class ConsultantController {

    private final SgguContextBuilder contextBuilder;
    private final SgguConsultationService consultationService;

    public ConsultantController(
        SgguContextBuilder contextBuilder,
        SgguConsultationService consultationService
    ) {
        this.contextBuilder = contextBuilder;
        this.consultationService = consultationService;
    }

    @PostMapping("/sggu")
    public JsonNode consult(@RequestBody(required = false) JsonNode body) {
        JsonNode requestBody = body == null ? toJsonNode(Map.of()) : body;
        String message = contextBuilder.sanitizeMessage(text(requestBody, "message"));

        if (message.isEmpty()) {
            throw new BffException(HttpStatus.BAD_REQUEST, "INVALID_MESSAGE", "상담할 내용을 입력해줘.");
        }

        JsonNode context = contextNode(requestBody);

        if (text(child(context, "profile"), "characterName").trim().isEmpty()) {
            throw new BffException(HttpStatus.BAD_REQUEST, "INVALID_ARMORY", "캐릭터를 먼저 조회해줘.");
        }

        SgguConsultationMode mode = SgguConsultationMode.from(text(requestBody, "mode"));
        List<Map<String, String>> conversation = contextBuilder.normalizeConversation(child(requestBody, "conversation"));
        return toJsonNode(consultationService.consult(mode, message, conversation, context).toResponseMap());
    }

    private JsonNode contextNode(JsonNode requestBody) {
        JsonNode providedContext = child(requestBody, "context");

        if (isObject(providedContext)) {
            return providedContext;
        }

        return toJsonNode(contextBuilder.build(child(requestBody, "armory"), child(requestBody, "specUpRecommendation")));
    }
}
```

- [ ] **Step 4: Run GREEN**

Run:

```bash
cd backend && ./mvnw -Dtest=ConsultantControllerTest test
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add backend/src/main/java/com/rosaeng/sangdamso/consultant/ConsultantController.java \
  backend/src/test/java/com/rosaeng/sangdamso/consultant/ConsultantControllerTest.java
git commit -m "feat: return structured sggu consultations"
```

## Task 6: Frontend Main Chat Contract

**Files:**
- Modify: `lib/ui/sgguConsultantState.js`
- Modify: `tests/sgguConsultantState.test.js`
- Modify: `app/page.jsx`

- [ ] **Step 1: Add failing frontend state tests**

Update the existing import from `../lib/ui/sgguConsultantState.js` in `tests/sgguConsultantState.test.js` so it includes `getConsultDisplayText`:

```js
  getConsultDisplayText,
```

Append these tests to `tests/sgguConsultantState.test.js`:

```js

test("builds main-chat consult request body", () => {
  const body = buildConsultRequestBody({
    message: "뭐부터 올려?",
    conversation: [],
    armory: {
      profile: {
        CharacterName: "붐버"
      }
    },
    specUpRecommendation: null
  });

  assert.equal(body.mode, "main-chat");
});

test("reads structured consult display text", () => {
  assert.equal(
    getConsultDisplayText({ DisplayText: "지금은 보석부터 봐.", Answer: "legacy" }),
    "지금은 보석부터 봐."
  );
  assert.equal(getConsultDisplayText({ Answer: "legacy" }), "legacy");
  assert.equal(getConsultDisplayText({}), "");
});
```

- [ ] **Step 2: Run RED**

Run:

```bash
npm test -- tests/sgguConsultantState.test.js
```

Expected: FAIL because `getConsultDisplayText` does not exist and request body has no `mode`.

- [ ] **Step 3: Update state helpers**

In `lib/ui/sgguConsultantState.js`, change `buildConsultRequestBody` and add `getConsultDisplayText`:

```js
export function getConsultDisplayText(data) {
  if (typeof data?.DisplayText === "string" && data.DisplayText.trim()) {
    return data.DisplayText.trim();
  }

  if (typeof data?.Answer === "string" && data.Answer.trim()) {
    return data.Answer.trim();
  }

  return "";
}

export function buildConsultRequestBody({ message, conversation, armory, specUpRecommendation, mode = "main-chat" } = {}) {
  return {
    mode,
    message,
    conversation,
    context: buildSgguConsultantContext({ armory, specUpRecommendation })
  };
}
```

- [ ] **Step 4: Update `app/page.jsx` to read `DisplayText`**

Add `getConsultDisplayText` to the import from `../lib/ui/sgguConsultantState.js`:

```js
  getConsultDisplayText,
```

Replace:

```js
      const answer = typeof data?.Answer === "string" ? data.Answer.trim() : "";
```

with:

```js
      const answer = getConsultDisplayText(data);
```

- [ ] **Step 5: Run GREEN**

Run:

```bash
npm test -- tests/sgguConsultantState.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add lib/ui/sgguConsultantState.js tests/sgguConsultantState.test.js app/page.jsx
git commit -m "feat: consume structured sggu chat responses"
```

## Task 7: Efficiency Consultation State Helpers

**Files:**
- Create: `lib/ui/efficiencyConsultationState.js`
- Create: `tests/efficiencyConsultationState.test.js`

- [ ] **Step 1: Write failing helper tests**

Create `tests/efficiencyConsultationState.test.js`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEfficiencyConsultRequestBody,
  createEfficiencyConsultationState,
  resolveEfficiencyAdvisorMessage
} from "../lib/ui/efficiencyConsultationState.js";

test("shows thinking copy while calculation is loading", () => {
  assert.equal(
    resolveEfficiencyAdvisorMessage({ isLoading: true, result: null, consultation: createEfficiencyConsultationState() }),
    "슥구가 생각중이다."
  );
});

test("shows consultation loading copy after calculation is ready", () => {
  assert.equal(
    resolveEfficiencyAdvisorMessage({
      isLoading: false,
      result: { CharacterName: "붐버" },
      consultation: { status: "loading", response: null, error: "" }
    }),
    "슥구가 결과를 정리하고 있어."
  );
});

test("shows consultation display text when ready", () => {
  assert.equal(
    resolveEfficiencyAdvisorMessage({
      isLoading: false,
      result: { CharacterName: "붐버" },
      consultation: {
        status: "ready",
        response: { DisplayText: "지금은 보석부터 보는 게 좋아." },
        error: ""
      }
    }),
    "지금은 보석부터 보는 게 좋아."
  );
});

test("builds efficiency-summary request body from calculation result", () => {
  const body = buildEfficiencyConsultRequestBody({
    result: {
      CharacterName: "붐버",
      Recommendation: {
        TopCandidates: [{ Label: "무기 11->12", NetCostGold: 100000 }]
      }
    }
  });

  assert.equal(body.mode, "efficiency-summary");
  assert.equal(body.message, "전투력 효율 결과를 상담 카드로 요약해줘");
  assert.equal(body.context.profile.characterName, "붐버");
  assert.equal(body.context.topSpecUps[0].label, "무기 11->12");
});
```

- [ ] **Step 2: Run RED**

Run:

```bash
npm test -- tests/efficiencyConsultationState.test.js
```

Expected: FAIL because `lib/ui/efficiencyConsultationState.js` does not exist.

- [ ] **Step 3: Add helper module**

Create `lib/ui/efficiencyConsultationState.js`:

```js
import { buildSgguConsultantContext } from "./sgguContext.js";

export const EFFICIENCY_CONSULT_MESSAGE = "전투력 효율 결과를 상담 카드로 요약해줘";

export function createEfficiencyConsultationState() {
  return {
    status: "idle",
    response: null,
    error: ""
  };
}

export function buildEfficiencyConsultRequestBody({ result } = {}) {
  return {
    mode: "efficiency-summary",
    message: EFFICIENCY_CONSULT_MESSAGE,
    conversation: [],
    context: buildSgguConsultantContext({
      armory: {
        profile: {
          CharacterName: result?.CharacterName || result?.Profile?.CharacterName || ""
        }
      },
      specUpRecommendation: result || null
    })
  };
}

export function resolveEfficiencyAdvisorMessage({ isLoading, result, consultation }) {
  if (isLoading) {
    return "슥구가 생각중이다.";
  }

  if (!result) {
    return "캐릭터의 현재 장비를 기준으로 전투력 효율을 계산할게. 아래 버튼을 누르면 최신 자료로 다시 맞춰볼 수 있어.";
  }

  if (consultation?.response?.DisplayText) {
    return consultation.response.DisplayText;
  }

  if (consultation?.status === "loading") {
    return "슥구가 결과를 정리하고 있어.";
  }

  if (consultation?.status === "fallback") {
    return "계산 결과는 정리됐어. 추천 후보의 비용과 전투력 상승폭을 먼저 비교해보자.";
  }

  return "슥구가 결과를 정리하고 있어.";
}
```

- [ ] **Step 4: Run GREEN**

Run:

```bash
npm test -- tests/efficiencyConsultationState.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add lib/ui/efficiencyConsultationState.js tests/efficiencyConsultationState.test.js
git commit -m "feat: add efficiency consultation state helpers"
```

## Task 8: Efficiency Page Async Consultation

**Files:**
- Modify: `components/CombatPowerEfficiencyPage.jsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Wire helper imports and state**

In `components/CombatPowerEfficiencyPage.jsx`, add imports:

```js
import {
  buildEfficiencyConsultRequestBody,
  createEfficiencyConsultationState,
  resolveEfficiencyAdvisorMessage
} from "../lib/ui/efficiencyConsultationState.js";
```

Add state near existing state:

```js
  const [consultation, setConsultation] = useState(() => createEfficiencyConsultationState());
```

- [ ] **Step 2: Add async consultation loader**

Add this callback after `loadRecovery`:

```js
  const loadConsultation = useCallback(async (calculationResult) => {
    setConsultation({ status: "loading", response: null, error: "" });

    try {
      const response = await fetch("/api/consult/sggu", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildEfficiencyConsultRequestBody({ result: calculationResult }))
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.message || "슥구 상담을 정리하지 못했어.");
      }

      setConsultation({ status: data?.Source === "fallback" ? "fallback" : "ready", response: data, error: "" });
    } catch (caughtError) {
      setConsultation({
        status: "fallback",
        response: {
          DisplayText: "계산 결과는 정리됐어. 추천 후보의 비용과 전투력 상승폭을 먼저 비교해보자.",
          Diagnosis: "상담 문장을 만드는 중 문제가 있었어.",
          Recommendation: "표시된 1순위 후보부터 확인하자.",
          Caution: "실제 구매 전에는 경매장 가격과 거래 가능 횟수를 다시 확인해줘.",
          NextAction: "추천 후보의 순비용과 상승폭을 먼저 비교해줘."
        },
        error: caughtError instanceof Error ? caughtError.message : "슥구 상담을 정리하지 못했어."
      });
    }
  }, []);
```

- [ ] **Step 3: Reset and trigger consultation after calculation**

Inside `loadRecommendationByName`, after `setRecovery(null);`, add:

```js
    setConsultation(createEfficiencyConsultationState());
```

After `setResult(data);`, add:

```js
      loadConsultation(data);
```

Update the dependency array:

```js
  }, [loadConsultation, loadRecovery]);
```

- [ ] **Step 4: Replace advisor message builder usage**

Remove the local `buildAdvisorMessage` function if it is no longer used.

Replace the `advisorMessage` constant with:

```js
  const advisorMessage = error
    ? "자료를 읽는 중에 막힌 부분이 있어. 캐릭터명과 API 상태를 확인하고 다시 계산해보자."
    : resolveEfficiencyAdvisorMessage({
      isLoading,
      result,
      consultation
    });
```

- [ ] **Step 5: Add consultation card rendering**

Below `<AccessoryRecommendationPanel ... />`, add:

```jsx
            <section className={`efficiency-consultation-card ${consultation.status}`} aria-live="polite">
              <div>
                <span>슥구 상담 정리</span>
                <h2>{consultation.response?.Diagnosis || "슥구가 결과를 정리하고 있어."}</h2>
              </div>
              {consultation.response ? (
                <div className="efficiency-consultation-grid">
                  <article>
                    <span>추천</span>
                    <p>{consultation.response.Recommendation}</p>
                  </article>
                  <article>
                    <span>주의</span>
                    <p>{consultation.response.Caution || "실제 구매 전 경매장 상태를 다시 확인해줘."}</p>
                  </article>
                  <article>
                    <span>다음 행동</span>
                    <p>{consultation.response.NextAction}</p>
                  </article>
                </div>
              ) : (
                <p>슥구가 계산 결과를 읽고 상담 메모를 정리하고 있어.</p>
              )}
            </section>
```

- [ ] **Step 6: Add CSS**

Append to `app/globals.css` near existing efficiency styles:

```css
.efficiency-consultation-card {
  border: 1px solid rgba(38, 70, 83, 0.18);
  border-radius: 8px;
  background: #ffffff;
  padding: 20px;
  box-shadow: 0 16px 42px rgba(15, 23, 42, 0.08);
}

.efficiency-consultation-card > div:first-child span,
.efficiency-consultation-grid article span {
  display: block;
  color: #5f6f76;
  font-size: 0.78rem;
  font-weight: 700;
  margin-bottom: 6px;
}

.efficiency-consultation-card h2 {
  color: #18252b;
  font-size: 1.15rem;
  margin: 0;
}

.efficiency-consultation-card p {
  color: #304149;
  line-height: 1.65;
  margin: 10px 0 0;
}

.efficiency-consultation-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 16px;
}

.efficiency-consultation-grid article {
  border: 1px solid rgba(38, 70, 83, 0.14);
  border-radius: 8px;
  padding: 14px;
}

@media (max-width: 760px) {
  .efficiency-consultation-grid {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 7: Run frontend tests**

Run:

```bash
npm test -- tests/efficiencyConsultationState.test.js tests/sgguConsultantState.test.js
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add components/CombatPowerEfficiencyPage.jsx app/globals.css
git commit -m "feat: show async sggu efficiency consultation"
```

## Task 9: Smoke Test And Full Verification

**Files:**
- Modify: `scripts/smoke-sggu-consult.mjs`
- Modify: `README.md`

- [ ] **Step 1: Update smoke script response validation**

In `scripts/smoke-sggu-consult.mjs`, replace:

```js
    if (typeof data?.Answer !== "string" || !data.Answer.trim()) {
      throw new Error("200 OK but response did not include Answer text");
    }
```

with:

```js
    if (typeof data?.DisplayText !== "string" || !data.DisplayText.trim()) {
      throw new Error("200 OK but response did not include DisplayText");
    }

    for (const field of ["Mode", "Source", "Diagnosis", "Recommendation", "NextAction"]) {
      if (typeof data?.[field] !== "string" || !data[field].trim()) {
        throw new Error(`200 OK but response did not include ${field}`);
      }
    }
```

Replace:

```js
    console.log(`Answer: ${data.Answer.trim()}`);
```

with:

```js
    console.log(`Source: ${data.Source || "unknown"}`);
    console.log(`DisplayText: ${data.DisplayText.trim()}`);
```

- [ ] **Step 2: Update smoke request body with mode**

In `buildRequestBody`, add:

```js
    mode: "main-chat",
```

to the returned object.

- [ ] **Step 3: Update README local LLM note**

In `README.md`, replace the smoke test sentence:

```md
`npm run smoke:sggu`는 실행 중인 Next.js 서버의 `POST /api/consult/sggu`를 호출해 Spring Boot 상담 API와 Ollama 연결을 함께 확인한다.
```

with:

```md
`npm run smoke:sggu`는 실행 중인 Next.js 서버의 `POST /api/consult/sggu`를 호출해 Spring Boot 상담 API, 구조화 상담 응답, Ollama 연결을 함께 확인한다.
```

- [ ] **Step 4: Run focused backend tests**

Run:

```bash
cd backend && ./mvnw -Dtest=SgguResponseParserTest,SgguFallbackComposerTest,SgguPromptBuilderTest,SgguConsultationServiceTest,ConsultantControllerTest test
```

Expected: PASS.

- [ ] **Step 5: Run full backend tests**

Run:

```bash
cd backend && ./mvnw test
```

Expected: PASS with `Failures: 0, Errors: 0`.

- [ ] **Step 6: Run frontend tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 7: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 8: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 9: Commit verification updates**

Run:

```bash
git add scripts/smoke-sggu-consult.mjs README.md
git commit -m "test: verify structured sggu consultation smoke"
```

## Manual Verification

- Start backend with `npm run dev:backend`.
- Start frontend with `npm run dev:restart`.
- Open `http://localhost:3000`.
- Search a character.
- Ask Sggu a normal main-chat question and confirm a natural answer appears.
- Open the efficiency page from the loaded character.
- Confirm the page shows `슥구가 생각중이다.` while calculation is loading.
- Confirm calculation results appear before the consultation card.
- Confirm the consultation card fills after the async `POST /api/consult/sggu` call.
- Stop Ollama and repeat the chat request.
- Confirm a fallback Sggu response appears instead of an empty answer.
