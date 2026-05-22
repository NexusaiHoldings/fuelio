/**
 * Food parser — calls Edamam Nutrition Analysis API (primary) or Nutritionix API
 * (fallback) to convert free-text meal descriptions into structured nutrient data.
 *
 * Custom athlete foods (gels, electrolyte products) are resolved before hitting
 * external APIs so they never incur an API call and always return accurate data.
 */

export interface Macronutrients {
  protein_g: number;
  carbohydrates_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  potassium_mg: number;
}

export interface ParsedFood {
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  macronutrients: Macronutrients;
  source: "edamam" | "nutritionix" | "athlete_custom" | "manual";
}

export interface ManualNutrientOverride {
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  macronutrients: Partial<Macronutrients>;
}

export interface ParseResult {
  foods: ParsedFood[];
  raw_input: string;
  parsed_successfully: boolean;
  error?: string;
}

/**
 * Athlete custom foods database — covers gels, chews, and electrolyte products
 * not reliably found in standard nutrition databases.
 * Keyed by lowercase normalized name for fuzzy matching.
 */
const ATHLETE_CUSTOM_FOODS: Record<string, Omit<ParsedFood, "quantity" | "unit"> & { serving_size_g: number }> = {
  "gu energy gel": {
    name: "GU Energy Gel",
    calories: 100,
    serving_size_g: 32,
    source: "athlete_custom",
    macronutrients: {
      protein_g: 0,
      carbohydrates_g: 22,
      fat_g: 0,
      fiber_g: 0,
      sugar_g: 7,
      sodium_mg: 60,
      potassium_mg: 40,
    },
  },
  "gu gel": {
    name: "GU Energy Gel",
    calories: 100,
    serving_size_g: 32,
    source: "athlete_custom",
    macronutrients: {
      protein_g: 0,
      carbohydrates_g: 22,
      fat_g: 0,
      fiber_g: 0,
      sugar_g: 7,
      sodium_mg: 60,
      potassium_mg: 40,
    },
  },
  "clif shot gel": {
    name: "Clif Shot Energy Gel",
    calories: 100,
    serving_size_g: 34,
    source: "athlete_custom",
    macronutrients: {
      protein_g: 0,
      carbohydrates_g: 24,
      fat_g: 0,
      fiber_g: 0,
      sugar_g: 12,
      sodium_mg: 50,
      potassium_mg: 30,
    },
  },
  "maurten gel 100": {
    name: "Maurten Gel 100",
    calories: 100,
    serving_size_g: 40,
    source: "athlete_custom",
    macronutrients: {
      protein_g: 0,
      carbohydrates_g: 25,
      fat_g: 0,
      fiber_g: 0,
      sugar_g: 14,
      sodium_mg: 30,
      potassium_mg: 0,
    },
  },
  "maurten gel 160": {
    name: "Maurten Gel 160",
    calories: 160,
    serving_size_g: 40,
    source: "athlete_custom",
    macronutrients: {
      protein_g: 0,
      carbohydrates_g: 40,
      fat_g: 0,
      fiber_g: 0,
      sugar_g: 22,
      sodium_mg: 30,
      potassium_mg: 0,
    },
  },
  "nuun electrolyte tablet": {
    name: "Nuun Electrolyte Tablet",
    calories: 15,
    serving_size_g: 5,
    source: "athlete_custom",
    macronutrients: {
      protein_g: 0,
      carbohydrates_g: 4,
      fat_g: 0,
      fiber_g: 0,
      sugar_g: 1,
      sodium_mg: 300,
      potassium_mg: 150,
    },
  },
  "nuun tablet": {
    name: "Nuun Electrolyte Tablet",
    calories: 15,
    serving_size_g: 5,
    source: "athlete_custom",
    macronutrients: {
      protein_g: 0,
      carbohydrates_g: 4,
      fat_g: 0,
      fiber_g: 0,
      sugar_g: 1,
      sodium_mg: 300,
      potassium_mg: 150,
    },
  },
  "skratch hydration mix": {
    name: "Skratch Labs Sport Hydration Mix",
    calories: 80,
    serving_size_g: 22,
    source: "athlete_custom",
    macronutrients: {
      protein_g: 0,
      carbohydrates_g: 21,
      fat_g: 0,
      fiber_g: 0,
      sugar_g: 19,
      sodium_mg: 380,
      potassium_mg: 39,
    },
  },
  "scratch hydration": {
    name: "Skratch Labs Sport Hydration Mix",
    calories: 80,
    serving_size_g: 22,
    source: "athlete_custom",
    macronutrients: {
      protein_g: 0,
      carbohydrates_g: 21,
      fat_g: 0,
      fiber_g: 0,
      sugar_g: 19,
      sodium_mg: 380,
      potassium_mg: 39,
    },
  },
  "precision fuel gel": {
    name: "Precision Fuel & Hydration Gel",
    calories: 90,
    serving_size_g: 30,
    source: "athlete_custom",
    macronutrients: {
      protein_g: 0,
      carbohydrates_g: 22,
      fat_g: 0,
      fiber_g: 0,
      sugar_g: 10,
      sodium_mg: 120,
      potassium_mg: 0,
    },
  },
};

function normalizeKey(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
}

function lookupAthleteCustomFood(description: string): ParsedFood | null {
  const normalized = normalizeKey(description);
  for (const [key, food] of Object.entries(ATHLETE_CUSTOM_FOODS)) {
    if (normalized.includes(key)) {
      return {
        name: food.name,
        quantity: 1,
        unit: "serving",
        calories: food.calories,
        macronutrients: food.macronutrients,
        source: "athlete_custom",
      };
    }
  }
  return null;
}

interface EdamamNutrient {
  label: string;
  quantity: number;
  unit: string;
}

interface EdamamResponse {
  calories?: number;
  totalNutrients?: Record<string, EdamamNutrient>;
  ingredients?: Array<{
    text: string;
    parsed?: Array<{
      food: string;
      quantity: number;
      measure: string;
    }>;
  }>;
  error?: string;
}

async function parseWithEdamam(description: string): Promise<ParsedFood | null> {
  const appId = process.env.EDAMAM_APP_ID;
  const appKey = process.env.EDAMAM_APP_KEY;

  if (!appId || !appKey) {
    return null;
  }

  const url = new URL("https://api.edamam.com/api/nutrition-data");
  url.searchParams.set("app_id", appId);
  url.searchParams.set("app_key", appKey);
  url.searchParams.set("ingr", description);
  url.searchParams.set("nutrition-type", "logging");

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: { "Accept": "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const data: EdamamResponse = await response.json();

  if (data.error || !data.calories) {
    return null;
  }

  const nutrients = data.totalNutrients ?? {};

  const macros: Macronutrients = {
    protein_g: nutrients["PROCNT"]?.quantity ?? 0,
    carbohydrates_g: nutrients["CHOCDF"]?.quantity ?? 0,
    fat_g: nutrients["FAT"]?.quantity ?? 0,
    fiber_g: nutrients["FIBTG"]?.quantity ?? 0,
    sugar_g: nutrients["SUGAR"]?.quantity ?? 0,
    sodium_mg: nutrients["NA"]?.quantity ?? 0,
    potassium_mg: nutrients["K"]?.quantity ?? 0,
  };

  const ingredient = data.ingredients?.[0];
  const parsed = ingredient?.parsed?.[0];

  return {
    name: parsed?.food ?? description,
    quantity: parsed?.quantity ?? 1,
    unit: parsed?.measure ?? "serving",
    calories: Math.round(data.calories),
    macronutrients: macros,
    source: "edamam",
  };
}

interface NutritionixFood {
  food_name: string;
  serving_qty: number;
  serving_unit: string;
  nf_calories: number;
  nf_protein: number;
  nf_total_carbohydrate: number;
  nf_total_fat: number;
  nf_dietary_fiber: number;
  nf_sugars: number;
  nf_sodium: number;
  nf_potassium: number;
}

interface NutritionixResponse {
  foods?: NutritionixFood[];
}

async function parseWithNutritionix(description: string): Promise<ParsedFood | null> {
  const appId = process.env.NUTRITIONIX_APP_ID;
  const apiKey = process.env.NUTRITIONIX_API_KEY;

  if (!appId || !apiKey) {
    return null;
  }

  const response = await fetch("https://trackapi.nutritionix.com/v2/natural/nutrients", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-app-id": appId,
      "x-app-key": apiKey,
    },
    body: JSON.stringify({ query: description }),
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const data: NutritionixResponse = await response.json();

  if (!data.foods || data.foods.length === 0) {
    return null;
  }

  const food = data.foods[0];

  return {
    name: food.food_name,
    quantity: food.serving_qty,
    unit: food.serving_unit,
    calories: Math.round(food.nf_calories ?? 0),
    macronutrients: {
      protein_g: food.nf_protein ?? 0,
      carbohydrates_g: food.nf_total_carbohydrate ?? 0,
      fat_g: food.nf_total_fat ?? 0,
      fiber_g: food.nf_dietary_fiber ?? 0,
      sugar_g: food.nf_sugars ?? 0,
      sodium_mg: food.nf_sodium ?? 0,
      potassium_mg: food.nf_potassium ?? 0,
    },
    source: "nutritionix",
  };
}

/**
 * Parse a single food description into structured nutrient data.
 * Resolution order: athlete custom foods → Edamam → Nutritionix.
 */
export async function parseFoodDescription(description: string): Promise<ParsedFood | null> {
  const trimmed = description.trim();
  if (!trimmed) return null;

  const athleteFood = lookupAthleteCustomFood(trimmed);
  if (athleteFood) return athleteFood;

  try {
    const edamamResult = await parseWithEdamam(trimmed);
    if (edamamResult) return edamamResult;
  } catch {
    // fall through to Nutritionix
  }

  try {
    const nutritionixResult = await parseWithNutritionix(trimmed);
    if (nutritionixResult) return nutritionixResult;
  } catch {
    // both APIs failed
  }

  return null;
}

/**
 * Parse a free-text meal description (may contain multiple food items separated
 * by commas or newlines) into an array of ParsedFood records.
 */
export async function parseMealDescription(mealText: string): Promise<ParseResult> {
  const raw_input = mealText.trim();

  if (!raw_input) {
    return { foods: [], raw_input, parsed_successfully: false, error: "Empty input" };
  }

  const lines = raw_input
    .split(/[,\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const results = await Promise.all(lines.map(parseFoodDescription));

  const foods: ParsedFood[] = results.filter((f): f is ParsedFood => f !== null);

  if (foods.length === 0) {
    return {
      foods: [],
      raw_input,
      parsed_successfully: false,
      error: "Could not parse any food items. Check Edamam/Nutritionix API keys or try the manual entry form.",
    };
  }

  return { foods, raw_input, parsed_successfully: true };
}

/**
 * Apply a manual nutrient override — used when the API result is incorrect or
 * when the food is a proprietary product not covered by any database.
 */
export function applyManualOverride(override: ManualNutrientOverride): ParsedFood {
  const macros: Macronutrients = {
    protein_g: override.macronutrients.protein_g ?? 0,
    carbohydrates_g: override.macronutrients.carbohydrates_g ?? 0,
    fat_g: override.macronutrients.fat_g ?? 0,
    fiber_g: override.macronutrients.fiber_g ?? 0,
    sugar_g: override.macronutrients.sugar_g ?? 0,
    sodium_mg: override.macronutrients.sodium_mg ?? 0,
    potassium_mg: override.macronutrients.potassium_mg ?? 0,
  };

  return {
    name: override.name,
    quantity: override.quantity,
    unit: override.unit,
    calories: override.calories,
    macronutrients: macros,
    source: "manual",
  };
}
