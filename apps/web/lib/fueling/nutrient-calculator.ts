/**
 * Nutrient calculator — aggregates ParsedFood arrays into daily totals,
 * computes macro percentages, and calculates energy availability
 * (EA = (Energy Intake kcal - Exercise Energy Expenditure kcal) / Fat-Free Mass kg).
 *
 * Sports-science reference ranges:
 *   EA optimal: 45 kcal/kg FFM/day
 *   EA threshold for RED-S risk: < 30 kcal/kg FFM/day
 */

import type { ParsedFood, Macronutrients } from "./food-parser";

export interface NutrientTotals {
  calories: number;
  protein_g: number;
  carbohydrates_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  potassium_mg: number;
}

export interface MacroPercentages {
  protein_pct: number;
  carbohydrates_pct: number;
  fat_pct: number;
}

export interface EnergyAvailability {
  energy_intake_kcal: number;
  exercise_energy_expenditure_kcal: number;
  fat_free_mass_kg: number;
  ea_kcal_per_kg_ffm: number;
  status: "optimal" | "low" | "risk";
  status_label: string;
}

export interface DailySummary {
  totals: NutrientTotals;
  macro_percentages: MacroPercentages;
  food_count: number;
  energy_availability?: EnergyAvailability;
}

export interface MealSummary {
  meal_label: string;
  totals: NutrientTotals;
  food_count: number;
}

/**
 * Sum nutrient totals across an array of ParsedFood records.
 */
export function sumNutrients(foods: ParsedFood[]): NutrientTotals {
  const totals: NutrientTotals = {
    calories: 0,
    protein_g: 0,
    carbohydrates_g: 0,
    fat_g: 0,
    fiber_g: 0,
    sugar_g: 0,
    sodium_mg: 0,
    potassium_mg: 0,
  };

  for (const food of foods) {
    totals.calories += food.calories;
    totals.protein_g += food.macronutrients.protein_g;
    totals.carbohydrates_g += food.macronutrients.carbohydrates_g;
    totals.fat_g += food.macronutrients.fat_g;
    totals.fiber_g += food.macronutrients.fiber_g;
    totals.sugar_g += food.macronutrients.sugar_g;
    totals.sodium_mg += food.macronutrients.sodium_mg;
    totals.potassium_mg += food.macronutrients.potassium_mg;
  }

  return roundNutrients(totals);
}

function roundNutrients(t: NutrientTotals): NutrientTotals {
  return {
    calories: Math.round(t.calories),
    protein_g: Math.round(t.protein_g * 10) / 10,
    carbohydrates_g: Math.round(t.carbohydrates_g * 10) / 10,
    fat_g: Math.round(t.fat_g * 10) / 10,
    fiber_g: Math.round(t.fiber_g * 10) / 10,
    sugar_g: Math.round(t.sugar_g * 10) / 10,
    sodium_mg: Math.round(t.sodium_mg),
    potassium_mg: Math.round(t.potassium_mg),
  };
}

/**
 * Calculate macro contribution percentages from calories.
 * Protein: 4 kcal/g, Carbohydrates: 4 kcal/g, Fat: 9 kcal/g.
 */
export function calcMacroPercentages(totals: NutrientTotals): MacroPercentages {
  const proteinKcal = totals.protein_g * 4;
  const carbKcal = totals.carbohydrates_g * 4;
  const fatKcal = totals.fat_g * 9;
  const total = proteinKcal + carbKcal + fatKcal;

  if (total === 0) {
    return { protein_pct: 0, carbohydrates_pct: 0, fat_pct: 0 };
  }

  return {
    protein_pct: Math.round((proteinKcal / total) * 100),
    carbohydrates_pct: Math.round((carbKcal / total) * 100),
    fat_pct: Math.round((fatKcal / total) * 100),
  };
}

/**
 * Calculate Energy Availability (EA) using the sports-science formula:
 *   EA = (EI - EEE) / FFM
 * where EI = energy intake kcal, EEE = exercise energy expenditure kcal,
 * FFM = fat-free mass in kg.
 *
 * Status thresholds (De Souza et al., 2014):
 *   >= 45: optimal
 *   30–44: low (monitor)
 *   < 30: RED-S risk
 */
export function calcEnergyAvailability(
  energyIntakeKcal: number,
  exerciseEnergyExpenditureKcal: number,
  fatFreeMassKg: number,
): EnergyAvailability {
  if (fatFreeMassKg <= 0) {
    throw new Error("Fat-free mass must be greater than 0 kg");
  }

  const ea = (energyIntakeKcal - exerciseEnergyExpenditureKcal) / fatFreeMassKg;
  const rounded = Math.round(ea * 10) / 10;

  let status: EnergyAvailability["status"];
  let status_label: string;

  if (rounded >= 45) {
    status = "optimal";
    status_label = "Optimal energy availability";
  } else if (rounded >= 30) {
    status = "low";
    status_label = "Low energy availability — monitor intake";
  } else {
    status = "risk";
    status_label = "RED-S risk — consult your sports dietitian";
  }

  return {
    energy_intake_kcal: Math.round(energyIntakeKcal),
    exercise_energy_expenditure_kcal: Math.round(exerciseEnergyExpenditureKcal),
    fat_free_mass_kg: fatFreeMassKg,
    ea_kcal_per_kg_ffm: rounded,
    status,
    status_label,
  };
}

/**
 * Build a full daily nutrient summary from all foods logged on a given day.
 */
export function buildDailySummary(
  foods: ParsedFood[],
  exerciseEnergyExpenditureKcal?: number,
  fatFreeMassKg?: number,
): DailySummary {
  const totals = sumNutrients(foods);
  const macro_percentages = calcMacroPercentages(totals);

  let energy_availability: EnergyAvailability | undefined;
  if (
    exerciseEnergyExpenditureKcal !== undefined &&
    fatFreeMassKg !== undefined &&
    fatFreeMassKg > 0
  ) {
    energy_availability = calcEnergyAvailability(
      totals.calories,
      exerciseEnergyExpenditureKcal,
      fatFreeMassKg,
    );
  }

  return {
    totals,
    macro_percentages,
    food_count: foods.length,
    energy_availability,
  };
}

/**
 * Group foods by meal label and produce per-meal summaries.
 */
export function buildMealSummaries(
  meals: Array<{ label: string; foods: ParsedFood[] }>,
): MealSummary[] {
  return meals.map(({ label, foods }) => ({
    meal_label: label,
    totals: sumNutrients(foods),
    food_count: foods.length,
  }));
}

/**
 * Scale nutrients proportionally when quantity differs from reference.
 * E.g. scale a 100g reference to 150g.
 */
export function scaleNutrients(
  food: ParsedFood,
  newQuantity: number,
): ParsedFood {
  if (food.quantity <= 0) return food;
  const factor = newQuantity / food.quantity;

  const scaled: Macronutrients = {
    protein_g: food.macronutrients.protein_g * factor,
    carbohydrates_g: food.macronutrients.carbohydrates_g * factor,
    fat_g: food.macronutrients.fat_g * factor,
    fiber_g: food.macronutrients.fiber_g * factor,
    sugar_g: food.macronutrients.sugar_g * factor,
    sodium_mg: food.macronutrients.sodium_mg * factor,
    potassium_mg: food.macronutrients.potassium_mg * factor,
  };

  return {
    ...food,
    quantity: newQuantity,
    calories: Math.round(food.calories * factor),
    macronutrients: scaled,
  };
}

/**
 * Estimate carbohydrate needs for endurance training.
 * Returns recommended g/kg/day range based on training duration.
 */
export function carbRecommendationRange(trainingHoursPerDay: number): {
  min_g_per_kg: number;
  max_g_per_kg: number;
  label: string;
} {
  if (trainingHoursPerDay < 1) {
    return { min_g_per_kg: 3, max_g_per_kg: 5, label: "Low intensity / rest day" };
  } else if (trainingHoursPerDay < 3) {
    return { min_g_per_kg: 5, max_g_per_kg: 7, label: "Moderate endurance training" };
  } else if (trainingHoursPerDay < 5) {
    return { min_g_per_kg: 6, max_g_per_kg: 10, label: "High volume endurance training" };
  } else {
    return { min_g_per_kg: 8, max_g_per_kg: 12, label: "Extreme endurance / competition" };
  }
}
