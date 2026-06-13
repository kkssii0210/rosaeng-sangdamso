export const CLASSROOM_THEME_STORAGE_KEY = "sggu:classroom-theme";
export const CLASSROOM_THEMES = ["light", "dark"];

export function normalizeClassroomTheme(value) {
  return CLASSROOM_THEMES.includes(value) ? value : "light";
}

export function readStoredClassroomTheme(storage) {
  if (!storage || typeof storage.getItem !== "function") {
    return "light";
  }

  try {
    return normalizeClassroomTheme(storage.getItem(CLASSROOM_THEME_STORAGE_KEY));
  } catch {
    return "light";
  }
}

export function writeStoredClassroomTheme(storage, theme) {
  const normalizedTheme = normalizeClassroomTheme(theme);

  try {
    if (storage && typeof storage.setItem === "function") {
      storage.setItem(CLASSROOM_THEME_STORAGE_KEY, normalizedTheme);
    }
  } catch {
    return normalizedTheme;
  }

  return normalizedTheme;
}

export function nextClassroomTheme(theme) {
  return normalizeClassroomTheme(theme) === "dark" ? "light" : "dark";
}

export function themeClassName(theme) {
  return `classroom-theme-${normalizeClassroomTheme(theme)}`;
}
