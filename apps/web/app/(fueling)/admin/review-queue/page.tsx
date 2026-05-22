/**
 * RD Human Review Queue — pending safety flags list.
 *
 * Server component; data fetched at request time. Flagged athletes are locked
 * from AI recommendation generation until an RD reviews each flag here.
 *
 * Feature: F1-008 · Safety escalation / human-in-loop requirement.
 */

import type { JSX } from "react";
import { listPendingFlags } from "@/lib/fueling/review-queue";
import type { SafetyFlag, FlagSeverity } from "@/lib/fueling/review-queue";

// ── Style constants ────────────────────────────────────────────────────────

const SEVERITY_STYLE: Record<FlagSeverity, { bg: string; color: string }> = {
  critical: { bg: "#fee2e2", color: "#991b1b" },
  high: { bg: "#fef3c7", color: "#92400e" },
  medium: { bg: "#fef9c3", color: "#713f12" },
  low: { bg: "#dcfce7", color: "#166534" },
};

const FLAG_TYPE_LABEL: Record<string, string> = {
  disordered_eating: "Disordered Eating",
  anomalous_caloric_intake: "Anomalous Caloric Intake",
  medical_condition_disclosure: "Medical Condition Disclosure",
  overtraining_risk: "Overtraining Risk",
};

const thStyle = {
  padding: "10px 16px",
  textAlign: "left" as const,
  fontSize: 12,
  fontWeight: 600,
  color: "#64748b",
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
};

const tdStyle = {
  padding: "14px 16px",
  verticalAlign: "middle" as const,
};

// ── Sub-components ─────────────────────────────────────────────────────────

function SeverityBadge({
  severity,
}: {
  readonly severity: FlagSeverity;
}): JSX.Element {
  const s = SEVERITY_STYLE[severity] ?? { bg: "#f1f5f9", color: "#475569" };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 600,
        background: s.bg,
        color: s.color,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
      {severity}
    </span>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function ReviewQueuePage(): Promise<JSX.Element> {
  let flags: SafetyFlag[] = [];
  let total = 0;

  try {
    const result = await listPendingFlags(50, 0);
    flags = result.flags;
    total = result.total;
  } catch {
    // DB unavailable at build/preview time — render empty state gracefully.
  }

  return (
    <div
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "32px 24px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#0f172a" }}
        >
          RD Review Queue
        </h1>
        <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 14 }}>
          Safety-flagged athlete profiles awaiting registered dietitian review.
          {total > 0 && (
            <>
              {" "}
              <strong style={{ color: "#dc2626" }}>{total}</strong> pending.
            </>
          )}
        </p>
      </div>

      {/* Lock-out warning */}
      {total > 0 && (
        <div
          role="alert"
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 20,
            fontSize: 14,
            color: "#7f1d1d",
          }}
        >
          Flagged athletes are{" "}
          <strong>locked from AI recommendation generation</strong> until
          reviewed. Action critical and high-severity flags first.
        </div>
      )}

      {/* Empty state */}
      {flags.length === 0 && (
        <div
          style={{
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: 8,
            padding: "40px 24px",
            textAlign: "center",
            color: "#166534",
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Queue is clear</div>
          <div style={{ fontSize: 14, marginTop: 4 }}>
            No pending safety flags to review.
          </div>
        </div>
      )}

      {/* Flags table */}
      {flags.length > 0 && (
        <div
          style={{
            background: "#fff",
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr
                style={{
                  background: "#f8fafc",
                  borderBottom: "1px solid #e2e8f0",
                }}
              >
                <th style={thStyle}>Athlete</th>
                <th style={thStyle}>Flag Type</th>
                <th style={thStyle}>Severity</th>
                <th style={thStyle}>Flagged At</th>
                <th style={thStyle}>Action</th>
              </tr>
            </thead>
            <tbody>
              {flags.map((flag: SafetyFlag) => (
                <tr
                  key={flag.id}
                  style={{ borderBottom: "1px solid #f1f5f9" }}
                >
                  <td style={tdStyle}>
                    <div
                      style={{
                        fontWeight: 600,
                        color: "#0f172a",
                        fontSize: 14,
                      }}
                    >
                      {flag.athlete_name}
                    </div>
                    <div
                      style={{
                        color: "#64748b",
                        fontSize: 12,
                        marginTop: 2,
                      }}
                    >
                      {flag.athlete_email}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: 14, color: "#374151" }}>
                      {FLAG_TYPE_LABEL[flag.flag_type] ?? flag.flag_type}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <SeverityBadge severity={flag.severity} />
                  </td>
                  <td
                    style={{ ...tdStyle, color: "#64748b", fontSize: 13 }}
                  >
                    {formatDate(flag.created_at)}
                  </td>
                  <td style={tdStyle}>
                    <a
                      href={`/admin/review-queue/${flag.id}`}
                      style={{
                        display: "inline-block",
                        padding: "6px 14px",
                        background: "#3b82f6",
                        color: "#fff",
                        borderRadius: 6,
                        fontSize: 13,
                        fontWeight: 500,
                        textDecoration: "none",
                      }}
                    >
                      Review
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
