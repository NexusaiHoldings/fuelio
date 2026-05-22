"use client";

/**
 * /log — NLP meal logging entry point.
 * Athletes type a free-text meal description; the client posts to the
 * built-in Next.js API route at /api/fueling/parse and renders structured
 * nutrient data returned by Edamam / Nutritionix.
 */

import { useState, type JSX, type FormEvent } from "react";
import { parseMealDescription, applyManualOverride } from "@/lib/fueling/food-parser";
import { buildDailySummary } from "@/lib/fueling/nutrient-calculator";
import type { ParseResult, ManualNutrientOverride, ParsedFood } from "@/lib/fueling/food-parser";
import type { DailySummary } from "@/lib/fueling/nutrient-calculator";

interface LogState {
  parseResult: ParseResult | null;
  summary: DailySummary | null;
  error: string | null;
}

interface ManualFormState {
  show: boolean;
  name: string;
  quantity: string;
  unit: string;
  calories: string;
  protein_g: string;
  carbohydrates_g: string;
  fat_g: string;
  sodium_mg: string;
}

const EMPTY_MANUAL: ManualFormState = {
  show: false,
  name: "",
  quantity: "1",
  unit: "serving",
  calories: "",
  protein_g: "",
  carbohydrates_g: "",
  fat_g: "",
  sodium_mg: "",
};

async function runParseMeal(
  mealText: string,
  manualItems: ParsedFood[],
): Promise<{ parseResult: ParseResult; summary: DailySummary }> {
  const parseResult = await parseMealDescription(mealText);
  const allFoods = [...parseResult.foods, ...manualItems];
  const summary = buildDailySummary(allFoods);
  return { parseResult, summary };
}

export default function MealLogPage(): JSX.Element {
  const [mealText, setMealText] = useState("");
  const [logState, setLogState] = useState<LogState>({
    parseResult: null,
    summary: null,
    error: null,
  });
  const [manualItems, setManualItems] = useState<ParsedFood[]>([]);
  const [manualForm, setManualForm] = useState<ManualFormState>(EMPTY_MANUAL);
  const [isPending, setIsPending] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  function handleSubmit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    if (!mealText.trim() && manualItems.length === 0) return;
    setIsPending(true);

    runParseMeal(mealText, manualItems)
      .then((result) => {
        setLogState({ parseResult: result.parseResult, summary: result.summary, error: null });
      })
      .catch((err: unknown) => {
        setLogState((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : "An unexpected error occurred",
        }));
      })
      .finally(() => setIsPending(false));
  }

  function handleAddManual(): void {
    if (!manualForm.name || !manualForm.calories) return;

    const override: ManualNutrientOverride = {
      name: manualForm.name,
      quantity: parseFloat(manualForm.quantity) || 1,
      unit: manualForm.unit || "serving",
      calories: parseFloat(manualForm.calories) || 0,
      macronutrients: {
        protein_g: parseFloat(manualForm.protein_g) || 0,
        carbohydrates_g: parseFloat(manualForm.carbohydrates_g) || 0,
        fat_g: parseFloat(manualForm.fat_g) || 0,
        sodium_mg: parseFloat(manualForm.sodium_mg) || 0,
      },
    };

    setManualItems((prev) => [...prev, applyManualOverride(override)]);
    setManualForm(EMPTY_MANUAL);
  }

  function removeManualItem(idx: number): void {
    setManualItems((prev) => prev.filter((_, i) => i !== idx));
  }

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "2rem 1.5rem", fontFamily: "inherit" }}>
      <h1 style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>Log a Meal</h1>
      <p style={{ opacity: 0.65, marginBottom: "1.5rem", fontSize: "0.95rem" }}>
        Describe what you ate in plain text — e.g.{" "}
        <em>&quot;2 eggs, 1 cup oatmeal, banana&quot;</em> — and we&apos;ll break it into macros and calories.
      </p>

      <form onSubmit={handleSubmit} style={{ marginBottom: "2rem" }}>
        <label htmlFor="meal-text" style={{ display: "block", fontWeight: 600, marginBottom: "0.4rem" }}>
          What did you eat?
        </label>
        <textarea
          id="meal-text"
          value={mealText}
          onChange={(e) => setMealText(e.target.value)}
          placeholder="e.g. grilled chicken breast 200g, 1 cup brown rice, steamed broccoli"
          rows={4}
          style={{
            width: "100%",
            padding: "0.75rem",
            fontSize: "1rem",
            border: "1px solid #ccc",
            borderRadius: 6,
            resize: "vertical",
            boxSizing: "border-box",
          }}
        />

        {manualItems.length > 0 && (
          <div style={{ marginTop: "0.75rem" }}>
            <p style={{ fontWeight: 600, marginBottom: "0.3rem", fontSize: "0.9rem" }}>
              Manual items ({manualItems.length}):
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {manualItems.map((item, idx) => (
                <li
                  key={idx}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.35rem 0",
                    borderBottom: "1px solid #eee",
                    fontSize: "0.9rem",
                  }}
                >
                  <span>
                    {item.name} — {item.calories} kcal
                  </span>
                  <button
                    type="button"
                    onClick={() => removeManualItem(idx)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#c00", fontSize: "0.85rem" }}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem", flexWrap: "wrap" }}>
          <button
            type="submit"
            disabled={isPending || (!mealText.trim() && manualItems.length === 0)}
            style={{
              padding: "0.6rem 1.4rem",
              background: "#0070f3",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: "1rem",
              cursor: isPending ? "wait" : "pointer",
              opacity: isPending ? 0.7 : 1,
            }}
          >
            {isPending ? "Analyzing…" : "Analyze Meal"}
          </button>
          <button
            type="button"
            onClick={() => setManualForm((prev) => ({ ...prev, show: !prev.show }))}
            style={{
              padding: "0.6rem 1.4rem",
              background: "transparent",
              color: "#0070f3",
              border: "1px solid #0070f3",
              borderRadius: 6,
              fontSize: "1rem",
              cursor: "pointer",
            }}
          >
            {manualForm.show ? "Hide manual entry" : "+ Manual entry"}
          </button>
          <a
            href={`/log/${today}`}
            style={{
              padding: "0.6rem 1.4rem",
              background: "transparent",
              color: "#555",
              border: "1px solid #ccc",
              borderRadius: 6,
              fontSize: "1rem",
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            View today&apos;s log
          </a>
        </div>
      </form>

      {manualForm.show && (
        <section
          style={{
            background: "#f8f8f8",
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: "1.25rem",
            marginBottom: "1.75rem",
          }}
        >
          <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>Manual Nutrient Entry</h2>
          <p style={{ fontSize: "0.85rem", opacity: 0.7, marginBottom: "1rem" }}>
            Use this for gels, electrolyte products, or foods not found by the API.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            {(
              [
                { id: "m-name", label: "Food name *", key: "name", placeholder: "GU Roctane gel" },
                { id: "m-calories", label: "Calories (kcal) *", key: "calories", placeholder: "100", type: "number" },
                { id: "m-qty", label: "Quantity", key: "quantity", placeholder: "1", type: "number" },
                { id: "m-unit", label: "Unit", key: "unit", placeholder: "serving" },
                { id: "m-protein", label: "Protein (g)", key: "protein_g", placeholder: "0", type: "number" },
                { id: "m-carbs", label: "Carbohydrates (g)", key: "carbohydrates_g", placeholder: "22", type: "number" },
                { id: "m-fat", label: "Fat (g)", key: "fat_g", placeholder: "0", type: "number" },
                { id: "m-sodium", label: "Sodium (mg)", key: "sodium_mg", placeholder: "60", type: "number" },
              ] as Array<{ id: string; label: string; key: keyof ManualFormState; placeholder: string; type?: string }>
            ).map(({ id, label, key, placeholder, type }) => (
              <div key={id}>
                <label htmlFor={id} style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.2rem" }}>
                  {label}
                </label>
                <input
                  id={id}
                  type={type ?? "text"}
                  value={String(manualForm[key])}
                  onChange={(e) => setManualForm((prev) => ({ ...prev, [key]: e.target.value }))}
                  placeholder={placeholder}
                  style={{
                    width: "100%",
                    padding: "0.45rem 0.6rem",
                    border: "1px solid #ccc",
                    borderRadius: 4,
                    fontSize: "0.9rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleAddManual}
            disabled={!manualForm.name || !manualForm.calories}
            style={{
              marginTop: "1rem",
              padding: "0.5rem 1.2rem",
              background: "#28a745",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: "0.95rem",
              opacity: !manualForm.name || !manualForm.calories ? 0.5 : 1,
            }}
          >
            Add to log
          </button>
        </section>
      )}

      {logState.error && (
        <div
          role="alert"
          style={{
            background: "#fff5f5",
            border: "1px solid #f5c6cb",
            borderRadius: 6,
            padding: "1rem",
            color: "#721c24",
            marginBottom: "1.5rem",
          }}
        >
          <strong>Error:</strong> {logState.error}
        </div>
      )}

      {logState.parseResult && logState.summary && (
        <section>
          <h2 style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>Nutrient Breakdown</h2>

          {logState.parseResult.foods.length > 0 || manualItems.length > 0 ? (
            <>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "0.9rem",
                  marginBottom: "1.5rem",
                }}
              >
                <thead>
                  <tr style={{ background: "#f0f0f0" }}>
                    {["Food", "Qty", "Calories", "Protein", "Carbs", "Fat", "Source"].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "0.5rem 0.75rem",
                          textAlign: "left",
                          borderBottom: "2px solid #ddd",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...logState.parseResult.foods, ...manualItems].map((food, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: "0.45rem 0.75rem" }}>{food.name}</td>
                      <td style={{ padding: "0.45rem 0.75rem" }}>
                        {food.quantity} {food.unit}
                      </td>
                      <td style={{ padding: "0.45rem 0.75rem" }}>{food.calories} kcal</td>
                      <td style={{ padding: "0.45rem 0.75rem" }}>{food.macronutrients.protein_g.toFixed(1)}g</td>
                      <td style={{ padding: "0.45rem 0.75rem" }}>{food.macronutrients.carbohydrates_g.toFixed(1)}g</td>
                      <td style={{ padding: "0.45rem 0.75rem" }}>{food.macronutrients.fat_g.toFixed(1)}g</td>
                      <td style={{ padding: "0.45rem 0.75rem", fontSize: "0.8rem", opacity: 0.7 }}>
                        {food.source}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: "1rem",
                  background: "#f7f9ff",
                  border: "1px solid #dce8ff",
                  borderRadius: 8,
                  padding: "1.25rem",
                  marginBottom: "1.5rem",
                }}
              >
                {[
                  { label: "Calories", value: `${logState.summary.totals.calories} kcal` },
                  {
                    label: "Protein",
                    value: `${logState.summary.totals.protein_g}g (${logState.summary.macro_percentages.protein_pct}%)`,
                  },
                  {
                    label: "Carbohydrates",
                    value: `${logState.summary.totals.carbohydrates_g}g (${logState.summary.macro_percentages.carbohydrates_pct}%)`,
                  },
                  {
                    label: "Fat",
                    value: `${logState.summary.totals.fat_g}g (${logState.summary.macro_percentages.fat_pct}%)`,
                  },
                  { label: "Fiber", value: `${logState.summary.totals.fiber_g}g` },
                  { label: "Sodium", value: `${logState.summary.totals.sodium_mg}mg` },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div style={{ fontSize: "0.78rem", opacity: 0.6, marginBottom: "0.2rem" }}>{label}</div>
                    <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>{value}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <a
                  href={`/log/${today}`}
                  style={{
                    padding: "0.55rem 1.2rem",
                    background: "#0070f3",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    textDecoration: "none",
                    fontSize: "0.95rem",
                  }}
                >
                  View today&apos;s log
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setLogState({ parseResult: null, summary: null, error: null });
                    setMealText("");
                    setManualItems([]);
                  }}
                  style={{
                    padding: "0.55rem 1.2rem",
                    background: "transparent",
                    color: "#555",
                    border: "1px solid #ccc",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: "0.95rem",
                  }}
                >
                  Log another meal
                </button>
              </div>
            </>
          ) : (
            <div
              style={{
                padding: "1rem",
                background: "#fffbe6",
                border: "1px solid #ffe58f",
                borderRadius: 6,
                color: "#7d6608",
              }}
            >
              {logState.parseResult.error ?? "No food items could be parsed. Try the manual entry form below."}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
