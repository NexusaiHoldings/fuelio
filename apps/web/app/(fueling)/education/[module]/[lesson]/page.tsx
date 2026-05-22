/**
 * Sports Nutrition Education — lesson content viewer.
 *
 * Renders lesson content with a server action to mark the lesson complete.
 * Access gated behind paid subscription tier.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  getLesson,
  getModule,
  getEducationSession,
  hasEducationAccess,
  getLessonProgress,
  markLessonComplete,
  EDUCATION_MODULES,
} from "@/lib/fueling/education-access";

export const dynamic = "force-dynamic";

interface LessonPageProps {
  params: { module: string; lesson: string };
}

export default async function LessonPage({
  params,
}: LessonPageProps): Promise<JSX.Element> {
  const found = getLesson(params.module, params.lesson);
  if (!found) notFound();

  const { module: mod, lesson } = found;

  const session = await getEducationSession();
  const userId = session?.user_id ?? null;
  const isPaid = userId ? await hasEducationAccess(userId) : false;

  if (!isPaid) {
    return (
      <section style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1.5rem" }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <Link
            href={`/education/${mod.slug}`}
            style={{ fontSize: "0.875rem", color: "#6366f1", textDecoration: "none" }}
          >
            ← {mod.title}
          </Link>
        </div>

        <h1 style={{ marginBottom: "0.5rem" }}>{lesson.title}</h1>
        <p style={{ color: "#6b7280", marginBottom: "2rem" }}>{lesson.description}</p>

        <div
          style={{
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            borderRadius: 10,
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🔒</div>
          <h2 style={{ marginBottom: "0.75rem" }}>Paid Plan Required</h2>
          <p style={{ color: "#6b7280", maxWidth: 400, margin: "0 auto 1.5rem" }}>
            Access to the full sports nutrition education course is included in
            the paid plan. Upgrade to unlock all 6 modules and track your
            progress.
          </p>
          <Link
            href="/api/billing/checkout"
            style={{
              display: "inline-block",
              background: "#ea580c",
              color: "#fff",
              padding: "0.625rem 1.5rem",
              borderRadius: 6,
              textDecoration: "none",
              fontWeight: 600,
              fontSize: "0.95rem",
            }}
          >
            Upgrade Now →
          </Link>
          {!session && (
            <p style={{ marginTop: "1rem", fontSize: "0.875rem", color: "#9ca3af" }}>
              Already have an account?{" "}
              <Link href="/api/auth/login" style={{ color: "#6366f1" }}>
                Log in
              </Link>
            </p>
          )}
        </div>
      </section>
    );
  }

  const progress = userId ? await getLessonProgress(userId) : [];
  const isComplete = progress.some(
    (p) => p.moduleSlug === mod.slug && p.lessonSlug === lesson.slug,
  );

  const currentIndex = mod.lessons.findIndex((lsn) => lsn.slug === lesson.slug);
  const prevLesson = currentIndex > 0 ? mod.lessons[currentIndex - 1] : null;
  const nextLesson =
    currentIndex < mod.lessons.length - 1 ? mod.lessons[currentIndex + 1] : null;

  const currentModuleIndex = EDUCATION_MODULES.findIndex(
    (m) => m.slug === mod.slug,
  );
  const nextModule =
    !nextLesson && currentModuleIndex < EDUCATION_MODULES.length - 1
      ? EDUCATION_MODULES[currentModuleIndex + 1]
      : null;

  async function handleMarkComplete(formData: FormData): Promise<void> {
    "use server";
    const uid = formData.get("userId") as string;
    const mSlug = formData.get("moduleSlug") as string;
    const lSlug = formData.get("lessonSlug") as string;
    if (!uid || !mSlug || !lSlug) return;
    await markLessonComplete(uid, mSlug, lSlug);
    revalidatePath(`/education/${mSlug}/${lSlug}`);
    revalidatePath(`/education/${mSlug}`);
    revalidatePath("/education");
    const actionMod = getModule(mSlug);
    const actionIdx = actionMod
      ? actionMod.lessons.findIndex((lsn) => lsn.slug === lSlug)
      : -1;
    const actionNext =
      actionMod && actionIdx >= 0 && actionIdx < actionMod.lessons.length - 1
        ? actionMod.lessons[actionIdx + 1]
        : null;
    const actionModIdx = EDUCATION_MODULES.findIndex((m) => m.slug === mSlug);
    const actionNextMod =
      !actionNext && actionModIdx >= 0 && actionModIdx < EDUCATION_MODULES.length - 1
        ? EDUCATION_MODULES[actionModIdx + 1]
        : null;
    if (actionNext) {
      redirect(`/education/${mSlug}/${actionNext.slug}`);
    } else if (actionNextMod) {
      redirect(`/education/${actionNextMod.slug}`);
    } else {
      redirect("/education");
    }
  }

  const contentParagraphs = lesson.content
    .split("\n\n")
    .filter((p) => p.trim().length > 0);

  return (
    <section style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          alignItems: "center",
          marginBottom: "1.5rem",
          fontSize: "0.875rem",
        }}
      >
        <Link href="/education" style={{ color: "#9ca3af", textDecoration: "none" }}>
          Education
        </Link>
        <span style={{ color: "#d1d5db" }}>›</span>
        <Link
          href={`/education/${mod.slug}`}
          style={{ color: "#9ca3af", textDecoration: "none" }}
        >
          {mod.title}
        </Link>
        <span style={{ color: "#d1d5db" }}>›</span>
        <span style={{ color: "#374151" }}>{lesson.title}</span>
      </div>

      <div style={{ marginBottom: "0.25rem", fontSize: "0.8rem", color: "#9ca3af", fontWeight: 600 }}>
        Lesson {lesson.order} of {mod.lessons.length} · {lesson.durationMinutes} min read
        {isComplete && (
          <span style={{ marginLeft: "0.5rem", color: "#10b981" }}>· ✓ Completed</span>
        )}
      </div>

      <h1 style={{ marginBottom: "0.5rem" }}>{lesson.title}</h1>
      <p style={{ color: "#6b7280", marginBottom: "2rem", lineHeight: 1.6 }}>
        {lesson.description}
      </p>

      <article
        style={{
          lineHeight: 1.8,
          color: "#374151",
          fontSize: "0.95rem",
        }}
      >
        {contentParagraphs.map((block, idx) => {
          const trimmed = block.trim();
          if (trimmed.startsWith("## ")) {
            return (
              <h2
                key={idx}
                style={{ marginTop: "1.75rem", marginBottom: "0.75rem", fontSize: "1.15rem" }}
              >
                {trimmed.replace(/^## /, "")}
              </h2>
            );
          }
          if (trimmed.startsWith("### ")) {
            return (
              <h3
                key={idx}
                style={{ marginTop: "1.25rem", marginBottom: "0.5rem", fontSize: "1rem" }}
              >
                {trimmed.replace(/^### /, "")}
              </h3>
            );
          }
          if (trimmed.startsWith("|")) {
            const rows = trimmed
              .split("\n")
              .filter((r) => r.trim() && !r.match(/^\|[-| ]+\|$/));
            return (
              <div key={idx} style={{ overflowX: "auto", marginBottom: "1rem" }}>
                <table
                  style={{
                    borderCollapse: "collapse",
                    width: "100%",
                    fontSize: "0.875rem",
                  }}
                >
                  <tbody>
                    {rows.map((row, ri) => (
                      <tr key={ri}>
                        {row
                          .split("|")
                          .filter((_, ci) => ci > 0 && ci < row.split("|").length - 1)
                          .map((cell, ci) =>
                            ri === 0 ? (
                              <th
                                key={ci}
                                style={{
                                  border: "1px solid #e5e7eb",
                                  padding: "0.4rem 0.75rem",
                                  background: "#f9fafb",
                                  textAlign: "left",
                                  fontWeight: 600,
                                }}
                              >
                                {cell.trim()}
                              </th>
                            ) : (
                              <td
                                key={ci}
                                style={{
                                  border: "1px solid #e5e7eb",
                                  padding: "0.4rem 0.75rem",
                                }}
                              >
                                {cell.trim()}
                              </td>
                            ),
                          )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
          if (trimmed.startsWith("```")) {
            const codeContent = trimmed
              .replace(/^```[a-z]*\n?/, "")
              .replace(/\n?```$/, "");
            return (
              <pre
                key={idx}
                style={{
                  background: "#f3f4f6",
                  borderRadius: 6,
                  padding: "0.75rem 1rem",
                  overflowX: "auto",
                  fontSize: "0.85rem",
                  marginBottom: "1rem",
                }}
              >
                <code>{codeContent}</code>
              </pre>
            );
          }
          if (trimmed.startsWith("- ") || trimmed.match(/^\d+\. /)) {
            const lines = trimmed.split("\n").filter((ln) => ln.trim());
            const isOrdered = trimmed.match(/^\d+\. /);
            return isOrdered ? (
              <ol key={idx} style={{ paddingLeft: "1.5rem", marginBottom: "1rem" }}>
                {lines.map((li, lii) => (
                  <li key={lii} style={{ marginBottom: "0.3rem" }}>
                    {li.replace(/^\d+\. /, "")}
                  </li>
                ))}
              </ol>
            ) : (
              <ul key={idx} style={{ paddingLeft: "1.5rem", marginBottom: "1rem" }}>
                {lines.map((li, lii) => (
                  <li key={lii} style={{ marginBottom: "0.3rem" }}>
                    {li.replace(/^- /, "")}
                  </li>
                ))}
              </ul>
            );
          }
          if (trimmed.startsWith("*") && trimmed.endsWith("*")) {
            return (
              <p
                key={idx}
                style={{
                  color: "#6b7280",
                  fontStyle: "italic",
                  fontSize: "0.875rem",
                  marginBottom: "1rem",
                  borderLeft: "3px solid #e5e7eb",
                  paddingLeft: "0.75rem",
                }}
              >
                {trimmed.replace(/^\*/, "").replace(/\*$/, "")}
              </p>
            );
          }
          return (
            <p key={idx} style={{ marginBottom: "1rem" }}>
              {trimmed}
            </p>
          );
        })}
      </article>

      <div
        style={{
          marginTop: "2.5rem",
          paddingTop: "1.5rem",
          borderTop: "1px solid #e5e7eb",
        }}
      >
        {!isComplete && userId && (
          <form action={handleMarkComplete}>
            <input type="hidden" name="userId" value={userId} />
            <input type="hidden" name="moduleSlug" value={mod.slug} />
            <input type="hidden" name="lessonSlug" value={lesson.slug} />
            <button
              type="submit"
              style={{
                background: "#6366f1",
                color: "#fff",
                border: "none",
                padding: "0.625rem 1.5rem",
                borderRadius: 6,
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "0.95rem",
              }}
            >
              {nextLesson
                ? "Mark Complete & Next Lesson →"
                : nextModule
                  ? "Mark Complete & Next Module →"
                  : "Mark Complete ✓"}
            </button>
          </form>
        )}

        {isComplete && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              color: "#10b981",
              fontWeight: 600,
            }}
          >
            <span>✓ Lesson complete</span>
            {(nextLesson || nextModule) && (
              <Link
                href={
                  nextLesson
                    ? `/education/${mod.slug}/${nextLesson.slug}`
                    : `/education/${nextModule!.slug}`
                }
                style={{
                  marginLeft: "1rem",
                  color: "#6366f1",
                  textDecoration: "none",
                  fontWeight: 600,
                }}
              >
                {nextLesson ? "Next Lesson →" : "Next Module →"}
              </Link>
            )}
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: "1.5rem",
          fontSize: "0.875rem",
        }}
      >
        {prevLesson ? (
          <Link
            href={`/education/${mod.slug}/${prevLesson.slug}`}
            style={{ color: "#6366f1", textDecoration: "none" }}
          >
            ← {prevLesson.title}
          </Link>
        ) : (
          <Link
            href={`/education/${mod.slug}`}
            style={{ color: "#9ca3af", textDecoration: "none" }}
          >
            ← Back to module
          </Link>
        )}
        {nextLesson && (
          <Link
            href={`/education/${mod.slug}/${nextLesson.slug}`}
            style={{ color: "#6366f1", textDecoration: "none" }}
          >
            {nextLesson.title} →
          </Link>
        )}
      </div>

      <p
        style={{
          marginTop: "2rem",
          fontSize: "0.75rem",
          color: "#9ca3af",
          lineHeight: 1.6,
          borderTop: "1px solid #f3f4f6",
          paddingTop: "1rem",
        }}
      >
        Educational content authored by a consulting Registered Dietitian.
        Reviewed for compliance with FDA and FTC health and wellness claims
        guidelines. This is not medical advice.
      </p>
    </section>
  );
}
