export default function TodayChalkboard({ state, isLoading, onFocusInput }) {
  return (
    <section className={`classroom-chalkboard ${state.variant}`} aria-labelledby="today-chalkboard-title">
      <div className="classroom-chalk-dust" aria-hidden="true" />
      <div className="classroom-chalkboard-content">
        <p className="classroom-board-kicker">{state.kicker}</p>
        <h1 id="today-chalkboard-title">{state.title}</h1>
        <p className="classroom-board-description">{state.description}</p>

        <div className="classroom-board-notes" aria-label="칠판 판서">
          {state.notes.map((note) => (
            <article className="classroom-board-note" key={`${note.title}-${note.value}`}>
              <span>{note.title}</span>
              <strong>{isLoading ? " " : note.value}</strong>
            </article>
          ))}
        </div>

        {state.caution ? <p className="classroom-board-caution">{state.caution}</p> : null}

        <div className="classroom-board-actions">
          <button type="button" className="classroom-board-primary" onClick={onFocusInput} disabled={isLoading}>
            {state.primaryActionLabel}
          </button>
          {state.secondaryActionLabel ? (
            <button type="button" className="classroom-board-secondary" onClick={onFocusInput}>
              {state.secondaryActionLabel}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
