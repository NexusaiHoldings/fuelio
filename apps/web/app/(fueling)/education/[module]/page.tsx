/**
 * Sports Nutrition Education — module lesson list.
 *
 * Lists all lessons within a module with progress indicators.
 * Access gated behind paid subscription tier.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getModule,
  getEducationSession,
  hasEducationAccess,
  getLessonProgress,
} from "@/lib/fueling/education-access";

export const dynamic = "force-dynamic";

interface ModulePageProps {
  params: { module: string };
}

export default async function ModulePage({
  params,
}: ModulePageProps): Promise<JSX.Element> {
  const mod = getModule(params.module);
  if (!mod) notFound();

  const session = await getEducationSession();
  const userId = session?.user_id ?? null;
  const isPaid = userId ? await hasEducationAccess(userId) : false;
  const progress = userId ? await getLessonProgress(userId) : [];

  const completedSlugs = new Set(
    progress
      .filter((p) => p.moduleSlug === mod.slug)
      .map((p) => p.lessonSlug),
  );

  const completedCount = completedSlugs.size;
  const totalLessons = mod.lessons.length;

  return (
    <section style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <Link
          href="/education"
          style={{ fontSize: "0.875rem", color: "#6366f1", textDecoration: "none" }}
        >
          ← All Modules
        </Link>
      </div>

      <div style={{ marginBottom: "0.25rem", fontSize: "0.8rem", color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Module {mod.order} of 6
      </div>

      <h1 style={{ marginBottom: "0.5rem" }}>{mod.title}</h1>
      <p style={{ color: "#6b7280", marginBottom: "1.5rem", lineHeight: 1.6 }}>
        {mod.description}
      </p>

      {!isPaid && (
        <div
          style={{
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            borderRadius: 8,
            padding: "1rem 1.25rem",
            marginBottom: "1.5rem",
          }}
        >
          <strong>Paid plan required.</strong> Upgrade to access all lesson
          content.{" "}
          <Link href="/api/billing/checkout" style={{ color: "#ea580c" }}>
            Upgrade now →
          </Link>
        </div>
      )}

      {isPaid && totalLessons > 0 && (
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "0.85rem", color: "#6b7280", marginBottom: "0.4rem" }}>
            {completedCount}/{totalLessons} lessons complete
          </div>
          <div
            style={{
              height: 6,
              background: "#e5e7eb",
              borderRadius: 999,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${Math.round((completedCount / totalLessons) * 100)}%`,
                background: completedCount === totalLessons ? "#10b981" : "#6366f1",
                borderRadius: 999,
              }}
            />
          </div>
        </div>
      )}

      <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {mod.lessons.map((lesson) => {
          const isDone = completedSlugs.has(lesson.slug);
          const locked = !isPaid;

          return (
            <li
              key={lesson.slug}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                marginBottom: "0.75rem",
                padding: "1rem 1.25rem",
                background: isDone ? "#f0fdf4" : "#fff",
                opacity: locked ? 0.75 : 1,
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: isDone ? "#10b981" : locked ? "#e5e7eb" : "#e0e7ff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    marginTop: 2,
                    fontSize: "0.75rem",
                    color: isDone ? "#fff" : "#6b7280",
                    fontWeight: 700,
                  }}
                >
                  {isDone ? "✓" : lesson.order}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: "0.2rem" }}>
                    {locked ? (
                      lesson.title
                    ) : (
                      <Link
                        href={`/education/${mod.slug}/${lesson.slug}`}
                        style={{ color: "#1f2937", textDecoration: "none" }}
                      >
                        {lesson.title}
                      </Link>
                    )}
                  </div>
                  <div style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "0.3rem" }}>
                    {lesson.description}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
                    {lesson.durationMinutes} min read
                    {isDone && (
                      <span style={{ marginLeft: "0.5rem", color: "#10b981", fontWeight: 600 }}>
                        · Completed
                      </span>
                    )}
                    {locked && (
                      <span style={{ marginLeft: "0.5rem", color: "#d97706", fontWeight: 600 }}>
                        · Locked
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
