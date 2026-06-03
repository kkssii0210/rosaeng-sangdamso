# Sggu Intent Counselor Design

## Context

Sggu consultation currently leans toward the same spec-up recommendation shape regardless of the user's question. The backend already builds a grounded prompt from character context, calls the local LLM, parses a fixed JSON response, and falls back to deterministic copy when the LLM fails.

The next version should make Sggu feel more like a real Lost Ark counselor while staying grounded in the supplied character data. The design keeps memory limited to the current chat history and does not add long-term storage, RAG, or UI restructuring.

## Goals

- Answer the user's actual question before giving generic spec-up advice.
- Route common consultation questions into distinct behaviors.
- Reduce repeated fallback responses that only mention the first recommendation candidate.
- Keep the character voice playful, but always polite.
- Preserve existing grounding rules: do not invent prices, patch details, gains, rankings, or account state not present in the request context.

## Non-Goals

- No long-term memory beyond the request's conversation history.
- No new frontend panel or visible intent display in V1.
- No market-price lookup, live Lost Ark data expansion, or external RAG.
- No LLM-based second ranking system for spec-up candidates.

## Architecture

Add a small intent routing step before prompt construction:

```text
user message
  -> SgguIntentClassifier
  -> SgguPromptBuilder with intent
  -> local LLM
  -> SgguResponseParser
  -> intent-aware SgguFallbackComposer on failure
```

`SgguIntentClassifier` is deterministic and rule-based. It uses the current message, and optionally recent conversation text, to classify the request without making another LLM call.

`SgguConsultationService` owns the orchestration. It classifies the intent once, passes the intent into prompt building, and also passes it into fallback composition when the LLM fails or returns invalid JSON.

`SgguPromptBuilder` keeps common safety and schema rules, then adds intent-specific counseling instructions.

`SgguFallbackComposer` becomes intent-aware so fallback copy matches the user's question instead of always defaulting to the top spec-up candidate.

## Intents

V1 should support these intents:

- `GROWTH_PRIORITY`: Questions like "뭐부터 올려요?", "스펙업 순서", "우선순위".
- `CHARACTER_REVIEW`: Questions like "내 캐릭 어때요?", "문제점 봐줘", "진단해줘".
- `COMPARISON`: Questions comparing two or more options, such as "무기 vs 보석", "A랑 B 중 뭐가 나아요?".
- `INVESTMENT_RISK`: Questions about whether a purchase, upgrade, honing, or investment is safe now.
- `DATA_LIMITED`: Questions that need missing information before a useful answer can be given.
- `OFF_TOPIC`: Questions outside Lost Ark character consultation.

If multiple intents match, prefer the intent that best answers the direct question. For example, a message comparing two upgrades should be `COMPARISON` even if it also mentions spec-up priority.

## Counseling Behavior

All intents share these rules:

- Answer the user's question first.
- Use only supplied character context and spec-up recommendation context.
- State uncertainty when the context is insufficient.
- Ask at most one follow-up question when more information is needed.
- Keep the answer concise enough for chat, but include a concrete reason.
- Use polite Sggu character voice.

Intent-specific behavior:

- `GROWTH_PRIORITY`: recommend the next practical priority and explain why it is the best first move from the available candidates.
- `CHARACTER_REVIEW`: summarize visible strengths, weak points, and the most actionable next check.
- `COMPARISON`: compare the user's named options first; if the request lacks enough data, explain the missing decision factor and ask one question.
- `INVESTMENT_RISK`: warn clearly when the choice looks risky or unsupported by provided data, then suggest the safer next check.
- `DATA_LIMITED`: do not force a recommendation; ask for the single missing detail that would most improve the answer.
- `OFF_TOPIC`: politely steer back to Lost Ark character consultation.

## Sggu Voice

Sggu is playful, but uses honorific Korean. The voice rule is:

- Keep the base polite ending correct.
- Insert `슥` only when it naturally fits inside a word or stem.
- Prefer forms like `좋슥니다`, `위험하슥니다`, `확인했슥니다`, `보겠슥니다`.
- Avoid broken non-honorific forms like `좋슥다`, `무섭슥다`, `하슥다`.
- Avoid overusing Sggu wordplay in every sentence. One or two natural uses per answer is enough.

The important distinction is that Sggu style modifies words where possible, but does not replace the underlying polite grammar.

## Data Flow

The frontend continues sending the current message, recent conversation, armory context, and spec-up recommendation context as it does today. No new visible UI contract is required for V1.

The backend may keep the classified intent as an internal value for tests and logs, but the response still returns the existing parsed fields consumed by the UI, especially `DisplayText`.

Current-chat memory remains bounded by the conversation included in the request. Refreshing the page or starting a new chat does not preserve counselor memory.

## Error Handling

If the LLM call fails, returns invalid JSON, or violates the response schema, the service should use `SgguFallbackComposer` with the already classified intent.

Fallback responses should be distinct by intent:

- Growth priority fallback can use the top candidate.
- Character review fallback should summarize available character context.
- Comparison fallback should explain that direct comparison is limited and ask for the missing option detail if needed.
- Investment risk fallback should avoid approving unsupported investments.
- Data-limited fallback should ask one focused follow-up question.
- Off-topic fallback should steer back to supported Lost Ark consultation.

## Testing

Add or extend tests at these levels:

- `SgguIntentClassifierTest`: verifies representative Korean phrases classify into the expected intents.
- `SgguPromptBuilderTest`: verifies common rules and intent-specific instructions appear in prompts, including polite Sggu voice guidance.
- `SgguFallbackComposerTest` or service tests: verifies LLM failure produces intent-specific fallback text instead of repeated generic recommendation text.
- Existing parser and service tests should continue passing.

Manual smoke validation should ask at least these questions through the real consultation endpoint:

- "뭐부터 올리면 좋을까요?"
- "제 캐릭터 문제점 봐주세요."
- "무기 강화랑 보석 중 뭐가 나아요?"
- "지금 이거 사도 될까요?"
- "오늘 점심 뭐 먹을까요?"

## Completion Criteria

- Different question types no longer collapse into the same first-candidate recommendation response.
- Sggu answers the direct question first.
- Polite Sggu voice is documented in prompt and fallback paths.
- The known bad form `확인했슥습니다` is not used; the intended form is `확인했슥니다`.
- Missing information produces one natural follow-up question instead of invented facts.
- Backend tests pass.
- Existing `smoke:sggu` can still complete against the running local LLM when the development environment is available.
