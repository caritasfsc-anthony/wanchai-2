import { useState } from "react";
import { zones, type ZoneId } from "@/data/fieldwork";
import { useLanguage } from "@/i18n/LanguageContext";

interface Props { zoneId: ZoneId; }

export default function ZoneLeafletMap({ zoneId }: Props) {
  const { lang } = useLanguage();
  const [zoom, setZoom] = useState(1);
  const zone = zones[zoneId] ?? zones.A;
  const maxZoom = 2.5;

  return <section aria-label={lang === "zh" ? `街區${zoneId}工作紙地圖` : `Zone ${zoneId} worksheet map`}>
    {/* @section: worksheet-map-viewer */}
    <div className="relative overflow-auto rounded-xl bg-neutral-100" style={{ maxHeight: "70vh" }}>
      <img
        src={zone.worksheetMap}
        alt={lang === "zh" ? `工作紙第${23 + zoneId.charCodeAt(0) - 64}頁街區${zoneId}地圖` : `Worksheet page ${23 + zoneId.charCodeAt(0) - 64}, Zone ${zoneId} map`}
        className="block max-w-none object-contain transition-transform duration-200"
        style={{ width: `${zoom * 100}%`, minWidth: "100%" }}
      />
    </div>
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button type="button" className="secondary-btn min-h-[44px] min-w-[44px]" onClick={() => setZoom(z => Math.max(1, Number((z - .25).toFixed(2))))} aria-label={lang === "zh" ? "縮小地圖" : "Zoom map out"}>−</button>
      <span className="min-w-16 text-center text-sm font-bold">{Math.round(zoom * 100)}%</span>
      <button type="button" className="secondary-btn min-h-[44px] min-w-[44px]" onClick={() => setZoom(z => Math.min(maxZoom, Number((z + .25).toFixed(2))))} aria-label={lang === "zh" ? "放大地圖" : "Zoom map in"}>＋</button>
      <a className="primary-btn ml-auto min-h-[44px]" href={zone.worksheetMap} target="_blank" rel="noreferrer">{lang === "zh" ? "全尺寸開啟" : "Open full size"}</a>
    </div>
    <p className="mt-2 text-xs text-muted-foreground">{lang === "zh" ? "地圖取自課程工作紙 P.24–27；放大後可拖動查看街區界線及考察點。" : "Map reproduced from worksheet P.24–27. Zoom, then pan to inspect the zone boundary and fieldwork points."}</p>
  </section>;
}
