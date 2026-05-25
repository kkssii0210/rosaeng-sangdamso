const MAX_VISIBLE_MESSAGES = 12;

export function createInitialConsultMessages() {
  return [
    {
      role: "sggu",
      text: "캐릭터명을 입력해봐. 공식 API 기준으로 장비, 아크패시브, 스킬부터 정리해줄게."
    }
  ];
}

function trimMessages(messages) {
  return messages.slice(-MAX_VISIBLE_MESSAGES);
}

export function appendUserMessage(messages, text) {
  return trimMessages([...messages, { role: "user", text }]);
}

export function appendAssistantMessage(messages, text) {
  return trimMessages([...messages, { role: "sggu", text }]);
}

export function appendErrorMessage(messages, text) {
  return trimMessages([...messages, { role: "error", text }]);
}
