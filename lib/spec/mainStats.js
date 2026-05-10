function valueOf(source, keys, fallback = "") {
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

function listOf(source, keys) {
  const value = valueOf(source, keys, []);

  return Array.isArray(value) ? value : [];
}

export function buildMainStatSummary(equipment) {
  const items = listOf({ equipment }, ["equipment"])
    .map((item, index) => {
      const value = Number(valueOf(item, ["MainStatValue", "mainStatValue"], 0));

      if (!Number.isFinite(value) || value <= 0) {
        return null;
      }

      return {
        Index: index,
        Type: valueOf(item, ["Type", "type"], ""),
        Name: valueOf(item, ["Name", "name"], ""),
        Value: value
      };
    })
    .filter(Boolean);

  return {
    Items: items,
    MainStatTotal: items.reduce((total, item) => total + item.Value, 0)
  };
}
