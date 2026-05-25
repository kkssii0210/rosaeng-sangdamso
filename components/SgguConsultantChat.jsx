export default function SgguConsultantChat({
  messages,
  input,
  onInputChange,
  onSubmit,
  isLoading,
  isConsulting,
  hasArmory
}) {
  const buttonLabel = isLoading
    ? "조회중"
    : isConsulting
      ? "상담중"
      : hasArmory
        ? "상담"
        : "조회";

  return (
    <div className="speech-bubble">
      <span className="bubble-puff puff-one" aria-hidden="true" />
      <span className="bubble-puff puff-two" aria-hidden="true" />
      <span className="bubble-puff puff-three" aria-hidden="true" />
      <span className="bubble-puff puff-four" aria-hidden="true" />
      <div className="bubble-kicker" aria-hidden="true">
        <span className="bubble-kicker-dot" />
        슥구 상담소
      </div>
      <div className="message-log consultant-message-log" aria-live="polite">
        {messages.map((message, index) => (
          <div className={`message ${message.role}`} key={`${message.role}-${index}-${message.text}`}>
            {message.text}
          </div>
        ))}
      </div>

      <form className="chat-form" onSubmit={onSubmit}>
        <label className="sr-only" htmlFor="consult-input">
          {hasArmory ? "슥구에게 질문 입력" : "조회할 로스트아크 캐릭터명 입력"}
        </label>
        <input
          id="consult-input"
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          placeholder={hasArmory ? "슥구에게 물어봐" : "캐릭터명을 입력해줘"}
          autoComplete="off"
        />
        <button type="submit" disabled={isLoading || isConsulting}>
          {buttonLabel}
        </button>
      </form>
    </div>
  );
}
