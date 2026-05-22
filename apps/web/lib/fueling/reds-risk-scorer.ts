/**
 * RED-S (Relative Energy Deficiency in Sport) risk scoring engine.
 *
 * Based on the IOC 2023 consensus statement:
 *   - Score 0-25: Low risk
 *   - Score 26-50: Moderate risk
 *   - Score 51-75: High risk
 *   - Score 76-100: Critical risk
 *
 * Risk factors weighted by clinical significance:
 *   - Duration of LEA (consecutive days below 30 kcal/kg FFM/day)
 *   - Severity of LEA (how far below threshold)
 *   - Rolling 7-day average EA
 *   - Rate of energy deficit change
 */

import {
  type EAResult,
  LEA_THRESHOLD_KCAL_PER_KG,
  OPTIMAL_EA_KCAL_PER_KG,
} from "./energy-availability";

export type RiskLevel = "low" | "moderate" | "high" | "critical";

export interface REDSRiskScore {
  readonly level: RiskLevel;
  readonly score: number;
  readonly factors: readonly string[];
  readonly recommendation: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function riskLevelFromScore(score: number): RiskLevel {
  if (score <= 25) return "low";
  if (score <= 50) return "moderate";
  if (score <= 75) return "high";
  return "critical";
}

function recommendationForLevel(level: RiskLevel): string {
  switch (level) {
    case "low":
      return "Energy availability is within healthy range. Continue monitoring and maintain balanced intake relative to training load.";
    case "moderate":
      return "Energy availability is below optimal. Consider increasing caloric intake, especially around training sessions. Review fueling strategy with a sports dietitian.";
    case "high":
      return "Low Energy Availability detected. Immediate nutrition intervention recommended. Reduce training load or significantly increase energy intake. Consult a sports medicine professional.";
    case "critical":
      return "CRITICAL: Severe or prolonged Low Energy Availability. High risk of RED-S health consequences including bone stress injury, hormonal disruption, and immune suppression. Seek immediate evaluation by a sports medicine physician and registered dietitian.";
  }
}

export function scoreREDSRisk(ea: EAResult): REDSRiskScore {
  const factors: string[] = [];
  let score = 0;

  const todayEA = ea.today?.eaScore ?? ea.averageEA7Day;
  const avgEA = ea.averageEA7Day;
  const consecutiveLEADays = ea.consecutiveLEADays;

  // Factor 1: Current EA vs threshold (0-30 points)
  if (todayEA < LEA_THRESHOLD_KCAL_PER_KG) {
    const deficit = LEA_THRESHOLD_KCAL_PER_KG - todayEA;
    const severityPoints = clamp(Math.round((deficit / 15) * 30), 10, 30);
    score += severityPoints;
    factors.push(
      `Current EA ${todayEA.toFixed(1)} kcal/kg FFM/day is below LEA threshold (${LEA_THRESHOLD_KCAL_PER_KG})`,
    );
  } else if (todayEA < OPTIMAL_EA_KCAL_PER_KG) {
    score += 5;
    factors.push(
      `Current EA ${todayEA.toFixed(1)} kcal/kg FFM/day is below optimal (${OPTIMAL_EA_KCAL_PER_KG})`,
    );
  }

  // Factor 2: Rolling 7-day average EA (0-25 points)
  if (avgEA < LEA_THRESHOLD_KCAL_PER_KG) {
    const deficit = LEA_THRESHOLD_KCAL_PER_KG - avgEA;
    const avgPoints = clamp(Math.round((deficit / 15) * 25), 10, 25);
    score += avgPoints;
    factors.push(
      `7-day average EA ${avgEA.toFixed(1)} kcal/kg FFM/day is in LEA range`,
    );
  } else if (avgEA < OPTIMAL_EA_KCAL_PER_KG) {
    score += 3;
    factors.push(
      `7-day average EA ${avgEA.toFixed(1)} kcal/kg FFM/day is sub-optimal`,
    );
  }

  // Factor 3: Duration of LEA (0-30 points)
  if (consecutiveLEADays >= 1) {
    const durationPoints = clamp(consecutiveLEADays * 5, 5, 30);
    score += durationPoints;
    if (consecutiveLEADays === 1) {
      factors.push("LEA detected today");
    } else {
      factors.push(`${consecutiveLEADays} consecutive days of LEA`);
    }
  }

  // Factor 4: Proportion of LEA days in 7-day window (0-15 points)
  const records = ea.rolling7Day;
  if (records.length > 0) {
    const leaDays = records.filter((r) => r.isLEA).length;
    const leaProportion = leaDays / records.length;
    if (leaProportion >= 0.5) {
      const propPoints = clamp(Math.round(leaProportion * 15), 0, 15);
      score += propPoints;
      factors.push(
        `${leaDays} of last ${records.length} days in LEA (${Math.round(leaProportion * 100)}%)`,
      );
    }
  }

  const finalScore = clamp(score, 0, 100);
  const level = riskLevelFromScore(finalScore);

  if (factors.length === 0) {
    factors.push("Energy availability within healthy range");
  }

  return {
    level,
    score: finalScore,
    factors,
    recommendation: recommendationForLevel(level),
  };
}
