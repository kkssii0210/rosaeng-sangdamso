export default function ClassroomThemeToggle({ theme, onToggle }) {
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className="classroom-theme-toggle"
      aria-label={isDark ? "라이트 모드로 전환" : "다크 모드로 전환"}
      aria-pressed={isDark}
      onClick={onToggle}
    >
      <span className={isDark ? "" : "active"}>Light</span>
      <span className={isDark ? "active" : ""}>Dark</span>
    </button>
  );
}
