/**
 * /log/[date] — daily nutrition log for a specific date.
 *
 * Server component that fetches logged meals for the given date from the
 * database and renders a full-day nutrient breakdown with energy availability.
 *
 * Date format: YYYY-MM-DD  (ISO 8601 local date)
 */

import type { JSX } from "react";
import { notFound } from "next/navigation";
import { buildDailySummary, carbRecommendationRange } from "@/lib/fueling/nutrient-calculator";
import type { ParsedFood } from "@/lib/fueling/food-parser";

interface DailyLogPageProps {
  params: { date: string };
}

interface MealLogRow {
  id: string;
  meal_label: string;
  logged_at: string;
  foods_json: string;
}

async function fetchDailyLog(date: string): Promise<MealLogRow[]> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return [];
  }

  try {
    const { Pool: PgPool } = eval("require")("pg") as {
      Pool: new (cfg: { connectionString: string; max: number }) => {
        query: (sql: string, params: unknown[]) => Promise<{ rows: MealLogRow[] }>;
      };
    };
    const pool = new PgPool({ connectionString: databaseUrl, max: 5 });
    const startOfDay = `${date}T00:00:00.000Z`;
    const endOfDay = `${date}T23:59:59.999Z`;

    const result = await pool.query(
      `SELECT id, meal_label, logged_at, foods_json
       FROM fueling_meal_logs
       WHERE logged_at >= $1 AND logged_at <= $2
       ORDER BY logged_at ASC`,
      [startOfDay, endOfDay],
    );

    return result.rows;
  } catch {
    return [];
  }
}

function isValidDate(dateStr: string): boolean {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(dateStr)) return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
}

function formatDate(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

interface MacroBarProps {
  protein_pct: number;
  carbs_pct: number;
  fat_pct: number;
}

function MacroBar({ protein_pct, carbs_pct, fat_pct }: MacroBarProps): JSX.Element {
  return (
    <div
      style={{ display: "flex", height: 16, borderRadius: 8, overflow: "hidden", background: "#eee", margin: "0.5rem 0 1rem" }}
      role="img"
      aria-label={`Macros: ${protein_pct}% protein, ${carbs_pct}% carbohydrates, ${fat_pct}% fat`}
    >
      <div style={{ width: `${protein_pct}%`, background: "#3b82f6" }} title={`Protein ${protein_pct}%`} />
      <div style={{ width: `${carbs_pct}%`, background: "#f59e0b" }} title={`Carbs ${carbs_pct}%`} />
      <div style={{ width: `${fat_pct}%`, background: "#ec4899" }} title={`Fat ${fat_pct}%`} />
    </div>
  );
}

export default async function DailyLogPage({ params }: DailyLogPageProps): Promise<JSX.Element> {
  const { date } = params;

  if (!isValidDate(date)) {
    notFound();
  }

  const rows = await fetchDailyLog(date);

  const allFoods: ParsedFood[] = rows.flatMap((row) => {
    try {
      const parsed = JSON.parse(row.foods_json) as ParsedFood[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const summary = buildDailySummary(allFoods);
  const carbRec = carbRecommendationRange(1.5);

  const today = new Date().toISOString().split("T")[0];
  const isToday = date === today;

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "2rem 1.5rem", fontFamily: "inherit" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem", marginBottom: "0.5rem" }}>
        <h1 style={{ fontSize: "1.75rem", margin: 0 }}>
          {isToday ? "Today's Nutrition Log" : "Nutrition Log"}
        </h1>
        <a
          href="/log"
          style={{
            padding: "0.5rem 1.1rem",
            background: "#0070f3",
            color: "#fff",
            textDecoration: "none",
            borderRadius: 6,
            fontSize: "0.9rem",
          }}
        >
          + Log a meal
        </a>
      </div>

      <p style={{ opacity: 0.6, marginBottom: "1.75rem", fontSize: "0.95rem" }}>
        {formatDate(date)}
      </p>

      {allFoods.length === 0 ? (
        <div
          style={{
            padding: "2rem",
            textAlign: "center",
            background: "#fafafa",
            border: "1px dashed #ccc",
            borderRadius: 8,
            color: "#666",
          }}
        >
          <p style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>No meals logged yet.</p>
          <a href="/log" style={{ color: "#0070f3", textDecoration: "none" }}>
            Log your first meal for this day
          </a>
        </div>
      ) : (
        <>
          <section
            style={{
              background: "#f7f9ff",
              border: "1px solid #dce8ff",
              borderRadius: 8,
              padding: "1.5rem",
              marginBottom: "2rem",
            }}
          >
            <h2 style={{ fontSize: "1.15rem", margin: "0 0 1rem" }}>Daily Totals</h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                gap: "1rem",
                marginBottom: "1rem",
              }}
            >
              {[
                { label: "Calories", value: `${summary.totals.calories}`, unit: "kcal" },
                { label: "Protein", value: `${summary.totals.protein_g}`, unit: "g" },
                { label: "Carbohydrates", value: `${summary.totals.carbohydrates_g}`, unit: "g" },
                { label: "Fat", value: `${summary.totals.fat_g}`, unit: "g" },
                { label: "Fiber", value: `${summary.totals.fiber_g}`, unit: "g" },
                { label: "Sodium", value: `${summary.totals.sodium_mg}`, unit: "mg" },
              ].map(({ label, value, unit }) => (
                <div key={label}>
                  <div style={{ fontSize: "0.78rem", opacity: 0.6, marginBottom: "0.15rem" }}>{label}</div>
                  <div style={{ fontWeight: 700, fontSize: "1.2rem" }}>
                    {value}
                    <span style={{ fontWeight: 400, fontSize: "0.85rem", opacity: 0.7, marginLeft: "0.2rem" }}>{unit}</span>
                  </div>
                </div>
              ))}
            </div>

            <MacroBar
              protein_pct={summary.macro_percentages.protein_pct}
              carbs_pct={summary.macro_percentages.carbohydrates_pct}
              fat_pct={summary.macro_percentages.fat_pct}
            />

            <div style={{ display: "flex", gap: "1.5rem", fontSize: "0.82rem", opacity: 0.75 }}>
              <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#3b82f6", display: "inline-block" }} />
                Protein {summary.macro_percentages.protein_pct}%
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b", display: "inline-block" }} />
                Carbs {summary.macro_percentages.carbohydrates_pct}%
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ec4899", display: "inline-block" }} />
                Fat {summary.macro_percentages.fat_pct}%
              </span>
            </div>
          </section>

          <section style={{ marginBottom: "2rem" }}>
            <h2 style={{ fontSize: "1.15rem", marginBottom: "1rem" }}>Meals ({rows.length})</h2>

            {rows.map((row) => {
              let foods: ParsedFood[] = [];
              try {
                foods = JSON.parse(row.foods_json) as ParsedFood[];
              } catch {
                foods = [];
              }

              const mealCalories = foods.reduce((sum, f) => sum + f.calories, 0);
              const mealProtein = foods.reduce((sum, f) => sum + f.macronutrients.protein_g, 0);
              const mealCarbs = foods.reduce((sum, f) => sum + f.macronutrients.carbohydrates_g, 0);
              const mealFat = foods.reduce((sum, f) => sum + f.macronutrients.fat_g, 0);

              const loggedAt = new Date(row.logged_at).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div
                  key={row.id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    padding: "1rem 1.25rem",
                    marginBottom: "1rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                    <span style={{ fontWeight: 600 }}>{row.meal_label || "Meal"}</span>
                    <span style={{ fontSize: "0.82rem", opacity: 0.6 }}>{loggedAt}</span>
                  </div>

                  <div style={{ display: "flex", gap: "1.25rem", fontSize: "0.88rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
                    <span>{Math.round(mealCalories)} kcal</span>
                    <span>P: {mealProtein.toFixed(1)}g</span>
                    <span>C: {mealCarbs.toFixed(1)}g</span>
                    <span>F: {mealFat.toFixed(1)}g</span>
                  </div>

                  {foods.length > 0 && (
                    <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: "0.85rem", opacity: 0.75 }}>
                      {foods.map((food, fi) => (
                        <li key={fi} style={{ padding: "0.2rem 0" }}>
                          {food.name} — {food.calories} kcal
                          {food.source === "manual" && (
                            <span
                              style={{
                                marginLeft: "0.4rem",
                                fontSize: "0.75rem",
                                background: "#e5e7eb",
                                borderRadius: 3,
                                padding: "0 0.3rem",
                              }}
                            >
                              manual
                            </span>
                          )}
                          {food.source === "athlete_custom" && (
                            <span
                              style={{
                                marginLeft: "0.4rem",
                                fontSize: "0.75rem",
                                background: "#dbeafe",
                                borderRadius: 3,
                                padding: "0 0.3rem",
                                color: "#1d4ed8",
                              }}
                            >
                              athlete
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </section>

          <section
            style={{
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: 8,
              padding: "1.25rem",
            }}
          >
            <h2 style={{ fontSize: "1.05rem", margin: "0 0 0.75rem" }}>Carbohydrate Guidance</h2>
            <p style={{ fontSize: "0.9rem", margin: "0 0 0.4rem" }}>
              <strong>Recommendation for moderate training:</strong>{" "}
              {carbRec.min_g_per_kg}–{carbRec.max_g_per_kg} g/kg body weight/day
            </p>
            <p style={{ fontSize: "0.82rem", opacity: 0.7, margin: 0 }}>
              {carbRec.label}. Log your body weight and training hours in your profile to get a personalised target.
            </p>
          </section>
        </>
      )}
    </main>
  );
}
