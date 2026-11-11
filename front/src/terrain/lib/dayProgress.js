const NAMES = ["receive", "prepare", "inventory", "lots", "alerts"];

export function fillTemplate(template, values) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""));
}

export function splitToken(template, key) {
  const [before, after = ""] = String(template).split(`{${key}}`);
  return { before, after };
}

export function dayProgress(missions) {
  const tracked = NAMES.map((name) => missions?.[name]).filter((query) => query?.allowed);
  const done = tracked.filter((query) => query.isSuccess && Number(query.data?.count) === 0).length;
  const total = tracked.length;
  return {
    done,
    total,
    loading: tracked.some((query) => query.isLoading),
    ratio: total > 0 ? done / total : 0,
  };
}
