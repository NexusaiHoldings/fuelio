/**
 * /dashboard/history — Full Energy Availability history page.
 *
 * Server component. Shows 30-day rolling EA history with:
 *   - Daily EA scores tabulated
 *   - LEA / optimal / sub-optimal color coding
 *   - Intake vs expenditure breakdown per day
 *   - Consecutive LEA streak indicators
 */

import { getEAHistory } from "@/lib/fueling/energy-availability";
import type { DailyEARecord, EAResult } from "@/lib/fueling/energy-availability";
import { LEA_THRESHOLD_KCAL_PER_KG, OPTIMAL_EA_KCAL_PER_KG } from "@/lib/fueling/energy-availability";

const ROW_COLORS: Record<string, { bg: string; text: string; badge: string }> = {
  critical: { bg: "#2d1515", text: "#fca5a5", badge: "#ef4444" },
  warning: { bg: "#2d2000", text: "#fde68a", badge: "#f59e0b" },
  ok: { bg: "#0f2d1a", text: "#86efac", badge: "#22c55e" },
};

function rowStyle(record: DailyEARecord): { bg: string; text: string; badge: string } {
  if (record.isLEA) return ROW_COLORS.critical;
  if (record.isOptimal) return ROW_COLORS.ok;
  return ROW_COLORS.warning;
}

interface SummaryStatsProps {
  readonly history: EAResult;
  readonly days: number;
}

function SummaryStats({ history, days }: SummaryStatsProps): JSX.Element {
  const records = history.rolling7Day;
  const leaCount = records.filter((r) => r.isLEA).length;
  const optimalCount = records.filter((r) => r.isOptimal).length;
  const leaPercent = records.length > 0 ? Math.round((leaCount / records.length) * 100) : 0;
  const optimalPercent = records.length > 0 ? Math.round((optimalCount / records.length) * 100) : 0;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 12,
        marginBottom: 28,
      }}
      role="region"
      aria-label="Summary statistics"
    >
      {[
        { label: `${days}-day avg EA`, value: `${history.averageEA7Day.toFixed(1)}`, unit: "kcal/kg/day" },
        { label: "LEA days", value: `${leaCount}`, unit: `${leaPercent}% of period` },
        { label: "Optimal days", value: `${optimalCount}`, unit: `${optimalPercent}% of period` },
        { label: "Current LEA streak", value: `${history.consecutiveLEADays}`, unit: "consecutive days" },
      ].map(({ label, value, unit }) => (
        <div
          key={label}
          style={{
            padding: "14px 16px",
            borderRadius: 10,
            backgroundColor: "#1a1a2e",
            border: "1px solid #374151",
          }}
        >
          <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>{label}</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#f9fafb", lineHeight: 1 }}>{value}</div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{unit}</div>
        </div>
      ))}
    </div>
  );
}

interface HistoryTableProps {
  readonly records: readonly DailyEARecord[];
}

function HistoryTable({ records }: HistoryTableProps): JSX.Element {
  if (records.length === 0) {
    return (
      <p style={{ fontSize: 14, color: "#6b7280", textAlign: "center", padding: "40px 0" }}>
        No history data available. Start logging meals and workouts to see your EA scores.
      </p>
    );
  }

  return (
    <div
      role="table"
      aria-label="Energy Availability history"
      style={{ width: "100%" }}
    >
      <div
        role="row"
        style={{
          display: "grid",
          gridTemplateColumns: "100px 1fr 100px 100px 80px 80px",
          gap: 8,
          padding: "8px 12px",
          fontSize: 11,
          color: "#6b7280",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          borderBottom: "1px solid #374151",
          marginBottom: 4,
        }}
      >
        <span role="columnheader">Date</span>
        <span role="columnheader">EA Score</span>
        <span role="columnheader">Intake</span>
        <span role="columnheader">Exercise EE</span>
        <span role="columnheader">FFM</span>
        <span role="columnheader">Status</span>
      </div>
      {records.map((record) => {
        const style = rowStyle(record);
        const statusLabel = record.isLEA ? "LEA" : record.isOptimal ? "Optimal" : "Sub-opt";
        const barWidth = `${Math.min(Math.max(record.eaScore / 60, 0), 1) * 100}%`;

        return (
          <div
            key={record.date}
            role="row"
            style={{
              display: "grid",
              gridTemplateColumns: "100px 1fr 100px 100px 80px 80px",
              gap: 8,
              padding: "10px 12px",
              borderRadius: 6,
              backgroundColor: style.bg,
              marginBottom: 4,
              alignItems: "center",
            }}
          >
            <span role="cell" style={{ fontSize: 13, color: "#d1d5db", fontVariantNumeric: "tabular-nums" }}>
              {record.date}
            </span>
            <div role="cell" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  flex: 1,
                  height: 6,
                  backgroundColor: "#1f2937",
                  borderRadius: 3,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: barWidth,
                    height: "100%",
                    backgroundColor: style.badge,
                    borderRadius: 3,
                  }}
                />
              </div>
              <span style={{ fontSize: 13, color: style.text, width: 44, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {record.eaScore.toFixed(1)}
              </span>
            </div>
            <span role="cell" style={{ fontSize: 13, color: "#d1d5db", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
              {Math.round(record.energyIntakeKcal)} kcal
            </span>
            <span role="cell" style={{ fontSize: 13, color: "#d1d5db", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
              {Math.round(record.exerciseEnergyExpenditureKcal)} kcal
            </span>
            <span role="cell" style={{ fontSize: 13, color: "#9ca3af", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
              {record.fatFreeMassKg.toFixed(1)} kg
            </span>
            <span
              role="cell"
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#fff",
                backgroundColor: style.badge,
                padding: "2px 8px",
                borderRadius: 10,
                textAlign: "center",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              {statusLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ThresholdLegend(): JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        gap: 20,
        fontSize: 12,
        color: "#9ca3af",
        marginBottom: 16,
        flexWrap: "wrap",
      }}
      role="note"
      aria-label="EA threshold legend"
    >
      {[
        { color: "#ef4444", label: `LEA: < ${LEA_THRESHOLD_KCAL_PER_KG} kcal/kg FFM/day` },
        { color: "#f59e0b", label: `Sub-optimal: ${LEA_THRESHOLD_KCAL_PER_KG}–${OPTIMAL_EA_KCAL_PER_KG} kcal/kg FFM/day` },
        { color: "#22c55e", label: `Optimal: ≥ ${OPTIMAL_EA_KCAL_PER_KG} kcal/kg FFM/day` },
      ].map(({ color, label }) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: color, flexShrink: 0 }} />
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

export default async function FuelingHistoryPage(): Promise<JSX.Element> {
  const athleteId = process.env.DEMO_ATHLETE_ID ?? "00000000-0000-0000-0000-000000000001";
  const HISTORY_DAYS = 30;

  let history: EAResult;
  let loadError: string | null = null;

  try {
    history = await getEAHistory(athleteId, HISTORY_DAYS);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Failed to load history";
    history = { today: null, rolling7Day: [], averageEA7Day: 0, consecutiveLEADays: 0 };
  }

  return (
    <div
      style={{
        maxWidth: 900,
        margin: "0 auto",
        padding: "32px 20px",
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#f9fafb",
        backgroundColor: "#0f0f1a",
        minHeight: "100vh",
      }}
    >
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <a
            href="/dashboard"
            style={{ fontSize: 13, color: "#60a5fa", textDecoration: "none" }}
            aria-label="Back to dashboard"
          >
            ← Dashboard
          </a>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 4px" }}>
          EA History
        </h1>
        <p style={{ fontSize: 14, color: "#9ca3af", margin: 0 }}>
          {HISTORY_DAYS}-day Energy Availability record
        </p>
      </div>

      {loadError && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 8,
            backgroundColor: "#2d1515",
            border: "1px solid #ef4444",
            marginBottom: 24,
            fontSize: 13,
            color: "#fca5a5",
          }}
          role="alert"
        >
          Unable to load history: {loadError}
        </div>
      )}

      <SummaryStats history={history} days={HISTORY_DAYS} />

      <section aria-label="Daily history">
        <ThresholdLegend />
        <HistoryTable records={history.rolling7Day} />
      </section>
    </div>
  );
}
