/**
 * Compliance middleware for AI-generated fueling recommendations.
 *
 * Injects all 7 COO-mandated disclaimers on every recommendation surface.
 * Framing: "general fueling guidelines" — NOT individualized medical nutrition
 * therapy. Per COO regulatory direction and liability_assessor required_disclaimers.
 */

export interface ComplianceDisclaimer {
  readonly id: string;
  readonly text: string;
}

export interface ComplianceWrapped<T> {
  readonly data: T;
  readonly disclaimers: readonly ComplianceDisclaimer[];
  readonly wrappedAt: string;
  readonly framingLabel: string;
}

export const REQUIRED_DISCLAIMERS: readonly ComplianceDisclaimer[] = [
  {
    id: "D-001",
    text: "This information is provided for general educational purposes only and does not constitute individualized medical nutrition therapy, dietary advice, or a treatment plan.",
  },
  {
    id: "D-002",
    text: "Always consult a qualified registered dietitian, sports nutritionist, or licensed healthcare provider before making significant changes to your nutrition regimen.",
  },
  {
    id: "D-003",
    text: "Individual nutritional needs vary based on body composition, health status, training history, medications, and other factors. These guidelines may not be appropriate for everyone.",
  },
  {
    id: "D-004",
    text: "These recommendations are not intended for persons with pre-existing medical conditions including but not limited to diabetes, kidney disease, eating disorders, or gastrointestinal disorders, without direct supervision from a qualified healthcare provider.",
  },
  {
    id: "D-005",
    text: "Fueling ranges presented are derived from published sports science consensus guidelines and represent population-level averages. They are not a substitute for personalized assessment by a qualified professional.",
  },
  {
    id: "D-006",
    text: "Energy availability (EA) estimates are approximations. If you are experiencing symptoms of Relative Energy Deficiency in Sport (RED-S) — including fatigue, frequent illness, stress fractures, or hormonal disruption — seek evaluation from a sports medicine physician.",
  },
  {
    id: "D-007",
    text: "In the event of a medical emergency, stop activity immediately and contact emergency services (911 in the US). Do not rely on any app-generated guidance in an emergency.",
  },
] as const;

export function wrapWithCompliance<T>(data: T): ComplianceWrapped<T> {
  return {
    data,
    disclaimers: REQUIRED_DISCLAIMERS,
    wrappedAt: new Date().toISOString(),
    framingLabel: "General Fueling Guidelines",
  };
}

export function getDisclaimerById(disclaimerId: string): ComplianceDisclaimer | undefined {
  return REQUIRED_DISCLAIMERS.find((d) => d.id === disclaimerId);
}

export function formatDisclaimersAsText(): string {
  return REQUIRED_DISCLAIMERS.map(
    (d, idx) => `${idx + 1}. [${d.id}] ${d.text}`,
  ).join("\n\n");
}

export function getComplianceSystemPromptAddendum(): string {
  return [
    "REGULATORY FRAMING REQUIREMENTS:",
    "- All outputs MUST be framed as 'general fueling guidelines', never as individualized medical nutrition therapy.",
    "- Never diagnose, prescribe, or treat. Never use language implying clinical authority.",
    "- If an athlete's EA score is below 30 kcal/kg FFM/day, include a RED-S risk alert and recommend evaluation by a sports medicine physician.",
    "- Explicitly state that recommendations are derived from published sports science consensus guidelines.",
    "- Use hedged language: 'athletes may consider', 'research suggests', 'guidelines recommend' — not imperatives like 'you must eat'.",
  ].join("\n");
}
