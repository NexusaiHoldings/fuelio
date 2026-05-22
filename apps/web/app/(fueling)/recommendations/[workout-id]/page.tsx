/**
 * Fueling Recommendations — single workout detail page.
 *
 * Server component. Generates and displays AI-powered pre-workout,
 * intra-workout, and post-workout fueling guidelines with all 7
 * required compliance disclaimers injected via compliance-wrapper.ts.
 */

import type { JSX } from "react";
import {
  generateFuelingPlan,
  formatWorkoutTypeLabel,
  formatEALevelLabel,
  type WorkoutInput,
  type PhaseRecommendation,
  type WorkoutFuelingPlan,
} from "@/lib/fueling/recommendations";
import { REQUIRED_DISCLAIMERS, type ComplianceDisclaimer } from "@/lib/fueling/compliance-wrapper";

interface PageProps {
  readonly params: { "workout-id": string };
}

const WORKOUT_REGISTRY: Record<string, WorkoutInput> = {
  "wk-001": {
    workoutId: "wk-001",
    workoutType: "endurance",
    durationMinutes: 120,
    scheduledAt: new Date(Date.now() + 86400000).toISOString(),
    intensityPercent: 65,
    athleteWeightKg: 70,
    eaScore: 42,
    athleteName: "Athlete",
  },
  "wk-002": {
    workoutId: "wk-002",
    workoutType: "strength",
    durationMinutes: 60,
    scheduledAt: new Date(Date.now() + 2 * 86400000).toISOString(),
    intensityPercent: 80,
    athleteWeightKg: 70,
    eaScore: 42,
    athleteName: "Athlete",
  },
  "wk-003": {
    workoutId: "wk-003",
    workoutType: "hiit",
    durationMinutes: 45,
    scheduledAt: new Date(Date.now() + 3 * 86400000).toISOString(),
    intensityPercent: 90,
    athleteWeightKg: 70,
    eaScore: 38,
    athleteName: "Athlete",
  },
};

const PHASE_LABELS: Record<string, string> = {
  pre: "Pre-Workout",
  intra: "Intra-Workout",
  post: "Post-Workout / Recovery",
};

const PHASE_COLORS: Record<string, string> = {
  pre: "#2563eb",
  intra: "#7c3aed",
  post: "#059669",
};

function PhaseCard({ rec }: { rec: PhaseRecommendation }): JSX.Element {
  const color = PHASE_COLORS[rec.phase] ?? "#374151";
  const label = PHASE_LABELS[rec.phase] ?? rec.phase;

  return (
    <div
      style={{
        border: `1px solid ${color}30`,
        borderTop: `3px solid ${color}`,
        borderRadius: 8,
        padding: "1.25rem 1.5rem",
        marginBottom: "1.25rem",
        background: "#fff",
      }}
    >
      <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color }}>
        {label}
      </h3>
      <p style={{ margin: "0.25rem 0 0.75rem", fontSize: "0.8rem", opacity: 0.6 }}>
        {rec.timingDescription}
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "0.75rem",
          marginBottom: "0.75rem",
        }}
      >
        {[
          { label: "Carbohydrate", range: rec.carbGramsRange, unit: "g" },
          { label: "Protein", range: rec.proteinGramsRange, unit: "g" },
          { label: "Fluid", range: rec.fluidMlRange, unit: "ml" },
        ].map((nutrient) => (
          <div
            key={nutrient.label}
            style={{
              background: "#f9fafb",
              borderRadius: 6,
              padding: "0.6rem 0.75rem",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "0.7rem", opacity: 0.55, marginBottom: 2 }}>
              {nutrient.label}
            </div>
            <div style={{ fontSize: "1.05rem", fontWeight: 700 }}>
              {nutrient.range[0]}–{nutrient.range[1]}
              <span style={{ fontSize: "0.7rem", fontWeight: 400, opacity: 0.7 }}>
                {" "}{nutrient.unit}
              </span>
            </div>
          </div>
        ))}
      </div>

      {rec.suggestedFoods.length > 0 && (
        <div style={{ marginBottom: "0.5rem" }}>
          <span style={{ fontSize: "0.78rem", fontWeight: 600, opacity: 0.7 }}>
            Suggested foods:{" "}
          </span>
          <span style={{ fontSize: "0.78rem", opacity: 0.65 }}>
            {rec.suggestedFoods.join(", ")}
          </span>
        </div>
      )}

      {rec.keyNotes && (
        <p style={{ margin: 0, fontSize: "0.78rem", opacity: 0.65, fontStyle: "italic" }}>
          {rec.keyNotes}
        </p>
      )}
    </div>
  );
}

function DisclaimerList({
  disclaimers,
}: {
  disclaimers: readonly ComplianceDisclaimer[];
}): JSX.Element {
  return (
    <details
      style={{
        marginTop: "2rem",
        padding: "1rem",
        background: "#f9fafb",
        borderRadius: 6,
        fontSize: "0.78rem",
        color: "#6b7280",
      }}
    >
      <summary
        style={{
          fontWeight: 600,
          cursor: "pointer",
          fontSize: "0.82rem",
          color: "#374151",
          marginBottom: "0.5rem",
        }}
      >
        Important Disclaimers ({disclaimers.length} required notices)
      </summary>
      <ol style={{ margin: "0.75rem 0 0", paddingLeft: "1.25rem", lineHeight: 1.7 }}>
        {disclaimers.map((d) => (
          <li key={d.id} style={{ marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.7rem", fontWeight: 600, opacity: 0.55 }}>
              [{d.id}]{" "}
            </span>
            {d.text}
          </li>
        ))}
      </ol>
    </details>
  );
}

function RedSAlert(): JSX.Element {
  return (
    <div
      role="alert"
      style={{
        padding: "1rem 1.25rem",
        background: "#fef2f2",
        border: "1px solid #fca5a5",
        borderRadius: 8,
        marginBottom: "1.5rem",
      }}
    >
      <strong style={{ color: "#dc2626", fontSize: "0.9rem" }}>
        RED-S Risk Alert — Low Energy Availability
      </strong>
      <p style={{ margin: "0.35rem 0 0", fontSize: "0.82rem", color: "#7f1d1d" }}>
        Your current energy availability score is below the threshold associated with
        Relative Energy Deficiency in Sport (RED-S). Please discuss your overall energy
        intake with a registered sports dietitian or sports medicine physician before
        continuing your current training load.
      </p>
    </div>
  );
}

function PlanNotFound({ workoutId }: { workoutId: string }): JSX.Element {
  return (
    <section
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "3rem 1.5rem",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Workout Not Found</h1>
      <p style={{ opacity: 0.65 }}>
        No workout session found with ID <code>{workoutId}</code>.
      </p>
      <a href="/recommendations" style={{ color: "#2563eb" }}>
        ← Back to all recommendations
      </a>
    </section>
  );
}

export default async function WorkoutFuelingDetailPage({ params }: PageProps): Promise<JSX.Element> {
  const workoutId = params["workout-id"];
  const workoutInput = WORKOUT_REGISTRY[workoutId];

  if (!workoutInput) {
    return <PlanNotFound workoutId={workoutId} />;
  }

  let wrappedPlan: Awaited<ReturnType<typeof generateFuelingPlan>>;
  let error: string | null = null;

  try {
    wrappedPlan = await generateFuelingPlan(workoutInput);
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to generate fueling plan.";
    wrappedPlan = null as unknown as Awaited<ReturnType<typeof generateFuelingPlan>>;
  }

  if (error || !wrappedPlan) {
    return (
      <section
        style={{
          maxWidth: 760,
          margin: "0 auto",
          padding: "3rem 1.5rem",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Unable to Generate Plan</h1>
        <p style={{ color: "#dc2626" }}>{error}</p>
        <a href="/recommendations" style={{ color: "#2563eb" }}>
          ← Back to all recommendations
        </a>
      </section>
    );
  }

  const plan: WorkoutFuelingPlan = wrappedPlan.data;

  return (
    <section
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "3rem 1.5rem",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <nav style={{ marginBottom: "1.5rem" }}>
        <a href="/recommendations" style={{ color: "#2563eb", fontSize: "0.875rem" }}>
          ← All recommendations
        </a>
      </nav>

      <header style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0 }}>
          {formatWorkoutTypeLabel(plan.workoutType)} Fueling Plan
        </h1>
        <p style={{ margin: "0.4rem 0 0", opacity: 0.6, fontSize: "0.875rem" }}>
          {plan.durationMinutes} min · Energy Availability:{" "}
          <span
            style={{
              color:
                plan.eaLevel === "very_low"
                  ? "#dc2626"
                  : plan.eaLevel === "low"
                    ? "#d97706"
                    : "#059669",
              fontWeight: 500,
            }}
          >
            {formatEALevelLabel(plan.eaLevel)}
          </span>
        </p>
        <p style={{ margin: "0.35rem 0 0", opacity: 0.5, fontSize: "0.75rem" }}>
          {wrappedPlan.framingLabel} · Generated {new Date(plan.generatedAt).toLocaleString()}
        </p>
      </header>

      <div
        style={{
          marginBottom: "1.5rem",
          padding: "0.75rem 1rem",
          background: "#f0f4ff",
          borderLeft: "3px solid #2563eb",
          borderRadius: "0 6px 6px 0",
          fontSize: "0.8rem",
          color: "#374151",
        }}
      >
        {REQUIRED_DISCLAIMERS[0].text}
      </div>

      {plan.redSAlert && <RedSAlert />}

      <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "1rem", opacity: 0.75 }}>
        Phase-by-Phase Fueling Guidelines
      </h2>

      <PhaseCard rec={plan.pre} />
      {plan.intra && <PhaseCard rec={plan.intra} />}
      <PhaseCard rec={plan.post} />

      <DisclaimerList disclaimers={wrappedPlan.disclaimers} />
    </section>
  );
}
