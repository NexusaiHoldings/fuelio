/**
 * Portfolio runtime client — talks to services/portfolio-runtime/
 * (Layer 2 per NEXUS_PORTFOLIO_RUNTIME_SPEC.md §5).
 *
 * Substrate placeholder. Real client SDK lives in packages/runtime-client/
 * and gets imported here. Substrate ships this stub so the build succeeds
 * before Phase 2 wires the actual runtime container per-company.
 */

export interface RuntimeClient {
  readonly companySlug: string;
  readonly baseUrl: string;
  health(): Promise<{ status: "ok" | "degraded" | "down" }>;
}

export function createRuntimeClient(opts?: {
  companySlug?: string;
  baseUrl?: string;
}): RuntimeClient {
  const companySlug = opts?.companySlug ?? process.env.COMPANY_SLUG ?? "unknown";
  const baseUrl =
    opts?.baseUrl ??
    process.env.PORTFOLIO_RUNTIME_URL ??
    "http://localhost:8000";

  return {
    companySlug,
    baseUrl,
    async health() {
      // Stub: real impl fetches `${baseUrl}/health` and returns status.
      return { status: "ok" };
    },
  };
}
