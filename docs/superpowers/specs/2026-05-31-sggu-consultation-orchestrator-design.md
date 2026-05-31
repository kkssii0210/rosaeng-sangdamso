# Sggu Consultation Orchestrator Design

## Goal

V1 adds a consultation orchestration layer that makes Sggu feel like a living counselor without letting the LLM change deterministic Lost Ark recommendations.

The product goal is not "attach a chatbot." The goal is:

- Show calculation results quickly.
- Keep Sggu present as part of the experience.
- Let the local LLM shape the explanation into a warm but firm counseling flow.
- Preserve trust by grounding all recommendation order, prices, gains, and caveats in backend facts.

## Scope

V1 applies to both main consultation chat and the combat-power efficiency page.

- `main-chat`: user asks a question after loading a character. The UI shows a natural Sggu message.
- `efficiency-summary`: the efficiency page shows calculation results first, then fills a Sggu consultation card when the LLM response arrives.

The default tone is mixed:

- Warm and conversational for ordinary guidance.
- Firm when the user is about to make an inefficient or risky choice.

## Non-Goals

V1 deliberately excludes the following:

- RAG over patch notes, formulas, or glossary documents.
- Python retrieval sidecar.
- Long-term user memory such as budget, goals, or historical preferences.
- LLM reranking of spec-up candidates.
- LLM-generated prices, combat-power gains, recovery values, or efficiency scores.

RAG remains a V2 extension point. It should support background knowledge such as patch notes, terminology, and formula explanations, not character-specific recommendation ranking.

## Product Behavior

Sggu consultation is not optional in the product experience. The page may render consultation content later than calculation content, but the Sggu area is always present.

For the efficiency page:

1. While calculation is running, show the Sggu state text: `슥구가 생각중이다.`
2. When calculation results are ready, render the numeric results and recommendation candidates immediately.
3. Keep the Sggu consultation area visible in a loading state while the LLM summary is being generated.
4. When the LLM result arrives, render the structured consultation card.
5. If the LLM fails or returns invalid output, render a backend-composed fallback consultation based on the calculation facts.

This keeps the page fast without making Sggu feel like an optional add-on.

## Architecture

Current path:

```text
ConsultantController
  -> SgguPromptBuilder
  -> OllamaLocalLlmClient
```

V1 path:

```text
Controller
  -> SgguConsultationService
      -> SgguContextBuilder
      -> SgguPromptBuilder
      -> LocalLlmClient
      -> SgguResponseParser
      -> SgguFallbackComposer
  -> ConsultationResponse
```

`SgguConsultationService` becomes the orchestration boundary. Controllers validate HTTP input and return DTOs; the service owns prompt construction, LLM invocation, response parsing, validation, and fallback behavior.

## Components

### `SgguConsultationService`

Coordinates one consultation request.

Inputs:

- `mode`
- user message
- normalized conversation
- compact character/spec-up context

Responsibilities:

- Select mode-specific instructions.
- Build facts for the prompt.
- Call the local LLM.
- Parse structured output.
- Validate output against facts.
- Return a validated `ConsultationResponse`.
- Return fallback output when LLM work fails.

### `SgguPromptBuilder`

Extends the existing prompt builder.

Responsibilities:

- Emit mode-specific system instructions.
- Require JSON output matching the consultation schema.
- Enforce the counselor rhythm: empathy, diagnosis, recommendation, caution, next action.
- Forbid changing recommendation order.
- Forbid making up prices, combat-power gains, recovery values, or efficiency scores.
- Keep responses concise enough for the target UI.

### `SgguResponseParser`

Parses and validates LLM output.

Responsibilities:

- Accept raw JSON.
- Recover JSON wrapped in Markdown code blocks.
- Reject malformed JSON.
- Reject missing required fields.
- Clamp or reject overlong text.
- Detect unsupported candidate names or numbers when practical.

### `SgguFallbackComposer`

Creates deterministic Sggu-style output without LLM.

Responsibilities:

- Use top candidate facts when available.
- Produce the same schema as the LLM response.
- Keep wording simple but still counselor-like.
- Avoid empty Sggu states when Ollama is unavailable.

### `SgguContextBuilder`

Keeps compact context building responsibilities.

V1 should make efficiency-related facts more explicit, including:

- top candidates
- cost and gain
- caveats
- market updated time
- accessory search summary when relevant
- recovery or fee information when present

## Consultation Modes

### `main-chat`

Used by `POST /api/consult/sggu`.

Output behavior:

- UI primarily displays `displayText`.
- The answer should feel like a normal chat response.
- The response may include a short next-action nudge.

### `efficiency-summary`

Used after `GET /api/efficiency/spec-up/{name}` has returned calculation facts.

Output behavior:

- UI renders a card with diagnosis, recommendation, caution, and next action.
- Calculation results are already visible before this response arrives.
- The consultation card updates asynchronously when LLM output succeeds.

## Response Schema

The service returns a validated response shaped like:

```json
{
  "Mode": "efficiency-summary",
  "Source": "llm",
  "Mood": "warm-but-firm",
  "Empathy": "지금 후보가 많아서 헷갈릴 수 있어.",
  "Diagnosis": "현재는 악세보다 보석 효율이 더 안정적이야.",
  "Recommendation": "1순위는 7겁 보석 교체로 잡자.",
  "Caution": "이 악세는 회수값 변동이 커서 바로 사면 위험해.",
  "NextAction": "먼저 보석 후보 가격을 한 번 더 확인해줘.",
  "DisplayText": "지금은 보석부터 보는 게 좋아. 악세는 회수값 변동이 커서 바로 사기엔 위험해."
}
```

`Source` values:

- `llm`: local LLM generated and validation passed.
- `fallback`: deterministic fallback composer generated the response.

Required fields:

- `Mode`
- `Source`
- `Mood`
- `Diagnosis`
- `Recommendation`
- `NextAction`
- `DisplayText`

Optional-but-preferred fields:

- `Empathy`
- `Caution`

## API Flow

### Main Chat

```text
POST /api/consult/sggu
  body:
    mode: "main-chat"
    message
    conversation
    context

  response:
    ConsultationResponse
```

The existing browser path remains the same. The controller passes the request to `SgguConsultationService`.

### Efficiency Page

```text
GET /api/efficiency/spec-up/{name}
  -> returns deterministic calculation results only

Frontend:
  -> shows calculation results
  -> keeps Sggu area visible
  -> calls POST /api/consult/sggu with mode: "efficiency-summary"
  -> replaces loading state with ConsultationResponse
```

The separate consultation request is for latency isolation, not feature optionality.

## UI States

Efficiency page states:

- `calculation-loading`: show `슥구가 생각중이다.`
- `calculation-ready`: show calculation results and keep Sggu consultation loading.
- `consultation-ready`: show structured LLM consultation card.
- `consultation-fallback`: show deterministic fallback consultation card.
- `consultation-error`: only used if both LLM and fallback fail; this should be rare.

The Sggu consultation area should not disappear after entering the efficiency page.

## Error Handling

LLM failures must not block calculation results.

Rules:

- Ollama unavailable: return fallback consultation when facts are available.
- LLM request timeout: return fallback consultation.
- Malformed JSON: try JSON extraction from code block; otherwise fallback.
- Required fields missing: fallback.
- Unsupported candidate names or unsupported numeric claims: fallback or remove unsafe field.
- Empty context or missing character profile: keep current bad-request behavior for main chat.

## Caching

V1 can add a short-lived consultation cache to reduce repeated local LLM calls.

Suggested cache key:

```text
mode + characterName + factsHash + normalizedMessage
```

For `efficiency-summary`, the message can be a fixed synthetic message such as `전투력 효율 결과를 상담 카드로 요약해줘`.

The cache stores validated `ConsultationResponse` only. It should not store malformed raw LLM output.

## Testing

Backend tests:

- `SgguPromptBuilderTest`: mode-specific prompt includes schema, counseling rhythm, and no-rerank rules.
- `SgguResponseParserTest`: parses raw JSON, parses code-block JSON, rejects malformed JSON, rejects missing required fields.
- `SgguFallbackComposerTest`: creates valid response from top candidate facts.
- `SgguConsultationServiceTest`: handles LLM success, unavailable LLM, malformed response, and fallback.
- `ConsultantControllerTest`: preserves `/api/consult/sggu` validation and returns the new response contract.

Frontend tests:

- Main chat displays `DisplayText`.
- Efficiency page shows `슥구가 생각중이다.` while calculation is loading.
- Efficiency page renders calculation results before consultation is ready.
- Efficiency page renders consultation card on success.
- Efficiency page keeps fallback consultation when LLM fails.

Smoke test:

- Extend `npm run smoke:sggu` to confirm local Ollama returns a valid structured consultation response.

## Future V2: Python RAG Sidecar

V2 can add a Python RAG sidecar:

```text
Spring SgguConsultationService
  -> deterministic facts from Spring
  -> optional references from Python RAG /retrieve
  -> local LLM
```

RAG should provide background references only:

- patch notes
- glossary
- formula notes
- class or option explanations

It must not override deterministic character facts, market prices, or recommendation order.
