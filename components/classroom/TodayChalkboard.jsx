import { buildTodayChalkboardState } from "../../lib/ui/todayChalkboard.js";

const DEFAULT_CHALKBOARD_STATE = buildTodayChalkboardState();

function normalizeChalkboardState(state) {
  if (!state || typeof state !== "object") {
    return DEFAULT_CHALKBOARD_STATE;
  }

  const mergedState = {
    ...DEFAULT_CHALKBOARD_STATE,
    ...state
  };

  return {
    ...mergedState,
    variant: typeof mergedState.variant === "string" && mergedState.variant
      ? mergedState.variant
      : DEFAULT_CHALKBOARD_STATE.variant,
    notes: Array.isArray(state.notes) ? state.notes : DEFAULT_CHALKBOARD_STATE.notes
  };
}

export default function TodayChalkboard({ state, isLoading, onFocusInput }) {
  const normalizedState = normalizeChalkboardState(state);

  return (
    <section
      className={`classroom-chalkboard ${normalizedState.variant}`}
      aria-labelledby="today-chalkboard-title"
      aria-busy={isLoading}
    >
      <div className="classroom-chalk-dust" aria-hidden="true" />
      <div className="classroom-chalkboard-content">
        <p className="classroom-board-kicker">{normalizedState.kicker}</p>
        <h1 id="today-chalkboard-title">{normalizedState.title}</h1>
        <p className="classroom-board-description">{normalizedState.description}</p>

        <div className="classroom-board-notes" aria-label="칠판 판서">
          {normalizedState.notes.map((note, index) => (
            <article className="classroom-board-note" key={`${note?.title}-${note?.value}-${index}`}>
              <span>{note?.title}</span>
              <strong>{isLoading ? " " : note?.value}</strong>
            </article>
          ))}
        </div>

        {normalizedState.caution ? <p className="classroom-board-caution">{normalizedState.caution}</p> : null}

        <div className="classroom-board-actions">
          <button type="button" className="classroom-board-primary" onClick={onFocusInput} disabled={isLoading}>
            {normalizedState.primaryActionLabel}
          </button>
          {normalizedState.secondaryActionLabel ? (
            <button type="button" className="classroom-board-secondary" onClick={onFocusInput}>
              {normalizedState.secondaryActionLabel}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
