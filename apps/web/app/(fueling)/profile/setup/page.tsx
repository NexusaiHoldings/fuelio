import type { JSX } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  upsertAthleteProfile,
  validateAthleteProfileInput,
  extractUserIdFromSessionToken,
} from "@/lib/fueling/athlete-profile";
import type { SportType, FitnessGoal } from "@/lib/fueling/athlete-profile";

const SPORT_OPTIONS: Array<{ value: SportType; label: string }> = [
  { value: "runner", label: "Runner" },
  { value: "cyclist", label: "Cyclist" },
  { value: "triathlete", label: "Triathlete" },
];

const FITNESS_GOAL_OPTIONS: Array<{ value: FitnessGoal; label: string }> = [
  { value: "performance_improvement", label: "Improve Performance" },
  { value: "endurance_building", label: "Build Endurance" },
  { value: "weight_management", label: "Manage Weight" },
  { value: "injury_prevention", label: "Prevent Injury" },
  { value: "recovery_optimization", label: "Optimize Recovery" },
];

async function handleSetupSubmit(formData: FormData): Promise<void> {
  "use server";

  const cookieStore = cookies();
  const token =
    cookieStore.get("session_token")?.value ??
    cookieStore.get("authjs.session-token")?.value ??
    cookieStore.get("__Secure-authjs.session-token")?.value;

  if (!token) {
    redirect("/api/auth/login");
  }

  const userId = extractUserIdFromSessionToken(token);
  if (!userId) {
    redirect("/api/auth/login");
  }

  const sportType = String(formData.get("sport_type") ?? "");
  const weeklyTrainingHours = Number(formData.get("weekly_training_hours"));
  const bodyWeightKg = Number(formData.get("body_weight_kg"));
  const fitnessGoals = formData.getAll("fitness_goals").map(String);

  const validationError = validateAthleteProfileInput(
    sportType,
    weeklyTrainingHours,
    bodyWeightKg,
    fitnessGoals,
  );

  if (validationError) {
    redirect(`/profile/setup?error=${encodeURIComponent(validationError)}`);
  }

  try {
    await upsertAthleteProfile({
      user_id: userId,
      sport_type: sportType as SportType,
      weekly_training_hours: weeklyTrainingHours,
      body_weight_kg: bodyWeightKg,
      fitness_goals: fitnessGoals as FitnessGoal[],
    });
  } catch {
    redirect(`/profile/setup?error=${encodeURIComponent("Failed to save profile. Please try again.")}`);
  }

  redirect("/profile/edit?saved=1");
}

export default function AthleteProfileSetupPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): JSX.Element {
  const rawError = searchParams.error;
  const errorMsg = Array.isArray(rawError) ? rawError[0] : rawError;

  return (
    <main style={{ maxWidth: 600, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.5rem" }}>
        Set Up Your Athlete Profile
      </h1>
      <p style={{ color: "#6b7280", marginBottom: "2rem", lineHeight: 1.6 }}>
        Tell us about your sport and training so we can calculate your personal
        Energy Availability (EA = Energy Intake &minus; Exercise EE &divide; Fat-Free Mass).
      </p>

      {errorMsg && (
        <div
          role="alert"
          style={{
            padding: "0.75rem 1rem",
            marginBottom: "1.5rem",
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            borderRadius: 6,
            color: "#dc2626",
            fontSize: "0.875rem",
          }}
        >
          {errorMsg}
        </div>
      )}

      <form
        action={handleSetupSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
      >
        <fieldset style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "1rem 1.25rem" }}>
          <legend style={{ fontWeight: 600, paddingInline: "0.25rem" }}>Sport Type</legend>
          <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
            {SPORT_OPTIONS.map(({ value, label }) => (
              <label
                key={value}
                style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}
              >
                <input type="radio" name="sport_type" value={value} required />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label
            htmlFor="weekly_training_hours"
            style={{ display: "block", fontWeight: 600, marginBottom: "0.375rem" }}
          >
            Weekly Training Hours
          </label>
          <input
            id="weekly_training_hours"
            name="weekly_training_hours"
            type="number"
            min={0}
            max={40}
            step={0.5}
            required
            placeholder="e.g. 10"
            style={{
              width: "100%",
              padding: "0.5rem 0.75rem",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              fontSize: "1rem",
              boxSizing: "border-box",
            }}
          />
          <p style={{ fontSize: "0.8125rem", color: "#9ca3af", marginTop: "0.25rem" }}>
            Average hours per week devoted to training (0–40)
          </p>
        </div>

        <div>
          <label
            htmlFor="body_weight_kg"
            style={{ display: "block", fontWeight: 600, marginBottom: "0.375rem" }}
          >
            Body Weight (kg)
          </label>
          <input
            id="body_weight_kg"
            name="body_weight_kg"
            type="number"
            min={30}
            max={300}
            step={0.1}
            required
            placeholder="e.g. 70.5"
            style={{
              width: "100%",
              padding: "0.5rem 0.75rem",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              fontSize: "1rem",
              boxSizing: "border-box",
            }}
          />
          <p style={{ fontSize: "0.8125rem", color: "#9ca3af", marginTop: "0.25rem" }}>
            Used to estimate Fat-Free Mass for the EA formula
          </p>
        </div>

        <fieldset style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "1rem 1.25rem" }}>
          <legend style={{ fontWeight: 600, paddingInline: "0.25rem" }}>
            Fitness Goals{" "}
            <span style={{ fontWeight: 400, color: "#9ca3af" }}>(select all that apply)</span>
          </legend>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem", marginTop: "0.5rem" }}>
            {FITNESS_GOAL_OPTIONS.map(({ value, label }) => (
              <label
                key={value}
                style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}
              >
                <input type="checkbox" name="fitness_goals" value={value} />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <button
          type="submit"
          style={{
            padding: "0.75rem 1.5rem",
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontSize: "1rem",
            fontWeight: 600,
            cursor: "pointer",
            alignSelf: "flex-start",
          }}
        >
          Save Profile &rarr;
        </button>
      </form>
    </main>
  );
}
