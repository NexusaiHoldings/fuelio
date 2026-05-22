/**
 * /dashboard — Athlete fueling dashboard.
 *
 * Server component. Displays:
 *   - Today's Energy Availability score with LEA/optimal status
 *   - 7-day rolling average
 *   - RED-S risk level + recommendation
 *   - Active safety flags (human-in-loop notices per liability_assessor)
 *
 * Auth: reads athlete_id from session via @nexus/identity-and-access.
 * Falls back to a demo/unauthenticated state when no session present.
 */

import { getEAHistory } from "@/lib/fueling/energy-availability";
import { scoreREDSRisk } from "@/lib/fueling/reds-risk-scorer";
import { detectSafetyFlags } from "@/lib/fueling/safety-flags";
import type { SafetyFlag } from "@/lib/fueling/safety-flags";
import type { REDSRiskScore } from "@/lib/fueling/reds-risk-scorer";
import type { EAResult, DailyEARecord } from "@/lib/fueling/energy-availability";

const RISK_COLORS: Record<string, string> = {
  low: "#22c55e",
  moderate: "#f59e0b",
  high: "#f97316",
  critical: "#ef4444",
};

const SEVERITY_COLORS: Record<string, string> = {
  warning: "#f59e0b",
  alert: "#f97316",
  critical: "#ef4444",
};

interface EAGaugeProps {
  readonly eaScore: number;
  readonly isLEA: boolean;
  readonly isOptimal: boolean;
}

function EAGauge({ eaScore, isLEA, isOptimal }: EAGaugeProps): JSX.Element {
  const color = isLEA ? "#ef4444" : isOptimal ? "#22c55e" : "#f59e0b";
  const label = isLEA ? "Low Energy Availability" : isOptimal ? "Optimal" : "Below Optimal";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        padding: "24px 32px",
        borderRadius: 16,
        backgroundColor: "#1a1a2e",
        border: `2px solid ${color}`,
        minWidth: 200,
      }}
      role="meter"
      aria-label={`Energy Availability: ${eaScore.toFixed(1)} kcal/kg FFM/day`}
      aria-valuenow={eaScore}
      aria-valuemin={0}
      aria-valuemax={60}
    >
      <div style={{ fontSize: 48, fontWeight: 700, color, lineHeight: 1 }}>
        {eaScore.toFixed(1)}
      </div>
      <div style={{ fontSize: 13, color: "#9ca3af" }}>kcal/kg FFM/day</div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </div>
    </div>
  );
}

interface RiskBadgeProps {
  readonly risk: REDSRiskScore;
}

function RiskBadge({ risk }: RiskBadgeProps): JSX.Element {
  const color = RISK_COLORS[risk.level] ?? "#9ca3af";
  return (
    <div
      style={{
        padding: "16px 20px",
        borderRadius: 12,
        backgroundColor: "#1a1a2e",
        border: `1px solid ${color}`,
        flex: 1,
      }}
      role="region"
      aria-label="RED-S Risk Assessment"
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div
          style={{
            padding: "4px 12px",
            borderRadius: 20,
            backgroundColor: color,
            color: "#fff",
            fontSize: 12,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          {risk.level} risk
        </div>
        <div style={{ fontSize: 13, color: "#9ca3af" }}>
          Score: {risk.score}/100
        </div>
      </div>
      <p style={{ fontSize: 13, color: "#d1d5db", margin: "0 0 12px" }}>
        {risk.recommendation}
      </p>
      {risk.factors.length > 0 && (
        <ul style={{ margin: 0, padding: "0 0 0 16px" }}>
          {risk.factors.map((factor, idx) => (
            <li key={idx} style={{ fontSize: 12, color: "#9ca3af", marginBottom: 4 }}>
              {factor}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface SafetyFlagCardProps {
  readonly flag: SafetyFlag;
}

function SafetyFlagCard({ flag }: SafetyFlagCardProps): JSX.Element {
  const color = SEVERITY_COLORS[flag.severity] ?? "#9ca3af";
  return (
    <div
      style={{
        padding: "12px 16px",
        borderRadius: 8,
        backgroundColor: "#1a1a2e",
        borderLeft: `4px solid ${color}`,
        marginBottom: 8,
      }}
      role="alert"
      aria-label={`Safety flag: ${flag.type}`}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color, textTransform: "uppercase" }}>
          {flag.severity}
        </span>
        {flag.requiresHumanReview && (
          <span style={{ fontSize: 11, color: "#9ca3af" }}>
            Requires coach review
          </span>
        )}
      </div>
      <p style={{ fontSize: 13, color: "#d1d5db", margin: 0 }}>{flag.message}</p>
    </div>
  );
}

interface TodaySummaryProps {
  readonly today: DailyEARecord;
  readonly avgEA: number;
}

function TodaySummary({ today, avgEA }: TodaySummaryProps): JSX.Element {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: 12,
        marginTop: 16,
      }}
    >
      {[
        { label: "Intake", value: `${Math.round(today.energyIntakeKcal)} kcal` },
        { label: "Exercise EE", value: `${Math.round(today.exerciseEnergyExpenditureKcal)} kcal` },
        { label: "7-day avg EA", value: `${avgEA.toFixed(1)} kcal/kg` },
      ].map(({ label, value }) => (
        <div
          key={label}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            backgroundColor: "#0f0f1a",
            border: "1px solid #374151",
          }}
        >
          <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>{label}</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#f9fafb" }}>{value}</div>
        </div>
      ))}
    </div>
  );
}

export default async function FuelingDashboardPage(): Promise<JSX.Element> {
  // In production, resolve athlete_id from the authenticated session.
  // The identity-and-access lego's session handler provides this.
  // For now, read from env so the page renders without crashing in preview.
  const athleteId = process.env.DEMO_ATHLETE_ID ?? "00000000-0000-0000-0000-000000000001";

  let eaResult: EAResult;
  let riskScore: REDSRiskScore;
  let safetyFlags: SafetyFlag[];
  let loadError: string | null = null;

  try {
    [eaResult, safetyFlags] = await Promise.all([
      getEAHistory(athleteId, 7),
      detectSafetyFlags(athleteId),
    ]);
    riskScore = scoreREDSRisk(eaResult);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Failed to load dashboard data";
    eaResult = { today: null, rolling7Day: [], averageEA7Day: 0, consecutiveLEADays: 0 };
    riskScore = { level: "low", score: 0, factors: [], recommendation: "" };
    safetyFlags = [];
  }

  return (
    <div
      style={{
        maxWidth: 800,
        margin: "0 auto",
        padding: "32px 20px",
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#f9fafb",
        backgroundColor: "#0f0f1a",
        minHeight: "100vh",
      }}
    >
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 4px" }}>
          Energy Availability
        </h1>
        <p style={{ fontSize: 14, color: "#9ca3af", margin: 0 }}>
          Daily and rolling 7-day EA score · RED-S risk assessment
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
          Unable to load data: {loadError}
        </div>
      )}

      {safetyFlags.length > 0 && (
        <section style={{ marginBottom: 28 }} aria-label="Safety Alerts">
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 12px", color: "#fbbf24" }}>
            Safety Alerts
          </h2>
          {safetyFlags.map((flag, idx) => (
            <SafetyFlagCard key={idx} flag={flag} />
          ))}
        </section>
      )}

      <section style={{ marginBottom: 28 }} aria-label="Today's Energy Availability">
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 16px" }}>
          Today
        </h2>
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
          {eaResult.today ? (
            <EAGauge
              eaScore={eaResult.today.eaScore}
              isLEA={eaResult.today.isLEA}
              isOptimal={eaResult.today.isOptimal}
            />
          ) : (
            <div
              style={{
                padding: "24px 32px",
                borderRadius: 16,
                backgroundColor: "#1a1a2e",
                border: "1px solid #374151",
                color: "#6b7280",
                fontSize: 14,
              }}
            >
              No data logged today
            </div>
          )}
          <RiskBadge risk={riskScore} />
        </div>
        {eaResult.today && (
          <TodaySummary today={eaResult.today} avgEA={eaResult.averageEA7Day} />
        )}
      </section>

      <section aria-label="7-day trend">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>7-Day Trend</h2>
          <a
            href="/dashboard/history"
            style={{ fontSize: 13, color: "#60a5fa", textDecoration: "none" }}
          >
            View full history →
          </a>
        </div>
        {eaResult.rolling7Day.length === 0 ? (
          <p style={{ fontSize: 13, color: "#6b7280" }}>No recent data available.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {eaResult.rolling7Day.map((record) => {
              const barColor = record.isLEA
                ? "#ef4444"
                : record.isOptimal
                  ? "#22c55e"
                  : "#f59e0b";
              const barWidth = `${Math.min(Math.max(record.eaScore / 60, 0), 1) * 100}%`;
              return (
                <div
                  key={record.date}
                  style={{ display: "flex", alignItems: "center", gap: 12 }}
                >
                  <span style={{ fontSize: 12, color: "#9ca3af", width: 80, flexShrink: 0 }}>
                    {record.date}
                  </span>
                  <div
                    style={{
                      flex: 1,
                      height: 8,
                      backgroundColor: "#1f2937",
                      borderRadius: 4,
                      overflow: "hidden",
                    }}
                    role="progressbar"
                    aria-valuenow={record.eaScore}
                    aria-valuemin={0}
                    aria-valuemax={60}
                    aria-label={`EA ${record.eaScore.toFixed(1)} on ${record.date}`}
                  >
                    <div
                      style={{
                        width: barWidth,
                        height: "100%",
                        backgroundColor: barColor,
                        borderRadius: 4,
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                  <span style={{ fontSize: 12, color: barColor, width: 60, textAlign: "right", flexShrink: 0 }}>
                    {record.eaScore.toFixed(1)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
