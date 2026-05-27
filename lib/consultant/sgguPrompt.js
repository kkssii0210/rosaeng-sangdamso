export const SGGU_CONSULTANT_SYSTEM_PROMPT = [
  "너는 로스트아크 성장 상담사 슥구다.",
  "한국어로 짧고 명확하게 답한다.",
  "제공된 데이터와 계산 결과만 근거로 삼는다.",
  "데이터에 없는 내용은 모르면 모른다고 말한다.",
  "가격, 효율, 전투력 상승 수치는 제공된 값만 사용한다.",
  "추천은 비용 대비 효율, 현재 장착 상태, 계산 caveat를 함께 설명한다.",
  "참고 문서가 제공되면 패치, 용어, 계산식 설명의 보조 근거로만 사용한다.",
  "참고 문서에 없는 최신 패치나 용어 설명은 모른다고 말한다.",
  "참고 문서를 사용한 답변은 끝에 짧게 근거 제목을 붙인다.",
  "답변은 2~5문장 또는 짧은 bullet로 제한한다.",
  "유저가 다음 행동을 묻는 경우 가장 먼저 할 1개 행동을 분명히 말한다."
].join("\n");

const OLLAMA_SAFE_ROLES = new Set(["user", "assistant", "system"]);
const MAX_REFERENCE_TEXT_CHARS = 900;

function isSafeConversationEntry(entry) {
  return (
    entry &&
    OLLAMA_SAFE_ROLES.has(entry.role) &&
    typeof entry.content === "string" &&
    entry.content.trim().length > 0
  );
}

function truncateReferenceText(text) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  return normalized.length > MAX_REFERENCE_TEXT_CHARS
    ? `${normalized.slice(0, MAX_REFERENCE_TEXT_CHARS - 1)}…`
    : normalized;
}

function formatReference(reference, index) {
  return [
    `${index + 1}. ${reference.title || "제목 없음"}`,
    `publishedAt: ${reference.publishedAt || ""}`,
    `category: ${reference.category || ""}`,
    `changeType: ${reference.changeType || ""}`,
    `section: ${reference.sectionTitle || ""}`,
    `sourceUrl: ${reference.sourceUrl || ""}`,
    `snippet: ${truncateReferenceText(reference.text)}`
  ].join("\n");
}

function formatReferences(references) {
  const safeReferences = Array.isArray(references)
    ? references.filter((reference) => reference && typeof reference.text === "string" && reference.text.trim())
    : [];

  if (!safeReferences.length) {
    return [];
  }

  return [
    "",
    "[참고 문서]",
    ...safeReferences.slice(0, 5).map(formatReference)
  ];
}

export function buildSgguChatMessages(options = {}) {
  const { message, conversation, context, references } = options ?? {};
  const safeConversation = Array.isArray(conversation) ? conversation.filter(isSafeConversationEntry) : [];
  const contextJson = JSON.stringify(context ?? {}, null, 2);
  const safeMessage = typeof message === "string" ? message : "";

  return [
    { role: "system", content: SGGU_CONSULTANT_SYSTEM_PROMPT },
    ...safeConversation,
    {
      role: "user",
      content: [
        "아래 캐릭터 데이터와 스펙업 후보만 근거로 답해줘.",
        "패치, 용어, 계산식 질문은 참고 문서가 있을 때만 참고 문서 근거를 사용해줘.",
        "",
        "[캐릭터 데이터]",
        contextJson,
        ...formatReferences(references),
        "",
        "[유저 질문]",
        safeMessage
      ].join("\n")
    }
  ];
}
