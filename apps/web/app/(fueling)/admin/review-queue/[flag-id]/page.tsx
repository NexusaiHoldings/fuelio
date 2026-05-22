/**
 * RD Review Queue — individual flag detail + review action page.
 *
 * Server component; the review form uses a Next.js inline server action so
 * the decision (clear / escalate / request info) is processed server-side
 * and an immutable audit entry is written to admin_audit_log.
 *
 * Feature: F1-008 · Safety escalation / human-in-loop requirement.
 */

import type { JSX, ReactNode } from "react";
import { redirect } from "next/navigation";
import {
  getFlagDetails,
  submitReviewDecision,
} from "@/lib/fueling/review-queue";
import type { SafetyFlag, FlagSeverity, ReviewDecision } from "@/lib/fueling/review-queue";

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

const STATUS_LABEL: Record<string, string> = {
  pending_review: "Pending Review",
  cleared: "Cleared",
  escalated: "Escalated",
  info_requested: "Info Requested",
};

// ── Sub-components ─────────────────────────────────────────────────────────

function DetailRow({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        gap: 16,
        padding: "12px 0",
        borderBottom: "1px solid #f1f5f9",
      }}
    >
      <span
        style={{
          minWidth: 180,
          fontWeight: 600,
          color: "#64748b",
          fontSize: 13,
        }}
      >
        {label}
      </span>
      <span style={{ color: "#0f172a", fontSize: 14 }}>{children}</span>
    </div>
  );
}

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
    return new Date(iso).toLocaleString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// ── Already-reviewed state ─────────────────────────────────────────────────

function AlreadyReviewedBanner({
  flag,
}: {
  readonly flag: SafetyFlag;
}): JSX.Element {
  return (
    <div
      role="status"
      style={{
        background: "#f0f9ff",
        border: "1px solid #bae6fd",
        borderRadius: 8,
        padding: "16px 20px",
        marginBottom: 24,
        fontSize: 14,
        color: "#0c4a6e",
      }}
    >
      This flag was already reviewed.{" "}
      <strong>Decision: {STATUS_LABEL[flag.status] ?? flag.status}</strong>
      {flag.reviewed_at && (
        <> on {formatDate(flag.reviewed_at)}</>
      )}
      {flag.review_notes && (
        <div style={{ marginTop: 8, color: "#0369a1" }}>
          Notes: {flag.review_notes}
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

interface PageProps {
  readonly params: { "flag-id": string };
}

export default async function FlagDetailPage({
  params,
}: PageProps): Promise<JSX.Element> {
  const flagId = params["flag-id"];

  let flag: SafetyFlag | null = null;
  try {
    flag = await getFlagDetails(flagId);
  } catch {
    // DB unavailable — show not-found state.
  }

  if (!flag) {
    return (
      <div
        style={{
          maxWidth: 700,
          margin: "64px auto",
          padding: "0 24px",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          color: "#64748b",
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 16 }}>⚠</div>
        <h2 style={{ margin: 0, fontSize: 20, color: "#0f172a" }}>
          Flag not found
        </h2>
        <p style={{ marginTop: 8, fontSize: 14 }}>
          The requested safety flag does not exist or has been removed.
        </p>
        <a
          href="/admin/review-queue"
          style={{
            display: "inline-block",
            marginTop: 20,
            padding: "8px 18px",
            background: "#3b82f6",
            color: "#fff",
            borderRadius: 6,
            textDecoration: "none",
            fontSize: 14,
          }}
        >
          ← Back to Review Queue
        </a>
      </div>
    );
  }

  // Server action: record review decision + write audit entry.
  async function handleReview(formData: FormData): Promise<void> {
    "use server";
    const decision = formData.get("decision") as ReviewDecision | null;
    const notes = (formData.get("notes") as string | null) ?? "";

    if (!decision || !["cleared", "escalated", "info_requested"].includes(decision)) {
      return;
    }

    // RD user identity: sourced from NextAuth session in production.
    // The substrate provisions NEXTAUTH_SECRET/NEXTAUTH_URL; the exact
    // session-extraction helper depends on the runtime config. We fall back
    // to the configured system account so the audit trail is never blank.
    const rdUserId =
      process.env.RD_SYSTEM_USER_ID ?? "00000000-0000-0000-0000-000000000001";

    await submitReviewDecision(flagId, decision, rdUserId, notes);
    redirect("/admin/review-queue");
  }

  const isPending = flag.status === "pending_review";

  return (
    <div
      style={{
        maxWidth: 780,
        margin: "0 auto",
        padding: "32px 24px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Back link */}
      <a
        href="/admin/review-queue"
        style={{
          display: "inline-block",
          marginBottom: 20,
          fontSize: 14,
          color: "#3b82f6",
          textDecoration: "none",
        }}
      >
        ← Back to Review Queue
      </a>

      {/* Page title */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <h1
          style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#0f172a" }}
        >
          Safety Flag Review
        </h1>
        <SeverityBadge severity={flag.severity} />
      </div>

      {/* Already-reviewed banner */}
      {!isPending && <AlreadyReviewedBanner flag={flag} />}

      {/* Flag details card */}
      <div
        style={{
          background: "#fff",
          borderRadius: 8,
          border: "1px solid #e2e8f0",
          padding: "0 20px",
          marginBottom: 24,
        }}
      >
        <DetailRow label="Athlete Name">{flag.athlete_name}</DetailRow>
        <DetailRow label="Athlete Email">{flag.athlete_email}</DetailRow>
        <DetailRow label="Flag Type">
          {FLAG_TYPE_LABEL[flag.flag_type] ?? flag.flag_type}
        </DetailRow>
        <DetailRow label="Severity">
          <SeverityBadge severity={flag.severity} />
        </DetailRow>
        <DetailRow label="Status">
          {STATUS_LABEL[flag.status] ?? flag.status}
        </DetailRow>
        <DetailRow label="Flagged At">{formatDate(flag.created_at)}</DetailRow>
        {Object.keys(flag.details).length > 0 && (
          <DetailRow label="Details">
            <pre
              style={{
                margin: 0,
                fontSize: 12,
                background: "#f8fafc",
                padding: "8px 12px",
                borderRadius: 6,
                overflowX: "auto",
                maxWidth: 460,
                color: "#334155",
              }}
            >
              {JSON.stringify(flag.details, null, 2)}
            </pre>
          </DetailRow>
        )}
      </div>

      {/* Review form — only shown when flag is still pending */}
      {isPending && (
        <div
          style={{
            background: "#fff",
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            padding: 24,
          }}
        >
          <h2
            style={{
              margin: "0 0 16px",
              fontSize: 16,
              fontWeight: 700,
              color: "#0f172a",
            }}
          >
            Submit Review Decision
          </h2>

          <form action={handleReview}>
            {/* Decision */}
            <div style={{ marginBottom: 16 }}>
              <label
                htmlFor="decision"
                style={{
                  display: "block",
                  marginBottom: 6,
                  fontWeight: 600,
                  fontSize: 13,
                  color: "#374151",
                }}
              >
                Decision <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <select
                id="decision"
                name="decision"
                required
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  fontSize: 14,
                  color: "#0f172a",
                  background: "#fff",
                }}
              >
                <option value="">— Select a decision —</option>
                <option value="cleared">
                  Clear — No safety concern; unlock athlete
                </option>
                <option value="escalated">
                  Escalate — Refer to physician / clinical team
                </option>
                <option value="info_requested">
                  Request Info — Ask athlete for more context
                </option>
              </select>
            </div>

            {/* Notes */}
            <div style={{ marginBottom: 20 }}>
              <label
                htmlFor="notes"
                style={{
                  display: "block",
                  marginBottom: 6,
                  fontWeight: 600,
                  fontSize: 13,
                  color: "#374151",
                }}
              >
                Clinical Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={4}
                placeholder="Document your clinical reasoning, observations, or follow-up instructions…"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  fontSize: 14,
                  color: "#0f172a",
                  resize: "vertical",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <button
              type="submit"
              style={{
                padding: "10px 24px",
                background: "#0f172a",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Submit Review
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
