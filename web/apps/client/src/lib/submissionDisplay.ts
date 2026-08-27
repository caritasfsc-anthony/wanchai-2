import { buildingCriteria, environmentItems, goods, shopTypes, socialItems, type ZoneId } from "@/data/fieldwork";
import type { CSSProperties } from "react";
import type { TranslationKey, Lang } from "@/i18n/translations";

const taskForApiType = (type: string) => type === "building-scores" ? "building" : type === "socioeconomic" ? "economic" : type;

export type TFn = (key: TranslationKey) => string;
export type DisplayField = { label: string; value: string };

/* @section: submission-display-values */
function valueText(value: unknown, lang: Lang, t: TFn): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(1);
  if (typeof value === "boolean") return value ? (lang === "zh" ? "是" : "Yes") : (lang === "zh" ? "否" : "No");
  if (typeof value === "string") return value in gradeLabels ? t(value as TranslationKey) : value;
  if (Array.isArray(value)) return value.map(v => valueText(v, lang, t)).join(" / ");
  if (typeof value === "object") return Object.entries(value as Record<string, unknown>).map(([k, v]) => `${friendlyKey(k, t)}: ${valueText(v, lang, t)}`).join(lang === "zh" ? "；" : "; ");
  return String(value);
}

const gradeLabels: Partial<Record<TranslationKey, true>> = { highGrade: true, midGrade: true, lowGrade: true, severe: true, poor: true, good: true, excellent: true };

/* @section: submission-display-labels */
function friendlyKey(key: string, t: TFn): string {
  const translationKeys = new Set<string>([...buildingCriteria, ...environmentItems, ...socialItems, ...goods, ...shopTypes, "total", "average", "score", "grade", "overallGrade", "avgPrice", "affordability", "percentage", "count", "description", "buildingAvg", "shop1", "shop2", "shop3"]);
  if (translationKeys.has(key)) return t(key as TranslationKey);
  const map: Record<string, TranslationKey> = { buildings: "reviewBuildings", totals: "total", scores: "reviewEnvironment", items: "reviewSocial", prices: "reviewEconomic", averages: "average", zoneAverage: "avgPrice", index: "affordability", counts: "reviewShop" };
  return map[key] ? t(map[key]) : key.replace(/([A-Z])/g, " $1").replace(/[_-]/g, " ").replace(/^./, c => c.toUpperCase());
}

/* @section: submission-display-builder */
export function submissionFields(type: string, data: Record<string, unknown> | undefined, lang: Lang, t: TFn): DisplayField[] {
  const task = taskForApiType(type);
  const payload = data ?? {};
  const fields: DisplayField[] = [];
  const add = (label: string, value: unknown, suffix = "") => fields.push({ label, value: `${valueText(value, lang, t)}${suffix}` });

  if (task === "building") {
    const buildings = Array.isArray(payload.buildings) ? payload.buildings as Record<string, unknown>[] : [];
    buildings.forEach((building, index) => buildingCriteria.forEach(criteria => add(`${t("building")} ${index + 1} · ${t(criteria)}`, building[criteria], "/5")));
    if (Array.isArray(payload.totals)) add(t("total"), payload.totals);
    if (payload.average !== undefined) add(t("buildingAvg"), payload.average, "/35");
    return fields.length ? fields : genericFields(payload, lang, t);
  }

  if (task === "environment") {
    const scores = (payload.scores ?? {}) as Record<string, unknown>;
    environmentItems.forEach(item => add(t(item), scores[item], "/10"));
    if (payload.total !== undefined) add(t("total"), payload.total, "/60");
    if (payload.average !== undefined) add(t("average"), payload.average, "/10");
    return fields.length ? fields : genericFields(payload, lang, t);
  }

  if (task === "social-cultural") {
    const items = (payload.items ?? {}) as Record<string, { count?: unknown; description?: unknown }>;
    socialItems.forEach(item => {
      const entry = items[item] ?? {};
      add(`${t(item)} · ${t("count")}`, entry.count);
      add(`${t(item)} · ${t("description")}`, entry.description);
    });
    if (payload.total !== undefined) add(t("total"), payload.total);
    if (payload.score !== undefined) add(t("score"), payload.score, "/10");
    return fields.length ? fields.filter(f => f.value !== "—") : genericFields(payload, lang, t);
  }

  if (task === "economic") {
    const prices = (payload.prices ?? {}) as Record<string, unknown[]>;
    goods.forEach(item => (prices[item] ?? []).forEach((price, index) => add(`${t(item)} · ${t((`shop${index + 1}`) as TranslationKey)}`, price ? `$${valueText(price, lang, t)}` : "—")));
    if (Array.isArray(payload.averages)) add(t("average"), payload.averages);
    if (payload.zoneAverage !== undefined) add(t("avgPrice"), `$${valueText(payload.zoneAverage, lang, t)}`);
    if (payload.index !== undefined) add(t("affordability"), payload.index, "/10");
    return fields.length ? fields : genericFields(payload, lang, t);
  }

  if (task === "shop-tally") {
    const counts = (payload.counts ?? {}) as Record<string, unknown>;
    const total = Number(payload.total ?? 0);
    shopTypes.forEach(item => {
      const count = Number(counts[item] ?? 0);
      const percent = total ? ` · ${((count / total) * 100).toFixed(1)}%` : "";
      add(t(item), `${count}${percent}`);
    });
    if (payload.total !== undefined) add(t("total"), payload.total);
    if (payload.grade !== undefined) add(t("overallGrade"), payload.grade);
    return fields.length ? fields : genericFields(payload, lang, t);
  }

  return genericFields(payload, lang, t);
}

/* @section: generic-submission-fields */
function genericFields(data: Record<string, unknown>, lang: Lang, t: TFn): DisplayField[] {
  return Object.entries(data).map(([key, value]) => ({ label: friendlyKey(key, t), value: valueText(value, lang, t) }));
}

/* @section: zone-background-class */
export function zoneBackgroundStyle(zone: ZoneId): CSSProperties {
  return { backgroundImage: `linear-gradient(rgba(248,250,247,.38), rgba(248,250,247,.48)), url(images/zone-${zone.toLowerCase()}-background_2.png)` };
}
