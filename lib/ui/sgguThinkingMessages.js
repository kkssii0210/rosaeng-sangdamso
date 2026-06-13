export const sgguThinkingMessages = ["슥...", "귀찮은놈...", "빨리 좀 가라..."];

export function pickSgguThinkingMessage(random = Math.random) {
  const index = Math.floor(random() * sgguThinkingMessages.length);

  return sgguThinkingMessages[index] || sgguThinkingMessages[0];
}