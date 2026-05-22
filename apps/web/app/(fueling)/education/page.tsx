/**
 * Sports Nutrition Education — module catalogue.
 *
 * Lists all six education modules with progress indicators.
 * Access is gated behind paid subscription tier per CEO briefing mvp_scope.
 */

import Link from "next/link";
import {
  EDUCATION_MODULES,
  getEducationSession,
  hasEducationAccess,
  getModuleCompletionMap,
} from "@/lib/fueling/education-access";

export const dynamic = "force-dynamic";

export default async function EducationPage(): Promise<JSX.Element> {
  const session = await getEducationSession();
  const userId = session?.user_id ?? null;
  const isPaid = userId ? await hasEducationAccess(userId) : false;
  const completionMap = userId ? await getModuleCompletionMap(userId) : {};

  return (
    <section style={{ maxWidth: 960, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <h1 style={{ marginBottom: "0.5rem" }}>Sports Nutrition Education</h1>
      <p style={{ opacity: 0.7, marginBottom: "2rem", maxWidth: 640 }}>
        Six evidence-based modules covering pre-workout fueling, intra-workout
        nutrition, recovery, carbohydrate periodization, hydration, and RED-S
        prevention — authored by our consulting Registered Dietitian.
      </p>

      {!session && (
        <div
          style={{
            background: "#f0f4ff",
            border: "1px solid #c7d2fe",
            borderRadius: 8,
            padding: "1.25rem 1.5rem",
            marginBottom: "2rem",
          }}
        >
          <strong>Sign in to track your progress.</strong>{" "}
          <Link href="/api/auth/login" style={{ color: "#4f46e5" }}>
            Log in
          </Link>
        </div>
      )}

      {session && !isPaid && (
        <div
          style={{
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            borderRadius: 8,
            padding: "1.25rem 1.5rem",
            marginBottom: "2rem",
          }}
        >
          <strong>Upgrade to unlock all 6 modules.</strong> Full access to the
          sports fueling education course is included in the paid plan.{" "}
          <Link href="/api/billing/checkout" style={{ color: "#ea580c" }}>
            Upgrade now →
          </Link>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "1.25rem",
        }}
      >
        {EDUCATION_MODULES.map((mod) => {
          const completed = completionMap[mod.slug]?.size ?? 0;
          const total = mod.lessons.length;
          const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
          const locked = !isPaid;

          return (
            <div
              key={mod.slug}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                padding: "1.25rem",
                background: locked ? "#fafafa" : "#fff",
                opacity: locked ? 0.8 : 1,
                position: "relative",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "0.5rem",
                }}
              >
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "#6b7280",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Module {mod.order}
                </span>
                {locked && (
                  <span
                    style={{
                      fontSize: "0.75rem",
                      background: "#fef3c7",
                      color: "#92400e",
                      padding: "2px 8px",
                      borderRadius: 999,
                      fontWeight: 600,
                    }}
                  >
                    Locked
                  </span>
                )}
                {!locked && pct === 100 && (
                  <span
                    style={{
                      fontSize: "0.75rem",
                      background: "#d1fae5",
                      color: "#065f46",
                      padding: "2px 8px",
                      borderRadius: 999,
                      fontWeight: 600,
                    }}
                  >
                    Complete
                  </span>
                )}
              </div>

              <h2 style={{ fontSize: "1.1rem", margin: "0 0 0.4rem" }}>
                {locked ? (
                  mod.title
                ) : (
                  <Link
                    href={`/education/${mod.slug}`}
                    style={{ color: "inherit", textDecoration: "none" }}
                  >
                    {mod.title}
                  </Link>
                )}
              </h2>

              <p
                style={{
                  fontSize: "0.875rem",
                  color: "#6b7280",
                  margin: "0 0 1rem",
                  lineHeight: 1.5,
                }}
              >
                {mod.description}
              </p>

              <div style={{ fontSize: "0.8rem", color: "#9ca3af", marginBottom: "0.5rem" }}>
                {total} lessons
              </div>

              {!locked && (
                <div
                  style={{
                    height: 4,
                    background: "#e5e7eb",
                    borderRadius: 999,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${pct}%`,
                      background: pct === 100 ? "#10b981" : "#6366f1",
                      borderRadius: 999,
                      transition: "width 0.3s",
                    }}
                  />
                </div>
              )}
              {!locked && (
                <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: "0.25rem" }}>
                  {completed}/{total} lessons complete
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p
        style={{
          marginTop: "2.5rem",
          fontSize: "0.75rem",
          color: "#9ca3af",
          maxWidth: 600,
          lineHeight: 1.6,
        }}
      >
        All educational content is intended for informational purposes only and
        does not constitute medical advice. Consult a qualified sports Registered
        Dietitian for personalized guidance. Claims are reviewed for compliance
        with FDA and FTC health and wellness guidelines.
      </p>
    </section>
  );
}
