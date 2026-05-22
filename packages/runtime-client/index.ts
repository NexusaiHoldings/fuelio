/**
 * Typed client for services/portfolio-runtime/ (Layer 2 per spec §5).
 *
 * Exposes typed request helpers for: perception, planning, approval queue,
 * tool invocations, reflection. Substrate apps/web/lib/runtime.ts is a thin
 * wrapper around this package's primitives.
 *
 * Substrate ships a stub. Real types ship in Phase 2 when the runtime
 * container's HTTP/NATS surface stabilizes.
 */

export interface RuntimeHealth {
  readonly status: "ok" | "degraded" | "down";
  readonly version?: string;
}

export interface RuntimeRequestOpts {
  readonly baseUrl: string;
  readonly companySlug: string;
}

export async function fetchHealth(opts: RuntimeRequestOpts): Promise<RuntimeHealth> {
  // Stub: replace with `fetch(opts.baseUrl + "/health")` once runtime container ships.
  return { status: "ok", version: "stub" };
}
