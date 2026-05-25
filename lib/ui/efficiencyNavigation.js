export function normalizeCharacterName(value) {
  return String(value || "").trim();
}

export function buildEfficiencyHref(characterName) {
  const normalizedName = normalizeCharacterName(characterName);

  if (!normalizedName) {
    return "/efficiency";
  }

  return `/efficiency?character=${encodeURIComponent(normalizedName)}`;
}

export function buildAnalysisHref(characterName) {
  const normalizedName = normalizeCharacterName(characterName);

  if (!normalizedName) {
    return "/";
  }

  return `/?character=${encodeURIComponent(normalizedName)}`;
}

export function resolveAnalysisCharacterName(searchParams) {
  return normalizeCharacterName(searchParams?.get?.("character"));
}

export function resolveEfficiencyCharacterName({ searchParams, recentCharacterName } = {}) {
  const queryCharacter = normalizeCharacterName(searchParams?.get?.("character"));

  if (queryCharacter) {
    return queryCharacter;
  }

  return normalizeCharacterName(recentCharacterName);
}
