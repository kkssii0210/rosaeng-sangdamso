# Sggu LLM Response Normalization Design

## Goal

Prevent Sggu consultation requests from returning HTTP 500 when the local LLM returns valid JSON with minor schema drift.

The current failure path is:

```text
Ollama returns JSON
  -> one field is an array instead of a string
  -> SgguResponseParser calls JsonNode.asString()
  -> JsonNodeException escapes service fallback handling
  -> /api/consult/sggu returns 500
```

The desired behavior is:

- Keep valid LLM answers when the drift is simple and recoverable.
- Fall back to deterministic Sggu output when the structure is too far from the schema.
- Never expose parser type errors as 500 responses for consultation requests.

## Scope

This change is limited to the backend Sggu consultation parser and tests.

In scope:

- Normalize string-like scalar values from LLM JSON fields.
- Normalize simple arrays into strings.
- Reject object values and complex arrays through `InvalidSgguResponseException`.
- Preserve the existing `SgguConsultationService` fallback path.
- Add tests for recoverable and unrecoverable schema drift.

Out of scope:

- Changing the UI.
- Changing the Ollama client.
- Adding retries or a second LLM repair call.
- Letting the LLM rerank deterministic spec-up candidates.
- Broad prompt redesign beyond optional wording that reinforces string-only fields.

## Current Components

### `SgguPromptBuilder`

Requires the model to return a JSON object with these fields:

- `Mood`
- `Empathy`
- `Diagnosis`
- `Recommendation`
- `Caution`
- `NextAction`
- `DisplayText`

The prompt says JSON only, but local models can still return type drift such as an array for `Recommendation`.

### `SgguResponseParser`

Currently extracts JSON, parses it, validates required fields, and converts values with `JsonNode.asString()`.

The bug is that `asString()` can throw for non-scalar nodes. That exception type is not wrapped as `InvalidSgguResponseException`, so `SgguConsultationService` does not catch it.

### `SgguConsultationService`

Already has the right high-level policy:

```java
catch (LocalLlmException | InvalidSgguResponseException exception) {
    return fallbackComposer.compose(...);
}
```

The parser should convert all invalid LLM response shapes into `InvalidSgguResponseException` so this policy works.

## Normalization Rules

Add a parser helper, conceptually named `coerceText(JsonNode value, String fieldName)`.

It should return a normalized string for:

- missing/null values: `""`
- strings: trimmed text
- numbers: JSON number text
- booleans: `"true"` or `"false"`
- simple arrays: join scalar items into one string

It should reject:

- objects
- arrays containing objects
- nested arrays
- values that cannot be represented as concise field text

Rejected values throw `InvalidSgguResponseException` with the field name in the message.

Simple array joining should produce readable Korean text. A conservative separator is a single space after each item is individually normalized, because `clamp()` already collapses whitespace.

Example:

```json
{
  "Recommendation": ["무기 11->12부터 확인하자.", "구매 전 가격을 다시 보자."]
}
```

becomes:

```text
무기 11->12부터 확인하자. 구매 전 가격을 다시 보자.
```

## Required Field Validation

Keep the existing required fields:

- `Mood`
- `Diagnosis`
- `Recommendation`
- `NextAction`
- `DisplayText`

Validation should run after normalization.

If a required field is missing, null, empty, or normalizes to blank, throw `InvalidSgguResponseException`.

Optional fields remain optional:

- `Empathy`
- `Caution`

If optional fields are missing or null, return an empty string.

## Error Handling

`SgguResponseParser` should be the boundary that translates bad LLM output into parser-domain errors.

Parser behavior:

- Malformed JSON: `InvalidSgguResponseException`
- Missing required field: `InvalidSgguResponseException`
- Unsupported field type: `InvalidSgguResponseException`
- Recoverable scalar/array drift: normalized string

Service behavior remains unchanged:

- `InvalidSgguResponseException` returns deterministic fallback.
- Valid normalized response can continue to grounding validation.
- If grounding validation fails, deterministic fallback is returned.

This keeps the user-facing behavior stable: schema drift becomes either a valid Sggu answer or a fallback Sggu answer, not a 500.

## Testing

Add focused backend tests.

### Parser Tests

Add cases to `SgguResponseParserTest`:

- Parses a response where `Recommendation` or `DisplayText` is a simple array of strings.
- Parses scalar non-string values if present in optional fields.
- Rejects an object field with `InvalidSgguResponseException`.
- Rejects a nested array or array containing an object.

### Service Tests

Add cases to `SgguConsultationServiceTest`:

- When LLM returns an object for a required text field, service returns `Source=fallback`.
- When LLM returns a simple array for a required text field, service can return `Source=llm`.

### Smoke Test

After implementation:

```bash
npm run test
npm run smoke:sggu
```

The smoke test should pass with:

```text
Sggu consult smoke OK
Source: llm
```

If the model returns an unrecoverable structure, the endpoint should still avoid 500; the smoke test may fail only if it specifically requires `Source=llm`.

## Acceptance Criteria

- Consultation requests do not return 500 because of `JsonNode.asString()` coercion failures.
- Simple array fields from Ollama are preserved as readable text.
- Complex structures fall back through the existing fallback composer.
- Required field validation still prevents empty or unusable LLM answers.
- Existing grounding rules for `efficiency-summary` remain unchanged.
- Tests cover both normalization and fallback behavior.
