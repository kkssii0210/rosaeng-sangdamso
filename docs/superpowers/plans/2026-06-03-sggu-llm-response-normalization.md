# Sggu LLM Response Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Sggu consultation tolerate simple local LLM response type drift while falling back instead of returning HTTP 500 for unrecoverable shapes.

**Architecture:** Keep `SgguConsultationService` as the fallback boundary and move all JSON field type handling into `SgguResponseParser`. The parser normalizes string-like scalars and simple arrays, and translates unsupported shapes into `InvalidSgguResponseException` so existing service fallback handling works.

**Tech Stack:** Java 21, Spring Boot 4, Jackson 3 `JsonNode`, JUnit 5, AssertJ, Maven wrapper, npm scripts for smoke verification.

---

## File Structure

- Modify `backend/src/main/java/com/rosaeng/sangdamso/consultant/SgguResponseParser.java`
  - Owns JSON extraction, parsing, field normalization, required field validation, and parser-domain exceptions.
- Modify `backend/src/test/java/com/rosaeng/sangdamso/consultant/SgguResponseParserTest.java`
  - Covers parser-level recoverable and unrecoverable schema drift.
- Modify `backend/src/test/java/com/rosaeng/sangdamso/consultant/SgguConsultationServiceTest.java`
  - Covers service-level fallback behavior and confirms recoverable drift still returns `Source=llm`.

No new production files are needed.

## Task 1: Add Failing Regression Tests

**Files:**
- Modify: `backend/src/test/java/com/rosaeng/sangdamso/consultant/SgguResponseParserTest.java`
- Modify: `backend/src/test/java/com/rosaeng/sangdamso/consultant/SgguConsultationServiceTest.java`

- [ ] **Step 1: Add parser regression tests**

Add these tests to `SgguResponseParserTest`, after `parsesJsonWrappedInMarkdownFence()` and before `rejectsMalformedJson()`:

```java
    @Test
    void parsesSimpleArrayFieldsAsText() {
        SgguConsultationResponse response = parser.parse(
            SgguConsultationMode.MAIN_CHAT,
            """
                {
                  "Mood": "warm-but-firm",
                  "Empathy": true,
                  "Diagnosis": "무기 강화가 1순위야.",
                  "Recommendation": ["무기 11->12부터 확인하자.", "구매 전 가격을 다시 보자."],
                  "Caution": 123,
                  "NextAction": "강화 재료 가격을 확인해줘.",
                  "DisplayText": ["무기 11->12부터 보자.", "가격은 다시 확인해줘."]
                }
                """
        );

        assertThat(response.source()).isEqualTo("llm");
        assertThat(response.empathy()).isEqualTo("true");
        assertThat(response.recommendation()).isEqualTo("무기 11->12부터 확인하자. 구매 전 가격을 다시 보자.");
        assertThat(response.caution()).isEqualTo("123");
        assertThat(response.displayText()).isEqualTo("무기 11->12부터 보자. 가격은 다시 확인해줘.");
    }

    @Test
    void rejectsObjectFieldAsInvalidSgguResponse() {
        try {
            parser.parse(
                SgguConsultationMode.MAIN_CHAT,
                """
                    {
                      "Mood": "warm-but-firm",
                      "Diagnosis": {"summary": "무기 강화가 1순위야."},
                      "Recommendation": "무기 11->12부터 확인하자.",
                      "NextAction": "강화 재료 가격을 확인해줘.",
                      "DisplayText": "무기 11->12부터 보자."
                    }
                    """
            );
        } catch (SgguResponseParser.InvalidSgguResponseException exception) {
            assertThat(exception.getMessage()).contains("Diagnosis");
            return;
        }

        throw new AssertionError("Expected InvalidSgguResponseException");
    }

    @Test
    void rejectsNestedArrayFieldAsInvalidSgguResponse() {
        try {
            parser.parse(
                SgguConsultationMode.MAIN_CHAT,
                """
                    {
                      "Mood": "warm-but-firm",
                      "Diagnosis": "무기 강화가 1순위야.",
                      "Recommendation": [["무기 11->12부터 확인하자."]],
                      "NextAction": "강화 재료 가격을 확인해줘.",
                      "DisplayText": "무기 11->12부터 보자."
                    }
                    """
            );
        } catch (SgguResponseParser.InvalidSgguResponseException exception) {
            assertThat(exception.getMessage()).contains("Recommendation");
            return;
        }

        throw new AssertionError("Expected InvalidSgguResponseException");
    }
```

- [ ] **Step 2: Add service regression tests**

Add these tests to `SgguConsultationServiceTest`, after `returnsFallbackWhenLlmReturnsMalformedJson()`:

```java
    @Test
    void returnsValidatedLlmConsultationWhenRequiredFieldIsSimpleArray() {
        localLlmClient.text = """
            {
              "Mood": "warm-but-firm",
              "Diagnosis": "무기 강화가 1순위야.",
              "Recommendation": ["무기 11->12부터 보자.", "구매 전 가격을 확인해줘."],
              "NextAction": "강화 재료 가격을 확인해줘.",
              "DisplayText": ["무기 11->12부터 보는 게 좋아.", "가격은 다시 확인해줘."]
            }
            """;

        SgguConsultationResponse response = service.consult(
            SgguConsultationMode.MAIN_CHAT,
            "뭐부터 올릴까?",
            List.of(),
            context()
        );

        assertThat(response.source()).isEqualTo("llm");
        assertThat(response.recommendation()).contains("무기 11->12부터 보자.");
        assertThat(response.displayText()).contains("가격은 다시 확인해줘.");
    }

    @Test
    void returnsFallbackWhenLlmReturnsUnsupportedObjectField() {
        localLlmClient.text = """
            {
              "Mood": "warm-but-firm",
              "Diagnosis": {"summary": "무기 강화가 1순위야."},
              "Recommendation": "무기 11->12부터 보자.",
              "NextAction": "강화 재료 가격을 확인해줘.",
              "DisplayText": "무기 11->12부터 보는 게 좋아."
            }
            """;

        SgguConsultationResponse response = service.consult(
            SgguConsultationMode.MAIN_CHAT,
            "뭐부터 올릴까?",
            List.of(),
            context()
        );

        assertThat(response.source()).isEqualTo("fallback");
        assertThat(response.recommendation()).contains("무기 11->12");
    }
```

- [ ] **Step 3: Run targeted backend tests and verify they fail**

Run:

```bash
cd backend && ./mvnw -Dtest=SgguResponseParserTest,SgguConsultationServiceTest test
```

Expected: FAIL.

Expected failure signals:

- `parsesSimpleArrayFieldsAsText` fails because `ArrayNode.asString()` cannot coerce arrays.
- `rejectsObjectFieldAsInvalidSgguResponse` or `returnsFallbackWhenLlmReturnsUnsupportedObjectField` fails because `JsonNodeException` escapes instead of being wrapped as `InvalidSgguResponseException`.

Do not change production code in this task.

## Task 2: Implement Parser Normalization

**Files:**
- Modify: `backend/src/main/java/com/rosaeng/sangdamso/consultant/SgguResponseParser.java`
- Test: `backend/src/test/java/com/rosaeng/sangdamso/consultant/SgguResponseParserTest.java`
- Test: `backend/src/test/java/com/rosaeng/sangdamso/consultant/SgguConsultationServiceTest.java`

- [ ] **Step 1: Add imports**

Add this import to `SgguResponseParser.java`:

```java
import java.util.ArrayList;
```

Keep existing imports.

- [ ] **Step 2: Replace the `text` helper**

Replace the current `text(JsonNode node, String fieldName)` method:

```java
    private String text(JsonNode node, String fieldName) {
        JsonNode value = child(node, fieldName);
        return value == null || value.isNull() ? "" : value.asString().trim();
    }
```

with:

```java
    private String text(JsonNode node, String fieldName) {
        return coerceText(child(node, fieldName), fieldName).trim();
    }

    private String coerceText(JsonNode value, String fieldName) {
        if (value == null || value.isNull()) {
            return "";
        }

        if (value.isTextual()) {
            return value.asString();
        }

        if (value.isNumber() || value.isBoolean()) {
            return value.toString();
        }

        if (value.isArray()) {
            return arrayText(value, fieldName);
        }

        throw unsupportedFieldType(fieldName);
    }

    private String arrayText(JsonNode value, String fieldName) {
        List<String> items = new ArrayList<>();

        for (JsonNode item : value) {
            if (item == null || item.isNull()) {
                continue;
            }

            if (item.isArray() || item.isObject()) {
                throw unsupportedFieldType(fieldName);
            }

            String text = coerceText(item, fieldName).trim();

            if (!text.isBlank()) {
                items.add(text);
            }
        }

        return String.join(" ", items);
    }

    private InvalidSgguResponseException unsupportedFieldType(String fieldName) {
        return new InvalidSgguResponseException("Sggu response field has unsupported type: " + fieldName);
    }
```

This implementation intentionally keeps object and nested-array handling strict. It permits only null, scalar values, and flat arrays of scalar values.

- [ ] **Step 3: Run targeted backend tests and verify they pass**

Run:

```bash
cd backend && ./mvnw -Dtest=SgguResponseParserTest,SgguConsultationServiceTest test
```

Expected: PASS.

- [ ] **Step 4: Commit parser normalization**

Run:

```bash
git add backend/src/main/java/com/rosaeng/sangdamso/consultant/SgguResponseParser.java \
  backend/src/test/java/com/rosaeng/sangdamso/consultant/SgguResponseParserTest.java \
  backend/src/test/java/com/rosaeng/sangdamso/consultant/SgguConsultationServiceTest.java
git commit -m "fix: normalize sggu llm response fields"
```

## Task 3: Run Full Verification

**Files:**
- Verify: `backend/src/main/java/com/rosaeng/sangdamso/consultant/SgguResponseParser.java`
- Verify: `backend/src/test/java/com/rosaeng/sangdamso/consultant/SgguResponseParserTest.java`
- Verify: `backend/src/test/java/com/rosaeng/sangdamso/consultant/SgguConsultationServiceTest.java`

- [ ] **Step 1: Run backend test suite**

Run:

```bash
cd backend && ./mvnw test
```

Expected: PASS.

- [ ] **Step 2: Run repository test script**

Run:

```bash
npm run test
```

Expected: PASS.

- [ ] **Step 3: Confirm backend is running with current environment**

If the backend dev server is not running, start it:

```bash
npm run dev:backend
```

Expected log:

```text
Tomcat started on port 8080
```

- [ ] **Step 4: Run Sggu smoke test**

Run:

```bash
npm run smoke:sggu
```

Expected when Ollama returns a recoverable response:

```text
Sggu consult smoke OK
Source: llm
```

If smoke returns `Source=fallback` through a direct endpoint check, confirm the endpoint still returns HTTP 200 and not HTTP 500. The strict `smoke:sggu` script expects `Source=llm`, so a fallback response means the parser avoided the crash but the model returned an unrecoverable structure.

- [ ] **Step 5: Inspect git status**

Run:

```bash
git status --short
```

Expected: clean after the Task 2 commit, unless verification generated local cache files that should not be committed.

## Task 4: Manual Behavior Check

**Files:**
- Verify: `components/SgguConsultantChat.jsx`
- Verify: `backend/src/main/java/com/rosaeng/sangdamso/consultant/ConsultantController.java`
- Verify: `backend/src/main/java/com/rosaeng/sangdamso/consultant/SgguConsultationService.java`

- [ ] **Step 1: Open the app**

Use:

```text
http://localhost:3000
```

Expected: the main page loads.

- [ ] **Step 2: Ask a Sggu consultation question after loading a character**

Use a normal question such as:

```text
지금 뭐부터 올릴까?
```

Expected:

- The UI shows a Sggu answer instead of an error state.
- The backend does not log `JsonNodeException`.
- If the LLM answer is accepted, API response has `Source: "llm"`.
- If the LLM answer is structurally unrecoverable, API response has `Source: "fallback"`.

- [ ] **Step 3: Check backend logs**

Expected absence:

```text
ArrayNode method `asString()` cannot coerce value
```

Expected acceptable outcomes:

- No consultation parser error.
- Fallback response generated without HTTP 500.

## Completion Criteria

- New parser and service regression tests exist.
- Targeted backend tests pass.
- Full backend tests pass.
- `npm run test` passes.
- `npm run smoke:sggu` passes with `Source=llm`, or endpoint behavior is confirmed as HTTP 200 fallback when the model returns unrecoverable structure.
- No `JsonNode.asString()` coercion error reaches the HTTP layer.
