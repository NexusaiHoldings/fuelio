/**
 * Sports nutrition education module access control and progress tracking.
 *
 * Six modules gated behind paid subscription tier per CEO briefing mvp_scope:
 * "paywall unlocking the 6-module sports fueling education course."
 * Content authored by consulting RD; reviewed for FTC/FDA health claims
 * compliance per regulatory_risk key_regulations.
 */

import { buildDb } from "@/lib/db";
import { buildEventBus } from "@/lib/events";
import { handleSession } from "@nexus/identity-and-access";
import { cookies } from "next/headers";

export interface Lesson {
  slug: string;
  title: string;
  description: string;
  content: string;
  durationMinutes: number;
  order: number;
}

export interface Module {
  slug: string;
  title: string;
  description: string;
  lessons: Lesson[];
  order: number;
}

export interface LessonProgress {
  moduleSlug: string;
  lessonSlug: string;
  completedAt: string;
}

export interface SessionUser {
  user_id: string;
  email: string;
  session_id: string;
  expires_at: string;
}

export const EDUCATION_MODULES: readonly Module[] = [
  {
    slug: "pre-workout-fueling",
    title: "Pre-Workout Fueling",
    description:
      "Evidence-based strategies for fueling your body before training and competition to maximize performance and delay fatigue.",
    order: 1,
    lessons: [
      {
        slug: "timing-and-composition",
        title: "Timing and Composition",
        description:
          "Learn how the timing and macronutrient composition of pre-workout meals affect energy availability and exercise performance.",
        durationMinutes: 30,
        order: 1,
        content: `## Timing and Composition of Pre-Workout Nutrition

Consuming carbohydrates 1–4 hours before exercise is well-supported by sports science. A general framework based on research:

**3–4 hours before training:**
Consume a full mixed meal containing 1–4 g of carbohydrate per kg body weight, moderate protein (0.3–0.5 g/kg), and low fat and fiber to support digestion.

**1–2 hours before training:**
A smaller carbohydrate-rich snack (0.5–1 g/kg) with minimal fat, fiber, and protein. Examples include a banana with a small serving of peanut butter, or a sports energy bar.

**30–60 minutes before training:**
Easily digested carbohydrates (30–60 g) if hunger arises or if the prior meal was small. Options include a piece of fruit, sports gel, or white bread with jam.

### Key Principles

- **Carbohydrate is primary fuel**: Muscle glycogen and blood glucose are the predominant fuels for moderate-to-high intensity exercise. Carbohydrate availability directly impacts performance.
- **Individualize timing**: Gastrointestinal tolerance varies. Practice your pre-workout nutrition routine in training before competition.
- **Protein matters**: Including 20–30 g of protein pre-workout supports muscle protein synthesis and can reduce exercise-induced muscle damage.
- **Hydration**: Begin exercise euhydrated. Aim for pale yellow urine as a practical indicator.

### Practical Application

For a 70 kg endurance athlete training at 7:00 AM:
- **4:00 AM option**: Oatmeal (80 g dry oats) with banana, milk, and eggs = ~120 g carbohydrate, 30 g protein
- **6:00 AM option**: Toast (2 slices) with jam and a banana = ~60 g carbohydrate
- **6:30 AM option**: Energy gel or 30 g of gummy chews = 25–30 g carbohydrate

*This information is for educational purposes. Individual needs vary. Consult a Registered Dietitian for personalized guidance.*`,
      },
      {
        slug: "carbohydrate-needs-before-training",
        title: "Carbohydrate Needs Before Training",
        description:
          "Understand how to calculate and meet your individual carbohydrate requirements based on training intensity and duration.",
        durationMinutes: 25,
        order: 2,
        content: `## Carbohydrate Needs Before Training

### Why Carbohydrates Are Central

Muscle and liver glycogen provide the bulk of fuel during moderate-to-high intensity exercise (>60% VO2max). Starting exercise with full glycogen stores delays fatigue and supports power output throughout the session.

### Calculating Your Needs

Carbohydrate requirements scale with body weight and training load:

| Training Duration | Pre-Exercise CHO Target |
|---|---|
| < 60 minutes (low intensity) | 1–2 g/kg body weight |
| 60–90 minutes (moderate) | 2–3 g/kg body weight |
| > 90 minutes (high intensity) | 3–4 g/kg body weight |
| Competition day | 4–6 g/kg in the 24 h before + 1–4 g/kg 1–4 h before |

### Food Sources

High-quality pre-workout carbohydrate sources:
- **Oats** — slow-releasing, rich in beta-glucan, good for 3–4 h pre-workout window
- **White rice and pasta** — rapid glycogen replenishment, low fiber
- **Bananas** — convenient, portable, mid-glycemic index
- **Sports drinks and gels** — fast-acting for last 30–60 min window
- **Bread and bagels** — practical, portable, calorie-dense

### Common Mistakes

1. **Under-fueling before long sessions** — causes early glycogen depletion and "hitting the wall"
2. **High-fiber or high-fat foods close to exercise** — slows gastric emptying, increases GI distress risk
3. **Skipping pre-workout carbohydrates** — reduces performance by up to 7–8% in endurance events

*This information is for educational purposes only and is not intended as medical advice.*`,
      },
      {
        slug: "pre-event-meal-planning",
        title: "Pre-Event Meal Planning",
        description:
          "Build a personalized pre-competition meal plan that supports optimal race-day fueling without gastrointestinal distress.",
        durationMinutes: 20,
        order: 3,
        content: `## Pre-Event Meal Planning

### The Race-Day Challenge

Competition day nutrition adds pressure: unfamiliar venues, early start times, nerves affecting digestion, and the consequence of getting it wrong. A pre-practiced, individualized plan removes guesswork.

### Core Principles for Race-Day Meals

1. **Use foods you have practiced with** — never try new foods on race day
2. **Prioritize digestibility** — low fat, low fiber, moderate protein
3. **Adequate carbohydrates** — 1–4 g/kg depending on timing and event duration
4. **Moderate caffeine** — 3–6 mg/kg body weight 60 minutes before performance can improve endurance (~3% improvement); verify your tolerance in training
5. **Fluid intake** — 5–10 mL/kg water 2–4 hours before; stop 1 hour before to avoid bladder discomfort

### Sample Race-Day Meal Templates

**Marathon / Long-Distance Triathlon (>3 hours)**
- 3–4 hours before: 400–600 mL water + 2 cups oatmeal with honey, banana, and whey protein
- 1 hour before: 250 mL sports drink + energy bar (40 g CHO)
- 15 min before: 1 energy gel + 150 mL water

**Cycling Road Race (2–4 hours)**
- 3 hours before: White rice (300 g cooked) + grilled chicken breast + 500 mL electrolyte drink
- 30 min before: Energy gel + 200 mL water

**High-Intensity Interval Training (60–90 min)**
- 2 hours before: Banana + Greek yogurt + granola + 400 mL water
- 30 min before: Optional energy gel or sports drink if needed

### Practical Tips

- Prepare your race-day food the night before to reduce morning stress
- Keep backup options (gels, bars) in your kit bag for delays
- Practice the entire pre-race nutrition strategy in at least two training sessions before a major event

*Consult a sports Registered Dietitian for individualized race-day planning.*`,
      },
    ],
  },
  {
    slug: "intra-workout-nutrition",
    title: "Intra-Workout Nutrition",
    description:
      "Strategies for fueling and hydrating during training and competition to sustain performance and delay fatigue.",
    order: 2,
    lessons: [
      {
        slug: "fueling-the-endurance-athlete",
        title: "Fueling the Endurance Athlete",
        description:
          "Understand when and why intra-workout carbohydrate intake becomes critical for performance.",
        durationMinutes: 30,
        order: 1,
        content: `## Fueling the Endurance Athlete During Exercise

### When Does In-Exercise Fueling Matter?

For exercise lasting less than 45–60 minutes, well-fed athletes do not require carbohydrates during exercise. As duration increases, exogenous carbohydrate becomes progressively more important:

| Duration | Intra-Workout CHO Recommendation |
|---|---|
| < 45 min | Not required |
| 45–75 min | Optional; rinsing mouth with CHO solution may help |
| 1–2 hours | 30–60 g/hour |
| 2–3 hours | 60–90 g/hour |
| > 3 hours | Up to 90 g/hour (multiple transporters) |

### Why Carbohydrates During Exercise?

1. **Glycogen sparing** — exogenous glucose reduces the rate of muscle glycogen use
2. **Blood glucose maintenance** — prevents hypoglycemia in prolonged sessions
3. **CNS fueling** — the brain relies on glucose; maintaining blood glucose supports focus and pacing decisions
4. **Performance** — studies consistently show improved time-trial performance with in-exercise carbohydrate vs. placebo

### Practical Delivery Methods

- **Sports drinks** (6–8% CHO concentration) — provide fluid and carbohydrate simultaneously; ideal for activities < 2 hours
- **Energy gels** — concentrated CHO (20–25 g per gel); require water co-ingestion to prevent GI distress
- **Chews/blocks** — similar to gels but chewable; personal preference
- **Real food** — bananas, dates, rice cakes work well for lower-intensity longer events (cycling, ultra-distance)
- **Combination** — multiple carbohydrate sources (glucose + fructose) allow higher absorption rates at 90 g/hour

### Gastrointestinal Tolerance

GI distress is the primary limiter for in-exercise fueling. Mitigation strategies:
- Train the gut: progressively increase carbohydrate intake across training sessions
- Use familiar products from training
- Consume smaller amounts more frequently (every 15–20 min) vs. large bolus doses
- Start fueling early — do not wait until you feel depleted

*This content is educational. Individual responses vary significantly.*`,
      },
      {
        slug: "carbohydrate-delivery-and-formulation",
        title: "Carbohydrate Delivery and Formulation",
        description:
          "Compare carbohydrate types, transport mechanisms, and product formulations for optimal in-exercise absorption.",
        durationMinutes: 25,
        order: 2,
        content: `## Carbohydrate Delivery and Formulation

### Carbohydrate Transport in the Gut

The small intestine absorbs carbohydrates via transporter proteins. Understanding these transporters explains why carbohydrate blends outperform single sources at high intake rates:

| Transporter | Substrate | Max Absorption Rate |
|---|---|---|
| SGLT1 | Glucose, galactose | ~60 g/hour |
| GLUT5 | Fructose | ~30 g/hour |
| GLUT2 | Glucose, fructose | Overflow capacity |

Using glucose + fructose in a ~1:0.8 ratio saturates both SGLT1 and GLUT5, enabling absorption up to 90 g/hour without increasing GI distress.

### Comparing Carbohydrate Sources

**Maltodextrin**
- Polymer of glucose; lower osmolality than glucose alone
- Empties from stomach faster, reducing GI distress
- Common in sports gels and drinks

**Glucose (dextrose)**
- Rapidly absorbed; high glycemic index
- Used in most sports drinks

**Fructose**
- Absorbed via GLUT5; liver converts to glucose
- Alone it can cause GI distress; blended with glucose it enables higher total absorption

**Sucrose**
- Glucose + fructose; naturally 1:1 ratio
- Effective, inexpensive; used in some gels and drinks

**Isomaltulose**
- Slower-releasing form of sucrose; may suit lower-intensity events

### Selecting Products

For sessions 60–90 min: glucose-based drink or gel (30–60 g/hour)
For sessions > 2 hours: glucose + fructose blend (60–90 g/hour)
For ultra-events > 4 hours: real food combinations tolerated individually

*All figures represent general research-based averages. Individual tolerance varies.*`,
      },
      {
        slug: "electrolyte-management-during-exercise",
        title: "Electrolyte Management During Exercise",
        description:
          "Learn how electrolyte losses during exercise affect performance and how to replace them effectively.",
        durationMinutes: 20,
        order: 3,
        content: `## Electrolyte Management During Exercise

### Why Electrolytes Matter

Sweat contains water, sodium, chloride, potassium, magnesium, and calcium. Sodium loss is the most significant electrolyte concern during endurance exercise because:
- Sodium drives fluid retention and distribution
- Large sodium deficits (hyponatremia) cause nausea, confusion, and in severe cases seizure
- Individual sweat sodium concentration ranges from ~200–2000 mg/L, making individualization important

### Key Electrolytes and Their Roles

| Electrolyte | Role | Average Sweat Loss |
|---|---|---|
| Sodium | Fluid balance, nerve conduction | 500–1500 mg/hour |
| Potassium | Muscle contraction, heart rhythm | 150–400 mg/hour |
| Magnesium | Enzyme function, muscle relaxation | 10–50 mg/hour |
| Calcium | Muscle contraction, bone health | 20–80 mg/hour |

### Sodium Replacement Guidelines

- **< 1 hour**: Not required for most athletes; water sufficient
- **1–3 hours**: 500–1000 mg sodium/hour from sports drinks, salt capsules, or salty foods
- **> 3 hours**: 1000–2000 mg sodium/hour in hot/humid conditions; individual sweat testing recommended

### Signs of Electrolyte Imbalance

- **Cramping** — multifactorial but sodium/magnesium deficits and fatigue are common contributors
- **Headache, nausea, swollen hands** — signs of hyponatremia (over-hydration + sodium deficit); do not drink water alone in ultra-events
- **Muscle weakness, irregular heartbeat** — severe electrolyte disturbance; seek medical attention

### Product Selection

Look for sports drinks providing 300–700 mg sodium per 500 mL. Salt capsules (200–300 mg sodium each) allow flexible supplementation without excess carbohydrates.

*This content is for educational purposes. Sweat testing with an accredited sports dietitian provides the most accurate individualized electrolyte plan.*`,
      },
    ],
  },
  {
    slug: "recovery-fueling",
    title: "Recovery Fueling",
    description:
      "Optimize post-exercise nutrition to accelerate glycogen restoration, support muscle repair, and prepare for the next training session.",
    order: 3,
    lessons: [
      {
        slug: "the-recovery-window-explained",
        title: "The Recovery Window Explained",
        description:
          "Understand the science behind the post-exercise recovery window and why nutrient timing matters for adaptation.",
        durationMinutes: 25,
        order: 1,
        content: `## The Recovery Window Explained

### What Is the Recovery Window?

The "recovery window" refers to the enhanced sensitivity of skeletal muscle to nutrient uptake in the period immediately following exercise. During this window:

- GLUT4 transporters are upregulated, increasing glucose uptake independent of insulin
- Muscle protein synthesis (MPS) is elevated
- Glycogen synthase activity is highest, facilitating rapid glycogen resynthesis

### Research Context

Early research suggested a narrow 30–45 minute "anabolic window" where nutrient timing was critical. More recent meta-analyses (Schoenfeld & Aragon, 2013; 2018) suggest the window is broader:

- For **glycogen restoration** (especially with < 8 hours between sessions), consuming carbohydrates within 30–60 minutes remains important
- For **muscle protein synthesis**, total daily protein intake matters more than exact timing; however, consuming 20–40 g of protein within 2 hours post-exercise is pragmatically effective
- The window is most critical when athletes train twice daily or have < 8 hours recovery time

### Practical Takeaways

1. **Prioritize recovery nutrition after hard or long sessions** (> 60 min moderate-to-high intensity)
2. **A combined carbohydrate + protein snack within 30–60 minutes** is the gold-standard approach
3. **Follow with a balanced meal within 2 hours** to continue the recovery process
4. **For lower-intensity sessions**, the window matters less; a regular meal within 2–3 hours is adequate

*This information is educational. Evidence continues to evolve; consult a sports Registered Dietitian for individualized plans.*`,
      },
      {
        slug: "protein-for-muscle-repair",
        title: "Protein for Muscle Repair",
        description:
          "Learn evidence-based protein targets, sources, and strategies for maximizing muscle protein synthesis after training.",
        durationMinutes: 30,
        order: 2,
        content: `## Protein for Muscle Repair

### Why Protein Post-Exercise?

Exercise — particularly resistance training but also endurance exercise — causes muscle protein breakdown (MPB). Recovery requires a positive net protein balance: muscle protein synthesis (MPS) must exceed MPB. Dietary protein provides the amino acids necessary to support MPS.

### Evidence-Based Protein Targets

**Per-dose protein for maximizing MPS:**
- 0.3–0.4 g/kg body weight per meal, approximately every 3–4 hours
- For a 70 kg athlete: ~21–28 g per meal
- Leucine threshold: ~2–3 g of leucine per dose is needed to maximally stimulate MPS; found in ~25 g of whey or ~35 g of soy protein

**Daily protein targets for athletes:**
- Endurance athletes: 1.4–1.7 g/kg/day
- Strength/power athletes: 1.6–2.0 g/kg/day
- Athletes in caloric deficit: up to 2.3–3.1 g/kg of lean body mass/day to preserve muscle

### Protein Quality

Not all proteins are equal. Ranking by leucine content and digestibility:

1. **Whey protein** — fast-digesting, high leucine; ideal post-workout
2. **Milk/casein** — slow-digesting; effective for overnight recovery
3. **Eggs** — complete amino acid profile; moderate digestion rate
4. **Meat, poultry, fish** — complete proteins; varying digestion rates
5. **Soy protein** — complete; slightly lower leucine than whey but effective
6. **Pea, rice protein blends** — individually incomplete; combined they approach whey in MPS response

### Post-Workout Protein Sources

- Chocolate milk (classic endurance recovery drink: carbohydrate + protein)
- Greek yogurt + fruit
- Grilled chicken or salmon + rice
- Whey protein shake + banana
- Cottage cheese + berries (casein; good for evening recovery)

*Individual protein needs vary with training status, age, and goals. This is educational information only.*`,
      },
      {
        slug: "glycogen-resynthesis-strategies",
        title: "Glycogen Resynthesis Strategies",
        description:
          "Master the nutrition strategies that accelerate glycogen replenishment between training sessions.",
        durationMinutes: 20,
        order: 3,
        content: `## Glycogen Resynthesis Strategies

### Why Glycogen Resynthesis Matters

Inadequate glycogen restoration between training sessions leads to progressive glycogen depletion, reducing training quality over time. For athletes with two sessions per day or consecutive high-volume days, rapid resynthesis is essential.

### Rate of Resynthesis

Normal rate: ~5% per hour without intervention
Optimal rate with aggressive carbohydrate feeding: ~5–8% per hour

**Maximum resynthesis rate:** ~0.5 g of carbohydrate per kg body weight per hour in the first 4–6 hours post-exercise.

For a 70 kg athlete: ~35 g CHO per hour = 140 g in the first 4 hours.

### Key Strategies

**1. Consume carbohydrates immediately post-exercise**
GLUT4 upregulation and elevated glycogen synthase activity peak in the first 30–60 minutes. Start with 1.0–1.2 g/kg CHO within 30 minutes.

**2. Continue feeding over 4–6 hours**
Rate of resynthesis slows after 4–6 hours but continues. Aim for 1–1.2 g/kg/hour during this window.

**3. High-glycemic index carbohydrates resynthesized faster**
White rice, sports drinks, and refined carbohydrates support faster initial resynthesis vs. lower-GI foods. Reserve lower-GI foods for later meals.

**4. Combine protein with carbohydrate**
Adding 0.2–0.4 g/kg protein to carbohydrate post-exercise stimulates insulin secretion and modestly improves glycogen resynthesis rate (~30 min earlier return to baseline).

### Practical Template (70 kg athlete, 8h between sessions)

- **0–30 min**: 500 mL chocolate milk + banana
- **2 hours**: Large pasta meal (120 g dry pasta) + lean protein + vegetables
- **4 hours**: Snack: rice cakes + peanut butter + banana
- **Before session 2**: 30–60 g fast-digesting carbohydrate

*Adapt quantities to your body weight and energy expenditure. This is educational, not personalized medical advice.*`,
      },
    ],
  },
  {
    slug: "carbohydrate-periodization",
    title: "Carbohydrate Periodization",
    description:
      "Advanced strategies for strategically varying carbohydrate intake to optimize both training adaptation and competition performance.",
    order: 4,
    lessons: [
      {
        slug: "train-low-compete-high-principles",
        title: "Train Low, Compete High Principles",
        description:
          "Understand the science and application of training with low glycogen availability to enhance metabolic adaptations.",
        durationMinutes: 35,
        order: 1,
        content: `## Train Low, Compete High Principles

### What Is Train Low?

"Train low" refers to deliberately completing some training sessions with reduced carbohydrate availability — either low muscle glycogen, low liver glycogen, or low circulating glucose. The hypothesis is that training with reduced carbohydrate availability amplifies adaptive signaling pathways, enhancing fat oxidation capacity and mitochondrial biogenesis.

### Mechanisms

Key signaling molecules upregulated during train-low sessions:
- **AMPK (AMP-activated protein kinase)** — activated by low energy status; stimulates mitochondrial biogenesis via PGC-1α
- **p38 MAPK** — stress-responsive kinase; contributes to training adaptation signaling
- **Fat oxidation enzymes** — increased capacity to oxidize fat at a given exercise intensity

### Evidence

Studies show that training low:
- Increases fat oxidation capacity at submaximal intensities
- Enhances mitochondrial enzyme activities (citrate synthase, β-HAD)
- Does NOT consistently improve exercise performance vs. always training with adequate carbohydrate

The key nuance: enhanced fat oxidation ≠ improved performance. Performance requires glycogen availability. Train low can improve metabolic flexibility but should not replace high-carbohydrate competition fueling.

### Train Low Protocols

**Twice-a-day training:** Deplete glycogen in morning session; train afternoon/evening in glycogen-depleted state without carbohydrate recovery between sessions.

**Fasted training:** Train before breakfast (liver glycogen depleted after overnight fast); suitable for low-to-moderate intensity sessions only.

**Sleep low:** Evening glycogen-depleting session → sleep without carbohydrate recovery → morning low-intensity fasted session.

### Practical Cautions

- Train low should account for no more than 30–40% of total training volume
- High-intensity sessions (threshold, VO2max, race simulation) should NEVER be done low — performance compromise and injury risk increase
- Monitor for signs of RED-S (see Module 6) with train-low approaches

*This advanced strategy should be implemented with guidance from a sports dietitian.*`,
      },
      {
        slug: "periodization-for-performance",
        title: "Periodization for Performance",
        description:
          "Learn how to align carbohydrate intake with training phase to peak for competition.",
        durationMinutes: 30,
        order: 2,
        content: `## Periodization for Performance

### What Is Carbohydrate Periodization?

Carbohydrate periodization systematically varies carbohydrate intake across training cycles to match the specific demands of each training phase. This contrasts with eating the same carbohydrate amount every day regardless of training load.

### The Training Year Framework

**Base/General Preparation Phase:**
- Moderate training volume, low-to-moderate intensity
- Carbohydrate: 5–7 g/kg/day
- Include some train-low sessions (fasted, twice-daily) to build metabolic flexibility

**Build/Specific Preparation Phase:**
- Increasing volume and intensity
- Carbohydrate: 7–10 g/kg/day on key session days
- Daily fueling should match session demands; high carbohydrate on high-intensity days

**Taper/Competition Phase:**
- Reduce training volume; increase intensity
- Carbohydrate: 8–12 g/kg/day (carbohydrate loading in final 2–3 days)
- Focus on high-carbohydrate, low-fiber, low-fat foods pre-competition

**Transition/Off-Season:**
- Reduced training load
- Carbohydrate: 4–6 g/kg/day; adjust to match activity level

### Day-to-Day Periodization

Match carbohydrate intake to session demands:
- **Heavy training day** (>90 min intense): 8–10 g/kg
- **Moderate training day** (60–90 min): 5–7 g/kg
- **Rest or recovery day** (light activity): 3–5 g/kg

### Practical Tools

- Track training load (RPE × duration = arbitrary units)
- Adjust carbohydrate portions at each meal based on planned/completed training
- Meal prep high-carbohydrate meals for hard training days in advance

*Periodized nutrition requires tracking and individualization. Work with a sports dietitian for your competition calendar.*`,
      },
      {
        slug: "fueling-around-high-intensity-sessions",
        title: "Fueling Around High-Intensity Sessions",
        description:
          "Specific pre, during, and post-nutrition strategies for high-intensity interval training and threshold work.",
        durationMinutes: 25,
        order: 3,
        content: `## Fueling Around High-Intensity Sessions

### Why High-Intensity Sessions Require Special Attention

High-intensity exercise (>85% VO2max) relies almost entirely on carbohydrate as fuel. At these intensities, fat oxidation rate is too slow to meet energy demands. Inadequate carbohydrate availability for HIIT sessions reduces:
- Work rate and power output
- Interval quality and repeatability
- Training adaptation (you can't train hard if you're under-fueled)

### Pre-Session Fueling

**2–3 hours before**: Full carbohydrate-rich meal (3–4 g/kg CHO); moderate protein; low fat and fiber.

**30–60 minutes before**: 0.5–1 g/kg easily digested carbohydrate; sports drink or fruit + white bread acceptable.

**15 min before**: Optional 1 energy gel or 200 mL sports drink if session > 60 min.

### During High-Intensity Sessions

- For sessions < 60 min: Not required; mouth rinse with carbohydrate drink may benefit very high-intensity efforts
- For sessions 60–90 min: 30–60 g/hour if sustainable; often impractical mid-HIIT; sports drink between intervals
- For threshold or prolonged HIIT > 90 min: 60–90 g/hour (glucose + fructose blend)

### Post-Session Recovery

High-intensity sessions cause substantial glycogen depletion and muscle protein breakdown.

**Within 30 minutes:**
- 1.0–1.2 g/kg CHO (high-glycemic: sports drink, banana, white bread + jam)
- 20–25 g protein (whey, Greek yogurt, milk)

**Within 2 hours:**
- Full balanced meal with 1–1.5 g/kg CHO + 0.3 g/kg protein
- Rehydrate: 1.5 L fluid per kg body weight lost during session

### Warning: Under-Fueling Before HIIT

Athletes who habitually under-fuel before high-intensity sessions experience:
- Reduced peak power and interval quality
- Increased perceived exertion for same workload
- Chronically elevated cortisol
- Risk of non-functional overreaching and injury

*This is educational content. Individual needs vary with fitness level, body composition, and goals.*`,
      },
    ],
  },
  {
    slug: "hydration-strategy",
    title: "Hydration Strategy",
    description:
      "Evidence-based hydration planning for training and competition, including individualized sweat rate assessment and electrolyte management.",
    order: 5,
    lessons: [
      {
        slug: "fluid-balance-and-hydration-status",
        title: "Fluid Balance and Hydration Status",
        description:
          "Understand how dehydration affects performance and how to assess your hydration status accurately.",
        durationMinutes: 25,
        order: 1,
        content: `## Fluid Balance and Hydration Status

### Why Hydration Matters for Performance

Sweat is the primary mechanism for thermoregulation during exercise. As body water deficit increases, thermoregulatory capacity decreases and performance declines:

| Dehydration Level | Performance Impact |
|---|---|
| 1% body weight | Increased cardiovascular strain |
| 2% body weight | ~3–4% reduction in endurance performance |
| 3% body weight | ~5–7% reduction in VO2max |
| 4%+ body weight | Significant impairment; heat illness risk |

### Assessing Hydration Status

**Urine color (practical field method):**
- Pale straw/lemonade = well hydrated
- Darker yellow = mild dehydration
- Amber/brown = significant dehydration

**Body weight monitoring:**
- Weigh before and after training sessions
- 1 kg of weight loss ≈ 1 L of fluid deficit
- Target < 2% body weight loss per session

**Urine specific gravity (lab/clinical method):**
- < 1.010: Well hydrated
- 1.010–1.020: Acceptable
- > 1.020: Dehydration; delay or modify training

### Factors Affecting Fluid Needs

- **Temperature and humidity**: Hot/humid conditions can increase sweat rate by 2–3× vs. cool conditions
- **Exercise intensity**: Higher intensity = higher sweat rate
- **Acclimatization status**: Acclimatized athletes sweat more efficiently (more volume, lower sodium concentration)
- **Individual variation**: Sweat rates range from 0.5–2.5+ L/hour; highly individual

### Daily Hydration Targets

General baseline (non-exercise days): 35–45 mL/kg body weight/day from all fluids
Add: sweat losses during exercise (replace 125–150% of sweat loss over 4–6 hours post-exercise)

*This is educational content. Hydration needs are highly individual.*`,
      },
      {
        slug: "sweat-rate-testing-and-individualization",
        title: "Sweat Rate Testing and Individualization",
        description:
          "Learn how to conduct and interpret a sweat rate test to build your personalized hydration plan.",
        durationMinutes: 20,
        order: 2,
        content: `## Sweat Rate Testing and Individualization

### Why Individual Testing Matters

Average sweat rate guidelines are starting points only. Individual sweat rates during exercise range from 0.5 L/hour in cool, low-intensity exercise to over 3.0 L/hour in hot, humid, high-intensity conditions. Generic recommendations can lead to both under- and over-hydration.

### How to Conduct a Sweat Rate Test

**Equipment needed:**
- Accurate scale (to ±50 g precision)
- Empty bladder before weighing
- Known volume of fluid (measured)

**Protocol:**
1. Weigh yourself nude (or in minimal, consistent clothing) immediately before exercise
2. Exercise for 60 minutes at a known intensity and environmental condition (standardize this for future comparison)
3. Track ALL fluid consumed during exercise (weigh bottle before and after)
4. Avoid urinating during the test session (or collect and measure urine volume)
5. Weigh yourself immediately post-exercise (nude, toweled dry)

**Calculation:**
\`\`\`
Sweat Rate (L/hour) = [(Pre-weight - Post-weight) + Fluid consumed - Urine] / Exercise duration (hours)
\`\`\`

**Example:**
- Pre-weight: 70.0 kg
- Post-weight: 69.0 kg → 1.0 kg loss
- Fluid consumed: 500 mL = 0.5 kg
- No urine during exercise
- Sweat rate = (1.0 + 0.5) / 1.0 = **1.5 L/hour**

### Using Your Results

For the above athlete (1.5 L/hour sweat rate):
- Target drinking rate: 750 mL – 1.2 L/hour during exercise (80% replacement is acceptable)
- Post-exercise: drink 1.5–2.25 L over 4–6 hours to restore fluid balance

Repeat the test in different conditions (hot vs. cool, high vs. low intensity) to build a condition-specific database.

### Sodium Concentration Testing

Sweat sodium can be measured via regional sweat patch testing (in sports dietitian or exercise physiology labs). Athletes with visible white salt residue on skin/clothing often have higher sodium concentration sweat.

*Consult a sports dietitian or exercise physiologist for a comprehensive hydration assessment.*`,
      },
      {
        slug: "race-day-hydration-planning",
        title: "Race Day Hydration Planning",
        description:
          "Build a race-day hydration plan that accounts for course aid stations, environmental conditions, and personal sweat rate.",
        durationMinutes: 25,
        order: 3,
        content: `## Race Day Hydration Planning

### The Pre-Race Hydration Goal

Arrive at the start line well-hydrated but not over-hydrated. Signs of correct pre-race hydration:
- Clear to pale-yellow urine in the 2–3 hours before start
- No sensation of excessive bloating or urge to urinate immediately after any fluid intake

**Pre-race hydration protocol:**
- 24 hours before: consume normal daily fluid targets + any deficit from previous training
- 4 hours before: 5–7 mL/kg body weight of water or low-electrolyte fluid
- 2 hours before: top up with 250–350 mL if urine is still dark
- 1 hour before: minimize intake to reduce urination needs during warm-up

### During-Race Hydration Strategy

**Planned approach (not ad-libitum):**

1. **Know your sweat rate**: from sweat testing in conditions similar to race day
2. **Know the course**: aid station locations, what fluids are provided (water vs. sports drink)
3. **Drink to a plan**: aim for ~80% fluid replacement of sweat losses; use scheduled aid station stops
4. **Account for sodium**: if > 2 hours, use sodium-containing fluids (sports drink) or carry salt capsules

**Temperature adjustment:**
- Add ~100–150 mL/hour per 5°C above your testing temperature
- Reduce accordingly for cool conditions

**Practical race hydration sample plan (70 kg, 1.5 L/hour sweat rate, hot half-marathon):**

| Time | Action |
|---|---|
| Start | Well hydrated; no extra fluid |
| km 5 (20–25 min) | 200 mL sports drink at aid station |
| km 10 (40–45 min) | 200 mL sports drink + 1 gel |
| km 15 (60–65 min) | 200 mL water + 150 mL sports drink |
| Finish | Immediate post-race: 500 mL electrolyte drink |

### Signs to Monitor During Racing

- **Thirst** — a reliable signal; respond to it if possible
- **Headache, nausea, confusion** — signs of hyponatremia; do not drink plain water
- **Dark cramps + weakness** — electrolyte deficit; take sodium + fluids
- **Dizziness, reduced urine** — significant dehydration; seek medical attention if worsening

*Race hydration plans should be practiced in training. This is educational content.*`,
      },
    ],
  },
  {
    slug: "reds-prevention",
    title: "RED-S Prevention",
    description:
      "Understand Relative Energy Deficiency in Sport (RED-S), recognize early warning signs, and build sustainable fueling practices.",
    order: 6,
    lessons: [
      {
        slug: "understanding-energy-availability",
        title: "Understanding Energy Availability",
        description:
          "Learn what energy availability means, how to calculate it, and why it is the cornerstone of athlete health.",
        durationMinutes: 30,
        order: 1,
        content: `## Understanding Energy Availability

### What Is Energy Availability?

Energy availability (EA) is the amount of dietary energy remaining for physiological functions after accounting for exercise energy expenditure:

**EA = (Energy Intake − Exercise Energy Expenditure) / Fat-Free Mass**

This metric was developed by Dr. Anne Loucks and colleagues and is expressed as kcal per kg of fat-free mass (FFM) per day.

### Energy Availability Thresholds

| EA Range | Status |
|---|---|
| ≥ 45 kcal/kg FFM/day | Optimal for health and performance |
| 30–45 kcal/kg FFM/day | Reduced EA; functional impairment may begin |
| < 30 kcal/kg FFM/day | Low EA (LEA); risk of health consequences |

**Example calculation:**
- 60 kg athlete, 15% body fat → FFM = 51 kg
- Daily energy intake: 2400 kcal
- Exercise energy expenditure: 800 kcal
- EA = (2400 − 800) / 51 = **31.4 kcal/kg FFM/day** → low EA range

### What Happens with Low Energy Availability?

The body responds to low EA by downregulating non-essential functions to preserve energy for survival:
- **Reproductive function**: suppression of LH pulsatility, menstrual irregularity/loss (females), reduced testosterone (males)
- **Bone health**: reduced bone mineral density, increased stress fracture risk
- **Metabolic rate**: decreased resting metabolic rate; weight loss plateau
- **Immune function**: increased illness frequency
- **Cardiovascular**: bradycardia, orthostatic hypotension
- **Psychological**: increased depression, irritability, disordered eating behaviors

### Causes of Low EA in Athletes

Low EA is not always intentional. Common causes:
- Under-fueling due to busy schedule or training logistics
- Intentional weight loss or body composition focus
- Restriction around specific food groups
- Increased training load without proportional increase in energy intake
- Food insecurity

*This educational content is not a substitute for clinical assessment. If you suspect RED-S, consult a sports medicine physician and sports dietitian.*`,
      },
      {
        slug: "recognizing-warning-signs",
        title: "Recognizing Warning Signs",
        description:
          "Identify the early warning signs of RED-S in yourself and your athletes before health consequences progress.",
        durationMinutes: 25,
        order: 2,
        content: `## Recognizing Warning Signs of RED-S

### What Is RED-S?

Relative Energy Deficiency in Sport (RED-S) — formerly called the Female Athlete Triad — describes a syndrome of impaired physiological function caused by chronically low energy availability in athletes of any sex.

RED-S affects:
- Bone health (stress fractures, low bone density)
- Immune function
- Cardiovascular health
- Reproductive function
- Metabolic rate
- Psychological health
- Exercise performance

### RED-S Warning Signs by System

**Performance signs (often noticed first):**
- Unexplained performance plateaus or declines
- Excessive fatigue not explained by training load
- Slow recovery between sessions
- Increased illness and injury frequency
- Difficulty completing previously manageable workouts

**Physical signs:**
- Frequent stress fractures or stress reactions
- Irregular or absent menstrual cycles (females)
- Gastrointestinal complaints (constipation, early satiety)
- Hair loss, brittle nails
- Cold intolerance, consistently feeling cold
- Resting heart rate below 40 bpm + symptoms of fatigue

**Psychological and behavioral signs:**
- Preoccupation with food, weight, or body image
- Avoiding eating with teammates or in social settings
- Guilt or distress after eating
- Rigid food rules or elimination of food groups
- Excessive exercise beyond planned training

### The Clinical RED-S Risk Assessment Tool

A validated screening tool (RED-S CAT) is available for sports medicine clinicians. It classifies athletes into return-to-play risk categories based on clinical indicators. Coaches and teammates are not qualified to diagnose RED-S but can recognize warning signs and facilitate referral.

### What to Do If You Recognize Warning Signs

1. **Do not ignore or dismiss** — early intervention is associated with better outcomes
2. **Have a private, non-judgmental conversation** if concerned about an athlete or teammate
3. **Refer to qualified professionals**: sports medicine physician + sports dietitian + sports psychologist
4. **Do not pressure weight loss or changes in body composition**

*This content is educational and is not a substitute for clinical evaluation. RED-S is a medical condition requiring professional assessment.*`,
      },
      {
        slug: "building-healthy-food-sport-relationship",
        title: "Building a Healthy Relationship with Food and Sport",
        description:
          "Practical strategies for fostering a positive, performance-oriented relationship with food, body image, and exercise.",
        durationMinutes: 30,
        order: 3,
        content: `## Building a Healthy Relationship with Food and Sport

### The Performance Fueling Mindset

A performance-focused relationship with food views nutrition as a tool for fueling athletic goals, health, and well-being — rather than as a means of controlling body weight or appearance.

Core tenets of the performance fueling mindset:
- Food is fuel AND enjoyment; both matter
- All foods can fit within a performance nutrition plan
- Weight and body composition should never be pursued at the expense of health or performance
- Hunger is a physiological signal that should be respected, not suppressed

### Principles of Intuitive Eating for Athletes

Intuitive eating, developed by Tribole and Resch, has been adapted for athletic populations. Key principles relevant to athletes:

1. **Reject the diet mentality**: Chronic dieting and food restriction undermine training adaptation and increase RED-S risk
2. **Honor your hunger**: Athletes have elevated calorie needs; under-eating is a performance and health risk
3. **Make peace with all foods**: Moralizing food ("clean" vs. "cheat") increases psychological stress and disordered eating risk
4. **Body respect**: The goal is a body capable of the performance and health outcomes you value, not a specific appearance
5. **Movement for joy and purpose**: Exercise should be intrinsically motivating beyond body composition goals

### Practical Strategies

**For athletes:**
- Build consistent, structured eating patterns aligned with training demands
- Focus on adequacy: "Am I eating enough to support my training?" rather than restriction
- Include foods you enjoy in your diet; performance nutrition is not synonymous with joyless eating
- Seek support early if you notice food preoccupation, restriction, or guilt

**For coaches:**
- Avoid commenting on athletes' body weight or shape (unless in a clinical context)
- Do not encourage weight loss without a qualified sports dietitian's oversight
- Create team cultures where fueling adequately is normalized and celebrated
- Refer athletes showing warning signs to appropriate professionals promptly

**For the team environment:**
- Normalize carbohydrate intake and adequate fueling during training
- Avoid language that moralizes food or praises restriction
- Make performance nutrition information accessible without connecting it to appearance

### When to Seek Professional Help

Signs that professional support may be warranted:
- Persistent fear of certain foods or food groups
- Eating behaviors that interfere with social function, training logistics, or recovery
- Body image concerns that cause significant distress
- Any RED-S warning signs noted in the previous lesson

A sports dietitian with experience in eating disorders and disordered eating can provide a non-judgmental, performance-focused support framework.

*This content is for educational purposes. Disordered eating and eating disorders are serious medical conditions requiring professional assessment and treatment.*`,
      },
    ],
  },
];

export function getModule(slug: string): Module | undefined {
  return EDUCATION_MODULES.find((m) => m.slug === slug);
}

export function getLesson(
  moduleSlug: string,
  lessonSlug: string,
): { module: Module; lesson: Lesson } | undefined {
  const mod = getModule(moduleSlug);
  if (!mod) return undefined;
  const lesson = mod.lessons.find((lsn) => lsn.slug === lessonSlug);
  if (!lesson) return undefined;
  return { module: mod, lesson };
}

async function ensureProgressTable(): Promise<void> {
  const db = buildDb();
  await db.execute(
    `CREATE TABLE IF NOT EXISTS fueling_lesson_progress (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      module_slug TEXT NOT NULL,
      lesson_slug TEXT NOT NULL,
      completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT fueling_lesson_progress_unique UNIQUE (user_id, module_slug, lesson_slug)
    )`,
  );
}

export async function hasEducationAccess(userId: string): Promise<boolean> {
  const db = buildDb();
  try {
    const rows = await db.query<{ status: string }>(
      "SELECT s.status FROM billing_subscriptions s " +
        "JOIN billing_customers c ON c.id = s.customer_id " +
        "WHERE c.user_id = $1::uuid " +
        "AND s.status IN ('trialing', 'active', 'past_due') " +
        "ORDER BY s.created_at DESC LIMIT 1",
      userId,
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}

export async function getLessonProgress(
  userId: string,
): Promise<LessonProgress[]> {
  const db = buildDb();
  try {
    await ensureProgressTable();
    const rows = await db.query<{
      module_slug: string;
      lesson_slug: string;
      completed_at: string;
    }>(
      "SELECT module_slug, lesson_slug, completed_at::text " +
        "FROM fueling_lesson_progress WHERE user_id = $1::uuid",
      userId,
    );
    return rows.map((r) => ({
      moduleSlug: r.module_slug,
      lessonSlug: r.lesson_slug,
      completedAt: r.completed_at,
    }));
  } catch {
    return [];
  }
}

export async function markLessonComplete(
  userId: string,
  moduleSlug: string,
  lessonSlug: string,
): Promise<void> {
  const db = buildDb();
  await ensureProgressTable();
  await db.execute(
    "INSERT INTO fueling_lesson_progress (id, user_id, module_slug, lesson_slug) " +
      "VALUES (gen_random_uuid(), $1::uuid, $2, $3) " +
      "ON CONFLICT ON CONSTRAINT fueling_lesson_progress_unique DO NOTHING",
    userId,
    moduleSlug,
    lessonSlug,
  );
}

export async function getModuleCompletionMap(
  userId: string,
): Promise<Record<string, Set<string>>> {
  const progress = await getLessonProgress(userId);
  const map: Record<string, Set<string>> = {};
  for (const p of progress) {
    if (!map[p.moduleSlug]) {
      map[p.moduleSlug] = new Set();
    }
    map[p.moduleSlug].add(p.lessonSlug);
  }
  return map;
}

export async function getEducationSession(): Promise<SessionUser | null> {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;
  if (!token) return null;
  try {
    const result = await handleSession({
      authorizationHeader: `Bearer ${token}`,
      ctx: { db: buildDb(), events: buildEventBus() },
    });
    if (result.status !== 200 || typeof result.body === "string") return null;
    const body = result.body as Record<string, unknown>;
    if (!body.user_id || typeof body.user_id !== "string") return null;
    return {
      user_id: body.user_id as string,
      email: (body.email as string) || "",
      session_id: (body.session_id as string) || "",
      expires_at: (body.expires_at as string) || "",
    };
  } catch {
    return null;
  }
}
