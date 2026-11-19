import { useTranslation } from "react-i18next";
import { ui } from "../i18n/config";
import type { Injury, PainContext, PainLog, RehabSite } from "../domain";
import { median } from "./metrics";

export function AreaAnalysisView({
  sites,
  injuries,
  logs,
  contexts,
  injuryId,
  onTimeline,
}: {
  sites: RehabSite[];
  injuries: Injury[];
  logs: PainLog[];
  contexts: PainContext[];
  injuryId: string;
  onTimeline: (siteId: string) => void;
}) {
  useTranslation();
  const labels = new Map(
    contexts.map((context) => [context.value, context.label]),
  );
  return (
    <section className="panel">
      <h2>{ui("Obszary i epizody kontuzji")}</h2>
      {sites.map((site) => {
        const reports = logs.filter((log) =>
          log.values.some((value) => value.siteId === site.id),
        );
        const groups = new Map<string, number[]>();
        for (const report of reports) {
          const values = groups.get(report.context) ?? [];
          values.push(
            report.values.find((value) => value.siteId === site.id)!.value,
          );
          groups.set(report.context, values);
        }
        return (
          <article key={site.id}>
            <h3>
              {site.name} · {site.bodyArea}
            </h3>
            <p>
              {site.archived
                ? "Archiwalny"
                : site.active
                  ? "Monitorowany"
                  : ui("Monitorowanie wstrzymane")}{" "}
              · {reports.length}  {ui("pomiarów w")}{" "}
              {new Set(reports.map((log) => log.date)).size} {ui("dniach")}</p>
            {injuries
              .filter(
                (injury) =>
                  (!injuryId || injury.id === injuryId) &&
                  injury.siteIds.includes(site.id),
              )
              .map((injury) => (
                <p key={injury.id}>
                  {injury.name} ·{" "}
                  {injury.status === "resolved"
                    ? ui("Zakończona przez użytkownika")
                    : injury.status === "paused"
                      ? ui("Wstrzymana")
                      : ui("Aktywna")}{" "}
                   {ui("· od")} {injury.startedOn}
                  {injury.resolvedOn ? ` do ${injury.resolvedOn}` : ""}
                </p>
              ))}
            {groups.size > 0 && (
              <details>
                <summary>{ui("Rozkład ocen według kontekstu")}</summary>
                <ul>
                  {[...groups].map(([context, values]) => (
                    <li key={context}>
                      {labels.get(context) ?? (context || "Bez kontekstu")}{ui(": mediana surowych ocen")} {median(values)}{ui("/10 · zakres")}{" "}
                      {Math.min(...values)}–{Math.max(...values)} ·{" "}
                      {values.length}  {ui("pomiarów")} </li>
                  ))}
                </ul>
              </details>
            )}
            <button
              type="button"
              className="secondary"
              onClick={() => onTimeline(site.id)}
            >
               {ui("Zobacz historię obszaru")} </button>
          </article>
        );
      })}
      <p>
         {ui("Status kontuzji jest deklaracją użytkownika; nie jest wyliczoną oceną wyleczenia. Konteksty przedstawiamy osobno.")} </p>
    </section>
  );
}
