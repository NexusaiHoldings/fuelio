/**
 * Fueling Recommendations — workout list page.
 *
 * Server component. Displays upcoming workouts with a link to view
 * AI-generated phase-specific fueling guidelines for each session.
 */

import type { JSX } from "react";
import { REQUIRED_DISCLAIMERS } from "@/lib/fueling/compliance-wrapper";
import { formatWorkoutTypeLabel, type WorkoutInput } from "@/lib/fueling/recommendations";

const DEMO_WORKOUTS: WorkoutInput[] = [
  {
    workoutId: "wk-001",
    workoutType: "endurance",
    durationMinutes: 120,
    scheduledAt: new Date(Date.now() + 86400000).toISOString(),
    intensityPercent: 65,
    athleteWeightKg: 70,
    eaScore: 42,
  },
  {
    workoutId: "wk-002",
    workoutType: "strength",
    durationMinutes: 60,
    scheduledAt: new Date(Date.now() + 2 * 86400000).toISOString(),
    intensityPercent: 80,
    athleteWeightKg: 70,
    eaScore: 42,
  },
  {
    workoutId: "wk-003",
    workoutType: "hiit",
    durationMinutes: 45,
    scheduledAt: new Date(Date.now() + 3 * 86400000).toISOString(),
    intensityPercent: 90,
    athleteWeightKg: 70,
    eaScore: 38,
  },
];

function formatScheduledAt(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function WorkoutCard({ workout }: { workout: WorkoutInput }): JSX.Element {
  const lowEA = workout.eaScore < 45;
  return (
    <div
      style={{
        border: lowEA ? "1px solid #e67e22" : "1px solid rgba(0,0,0,0.12)",
        borderRadius: 8,
        padding: "1.25rem 1.5rem",
        marginBottom: "1rem",
        background: lowEA ? "#fff8f2" : "#fff",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600 }}>
            {formatWorkoutTypeLabel(workout.workoutType)}
          </h3>
          <p style={{ margin: "0.25rem 0 0", opacity: 0.65, fontSize: "0.875rem" }}>
            {workout.durationMinutes} min · {workout.intensityPercent}% intensity ·{" "}
            {formatScheduledAt(workout.scheduledAt)}
          </p>
          {lowEA && (
            <p
              style={{
                margin: "0.5rem 0 0",
                color: "#e67e22",
                fontSize: "0.8rem",
                fontWeight: 500,
              }}
            >
              ⚠ Low energy availability ({workout.eaScore} kcal/kg FFM/day)
            </p>
          )}
        </div>
        <a
          href={`/recommendations/${workout.workoutId}`}
          style={{
            display: "inline-block",
            padding: "0.5rem 1rem",
            background: "#2563eb",
            color: "#fff",
            borderRadius: 6,
            textDecoration: "none",
            fontSize: "0.875rem",
            fontWeight: 500,
            whiteSpace: "nowrap",
          }}
        >
          View Fueling Plan →
        </a>
      </div>
    </div>
  );
}

export default function RecommendationsPage(): JSX.Element {
  return (
    <section
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "3rem 1.5rem",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <header style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0 }}>
          AI Workout-Phase Fueling Recommendations
        </h1>
        <p style={{ marginTop: "0.5rem", opacity: 0.7, fontSize: "0.95rem" }}>
          General fueling guidelines derived from published sports science consensus evidence.
          Select a session to view pre-workout, intra-workout, and recovery recommendations.
        </p>
        <div
          style={{
            marginTop: "1rem",
            padding: "0.75rem 1rem",
            background: "#f0f4ff",
            borderLeft: "3px solid #2563eb",
            borderRadius: "0 6px 6px 0",
            fontSize: "0.8rem",
            color: "#374151",
          }}
        >
          <strong>Important:</strong> {REQUIRED_DISCLAIMERS[0].text}
        </div>
      </header>

      <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "1rem", opacity: 0.8 }}>
        Upcoming Sessions
      </h2>

      {DEMO_WORKOUTS.map((workout) => (
        <WorkoutCard key={workout.workoutId} workout={workout} />
      ))}

      <footer
        style={{
          marginTop: "2.5rem",
          padding: "1rem",
          background: "#f9fafb",
          borderRadius: 6,
          fontSize: "0.75rem",
          color: "#6b7280",
          lineHeight: 1.6,
        }}
      >
        <strong>All {REQUIRED_DISCLAIMERS.length} regulatory disclaimers apply to every recommendation.</strong>{" "}
        This platform provides general fueling guidelines only — not individualized medical nutrition therapy.
        Consult a registered dietitian or sports medicine physician for personalized guidance.
      </footer>
    </section>
  );
}
