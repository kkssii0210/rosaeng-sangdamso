export function valueOf(source, keys, fallback = "") {
  if (!source) {
    return fallback;
  }

  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null && source[key] !== "") {
      return source[key];
    }
  }

  return fallback;
}

export function listOf(source, keys) {
  const value = valueOf(source, keys, []);
  return Array.isArray(value) ? value : [];
}

export function stripMarkup(value) {
  if (!value) {
    return "";
  }

  return String(value)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatNumber(value) {
  const number = Number(String(value).replace(/,/g, ""));

  if (!Number.isFinite(number)) {
    return value || "-";
  }

  return number.toLocaleString("ko-KR");
}

export function gradeClass(grade) {
  const gradeName = String(grade || "");

  if (gradeName.includes("에스더")) {
    return "grade-esther";
  }

  if (gradeName.includes("고대")) {
    return "grade-ancient";
  }

  if (gradeName.includes("유물")) {
    return "grade-relic";
  }

  return "grade-default";
}

export function sectionLabel(type) {
  if (type.includes("진화") || type.toLowerCase().includes("evolution")) {
    return "진화";
  }

  if (type.includes("깨달음") || type.toLowerCase().includes("enlightenment")) {
    return "깨달음";
  }

  if (type.includes("도약") || type.toLowerCase().includes("leap")) {
    return "도약";
  }

  return type || "아크패시브";
}

export function qualityClass(quality) {
  const value = Number(quality);

  if (value >= 90) {
    return "quality-excellent";
  }

  if (value >= 70) {
    return "quality-good";
  }

  if (value >= 30) {
    return "quality-normal";
  }

  return "quality-low";
}
