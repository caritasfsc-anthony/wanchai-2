type Row = { groupNumber?: string; zone: string; type: string; data: Record<string, unknown>; submittedAt: string };
export const zoneIds = ["A", "B", "C", "D"];
export const shopKeys = ["fashionable", "chain", "traditional", "vacant"];
export function numberOrMissing(value: unknown): number | null {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") return null;
  const n = Number(value); return Number.isFinite(n) ? n : null;
}
export function buildAnalysis(rows: Row[]) {
  const latest = new Map<string, Row>();
  for (const row of rows) {
    const group = Number(row.groupNumber?.match(/\d+/)?.[0]);
    if (group < 1 || group > 8 || !Number.isInteger(group)) continue;
    const key = `${group}-${row.zone}-${row.type}`;
    if (!latest.has(key) || latest.get(key)!.submittedAt < row.submittedAt) latest.set(key, row);
  }
  return zoneIds.map(zone => {
    const data = [...latest.values()].filter(r => r.zone === zone);
    function average(type: string, field: string) {
      const numbers = data.filter(r => r.type === type).map(r => numberOrMissing(r.data[field])).filter((n): n is number => n !== null);
      return numbers.length ? numbers.reduce((a,b) => a+b,0) / numbers.length : null;
    }
    const building = average("building-scores", "average");
    const environment = average("environment", "average");
    const cultural = average("social-cultural", "score");
    const economic = average("socioeconomic", "index");
    const shops = shopKeys.map(key => {
      const numbers = data.filter(r => r.type === "shop-tally").map(r => numberOrMissing((r.data.counts as Record<string, unknown> | undefined)?.[key])).filter((n): n is number => n !== null);
      return { key, value: numbers.length ? numbers.reduce((a,b) => a+b,0) : null };
    });
    return { zone, building, environment, cultural, economic, total: environment !== null && cultural !== null && economic !== null ? environment+cultural+economic : null, shops };
  });
}
