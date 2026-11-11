"use client";
// Maya's safety dashboard, built on AG Studio: KPI tiles, charts and a grid over
// every payment Rose has made, refreshed live from the household.
import { useMemo, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { studioTheme, type AgDataSourcesDefinition, type AgPageState, type AgReportState, type AgWidgetLayoutState } from "ag-studio";
import { AgStudio, AgStudioProvider } from "ag-studio-react";
import type { Payment, Status } from "@/lib/store.ts";
import { LESSONS, STATUS_WORDS, useHousehold } from "../../client.ts";

const PROTECTED: Status[] = ["blocked", "cancelled", "expired"];
const SENT: Status[] = ["sent", "delivered"];
const WAITING: Status[] = ["checking", "asking", "held", "releasing"];

const outcomeOf = (s: Status) =>
  PROTECTED.includes(s) ? "Stopped — money kept" : SENT.includes(s) ? "Sent" : WAITING.includes(s) ? "Waiting for Maya" : "Didn't go through";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const scamLabel = (p: Payment) => {
  const t = p.verdict?.scamType;
  if (!p.verdict) return "Not checked yet";
  if (!t || t === "none" || t === "other") return p.verdict.risk === "low" ? "No warning signs" : "Unusual payment";
  return cap(LESSONS[t]?.name.replace(/^(the|a|an) /, "") ?? t.replace(/_/g, " "));
};

function rows(payments: Payment[]) {
  return payments.map((p) => {
    const amount = Number(p.amount);
    const stopped = PROTECTED.includes(p.status);
    return {
      id: p.id,
      date: new Date(p.createdAt).toISOString().slice(0, 10),
      to: p.to.name,
      wallet: p.to.wallet === "VENMO" ? "Venmo" : "PayPal",
      newPerson: p.to.known ? "Known" : "New person",
      amount,
      status: STATUS_WORDS[p.status],
      outcome: outcomeOf(p.status),
      risk: cap(p.verdict?.risk ?? "pending"),
      scamType: scamLabel(p),
      decidedBy: p.decidedBy ?? "—",
      protectedAmount: stopped ? amount : 0,
      sentAmount: SENT.includes(p.status) ? amount : 0,
      stoppedCount: stopped ? 1 : 0,
      waitingCount: p.status === "held" ? 1 : 0,
      flaggedAmount: p.verdict && p.verdict.risk !== "low" ? amount : 0,
    };
  });
}

function dataSources(payments: Payment[]): AgDataSourcesDefinition {
  const data = rows(payments);
  const dates = data.map((r) => r.date).sort();
  const today = new Date().toISOString().slice(0, 10);
  const f = (id: string, name: string, format: "textFormat" | "currencyFormat" | "integerFormat" | "dateFormat", hide?: boolean) => ({ id, name, format, ...(hide && { hide }) });
  return {
    description: "Payments an older adult (Rose) made through Hold On. Risky ones were held on her PayPal until her daughter Maya released or blocked them.",
    sources: [
      {
        id: "payments",
        description: "One row per payment Rose started.",
        data,
        fields: [
          f("id", "Payment ID", "textFormat", true),
          f("date", "Date", "dateFormat"),
          f("to", "To", "textFormat"),
          f("wallet", "Paid with", "textFormat"),
          f("newPerson", "Recipient", "textFormat"),
          f("amount", "Amount ($)", "currencyFormat"),
          f("status", "Status", "textFormat"),
          f("outcome", "Outcome", "textFormat"),
          f("risk", "Risk", "textFormat"),
          f("scamType", "Scam type", "textFormat"),
          f("decidedBy", "Decided by", "textFormat"),
          f("protectedAmount", "Money protected ($)", "currencyFormat"),
          f("sentAmount", "Money sent ($)", "currencyFormat"),
          f("stoppedCount", "Scams stopped", "integerFormat"),
          f("waitingCount", "Waiting for Maya", "integerFormat"),
          f("flaggedAmount", "Flagged amount ($)", "currencyFormat"),
        ],
      },
    ],
    relationships: [{ id: "payments-date-calendar", source: { tableId: "payments", fieldId: "date" }, target: { calendarId: "calendar" } }],
    calendars: [
      {
        id: "calendar",
        label: "Calendar",
        range: { from: { type: "date", value: dates[0] ?? today }, to: { type: "date", value: dates.at(-1) ?? today } },
        fragments: ["year", "month", "week", "day"],
      },
    ],
  };
}

const at = (xTrack: number, yTrack: number, xSpan: number, ySpan: number): AgWidgetLayoutState => ({ xTrack, yTrack, xSpan, ySpan });
const sum = (id: string) => ({ id, aggregation: "sum" as const });
const title = (text: string) => ({ title: { enabled: true, text } });
const kpi = (text: string, id: string) => ({ type: "value" as const, dataMapping: { value: [sum(id)] }, format: title(text) });

const safety: AgPageState = {
  id: "safety",
  widgets: {
    "kpi-protected": kpi("Money protected ($)", "payments.protectedAmount"),
    "kpi-stopped": kpi("Scams stopped", "payments.stoppedCount"),
    "kpi-waiting": kpi("Waiting for Maya", "payments.waitingCount"),
    "kpi-sent": kpi("Sent safely ($)", "payments.sentAmount"),
    outcomes: {
      type: "donut-chart",
      dataMapping: { categoryKey: [{ id: "payments.outcome" }], valueKey: [sum("payments.amount")] },
      format: title("Where Rose's money went ($)"),
    },
    "scam-types": {
      type: "bar-chart-grouped",
      dataMapping: { categoryKey: [{ id: "payments.scamType" }], valueKey: [sum("payments.flaggedAmount")] },
      format: title("Flagged money by scam type ($)"),
    },
    payments: {
      type: "grid",
      dataMapping: {
        cols: [
          { id: "payments.date" },
          { id: "payments.to" },
          { id: "payments.newPerson" },
          sum("payments.amount"),
          { id: "payments.outcome" },
          { id: "payments.risk" },
          { id: "payments.scamType" },
          { id: "payments.decidedBy" },
        ],
      },
      format: title("Every payment"),
    },
  },
  widgetLayout: {
    "kpi-protected": at(0, 0, 6, 7),
    "kpi-stopped": at(6, 0, 6, 7),
    "kpi-waiting": at(12, 0, 6, 7),
    "kpi-sent": at(18, 0, 6, 7),
    outcomes: at(0, 7, 10, 18),
    "scam-types": at(10, 7, 14, 18),
    payments: at(0, 25, 24, 22),
  },
};

const report: AgReportState = { selectedPageId: safety.id, pages: [safety], panels: { filters: { collapsed: true } } };

// Studio reads the same design tokens as the rest of the app, so it follows light/dark mode.
const v = (name: string) => `var(--${name})`;
const theme = studioTheme.withParams({
  fontFamily: v("font-atkinson"),
  fontSize: 15,
  textColor: v("ink"),
  foregroundColor: v("ink"),
  subtleTextColor: v("muted"),
  backgroundColor: v("surface"),
  borderColor: v("line"),
  accentColor: v("brand"),
  studioWrapperBorder: false,
  studioWrapperBackgroundColor: v("bg"),
  studioCanvasBorder: false,
  studioCanvasShadow: false,
  studioCanvasBackgroundColor: v("bg"),
  studioWidgetBackgroundColor: v("surface"),
  studioWidgetBorderRadius: 16,
  studioWidgetTitleTextColor: v("ink"),
  studioWidgetTitleFontSize: 17,
  chartTextColor: v("ink"),
  chartSubtleTextColor: v("muted"),
  chartPaletteFills1Color: v("safe"),
  chartPaletteStrokes1Color: v("safe"),
  chartPaletteFills2Color: v("brand"),
  chartPaletteStrokes2Color: v("brand"),
  chartPaletteFills3Color: v("warn"),
  chartPaletteStrokes3Color: v("warn"),
  chartPaletteFills4Color: v("danger"),
  chartPaletteStrokes4Color: v("danger"),
});

const noSubscription = () => () => {};

export default function SafetyDashboard({ licenseKey }: { licenseKey?: string }) {
  const h = useSearchParams().get("h") ?? "rose-demo";
  const { data } = useHousehold(h);
  const inBrowser = useSyncExternalStore(noSubscription, () => true, () => false);
  // Rebuild Studio's data only when payments actually change, not on every poll.
  const key = data ? data.payments.map((p) => `${p.id}:${p.status}`).join("|") : "";
  const sources = useMemo(() => (data ? dataSources(data.payments) : null), [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="flex h-dvh flex-col">
      <header className="flex flex-wrap items-end justify-between gap-3 px-5 pt-5 pb-2">
        <div>
          <p className="text-base font-bold text-brand">Hold On · for {data?.maya.name ?? "Maya"}</p>
          <h1 className="text-3xl font-bold">{data?.rose.name ?? "Rose"}&apos;s safety dashboard</h1>
        </div>
        <a className="btn btn-secondary" href={`/maya?h=${h}`}>
          Back to alerts
        </a>
      </header>
      <div className="min-h-0 flex-1">
        {inBrowser && sources ? (
          <AgStudioProvider licenseKey={licenseKey}>
            <AgStudio style={{ height: "100%", width: "100%" }} theme={theme} layout={{ widgetBorderEnabled: true }} data={sources} initialState={report} mode="view" />
          </AgStudioProvider>
        ) : (
          <p className="p-5" role="status">
            Loading…
          </p>
        )}
      </div>
    </main>
  );
}
