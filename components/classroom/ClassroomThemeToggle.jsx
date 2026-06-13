export default function ClassroomThemeToggle({ theme, onToggle }) {
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className="classroom-theme-toggle"
      aria-label="다크 모드"
      aria-pressed={isDark}
      onClick={onToggle}
    >
      <span className={isDark ? "" : "active"}>Light</span>
      <span className={isDark ? "active" : ""}>Dark</span>
    </button>
  );
}
