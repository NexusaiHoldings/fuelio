/**
 * Apple Health OAuth 2.0 PKCE callback page (F1-003).
 *
 * Receives the authorization code from Apple, verifies the state
 * parameter, and exchanges the code for access/refresh tokens using
 * the stored PKCE code_verifier cookie.
 */

import type { JSX } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";
import { exchangeAppleCodeForToken } from "@/lib/fueling/apple-health-client";
import { handleSession } from "@nexus/identity-and-access";
import { buildDb } from "@/lib/db";
import { buildEventBus } from "@/lib/events";

interface PageProps {
  readonly searchParams: Record<string, string | string[] | undefined>;
}

function verifyOAuthState(state: string): string | null {
  const parts = state.split(".");
  if (parts.length !== 2) return null;
  const userId = parts[0];
  const providedHmac = parts[1];
  const secret = process.env.OAUTH_STATE_SECRET ?? "default-dev-secret";
  const expectedHmac = crypto
    .createHmac("sha256", secret)
    .update(userId)
    .digest("base64url");
  if (providedHmac !== expectedHmac) return null;
  return userId;
}

async function getCurrentUser(): Promise<{ user_id: string } | null> {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;
  if (!token) return null;
  const result = await handleSession({
    authorizationHeader: "Bearer " + token,
    ctx: { db: buildDb(), events: buildEventBus() },
  });
  if (result.status !== 200) return null;
  return result.body as { user_id: string };
}

function getString(val: string | string[] | undefined): string | undefined {
  if (typeof val === "string") return val;
  if (Array.isArray(val)) return val[0];
  return undefined;
}

export default async function AppleHealthCallbackPage({
  searchParams,
}: PageProps): Promise<JSX.Element> {
  const code = getString(searchParams.code);
  const state = getString(searchParams.state);
  const error = getString(searchParams.error);

  if (error) {
    return (
      <section style={{ maxWidth: 480, margin: "4rem auto", padding: "2rem", textAlign: "center" }}>
        <h1>Connection Failed</h1>
        <p style={{ opacity: 0.7 }}>
          Apple Health authorization was declined: {error}
        </p>
        <a
          href="/integrations"
          style={{
            display: "inline-block",
            marginTop: "1rem",
            padding: "0.5rem 1.25rem",
            background: "#111827",
            color: "#fff",
            borderRadius: 8,
            textDecoration: "none",
          }}
        >
          Back to Integrations
        </a>
      </section>
    );
  }

  if (!code || !state) {
    return (
      <section style={{ maxWidth: 480, margin: "4rem auto", padding: "2rem", textAlign: "center" }}>
        <h1>Invalid Callback</h1>
        <p style={{ opacity: 0.7 }}>Missing authorization code or state. Please try connecting again.</p>
        <a href="/integrations" style={{ display: "inline-block", marginTop: "1rem", padding: "0.5rem 1.25rem", background: "#111827", color: "#fff", borderRadius: 8, textDecoration: "none" }}>
          Back to Integrations
        </a>
      </section>
    );
  }

  const userId = verifyOAuthState(state);
  if (!userId) {
    return (
      <section style={{ maxWidth: 480, margin: "4rem auto", padding: "2rem", textAlign: "center" }}>
        <h1>Invalid State</h1>
        <p style={{ opacity: 0.7 }}>
          The authorization state is invalid or expired. Please try connecting again.
        </p>
        <a href="/integrations" style={{ display: "inline-block", marginTop: "1rem", padding: "0.5rem 1.25rem", background: "#111827", color: "#fff", borderRadius: 8, textDecoration: "none" }}>
          Back to Integrations
        </a>
      </section>
    );
  }

  const cookieStore = cookies();
  const codeVerifier = cookieStore.get("apple_cv")?.value;

  if (!codeVerifier) {
    return (
      <section style={{ maxWidth: 480, margin: "4rem auto", padding: "2rem", textAlign: "center" }}>
        <h1>Session Expired</h1>
        <p style={{ opacity: 0.7 }}>
          The authorization session has expired. Please try connecting again.
        </p>
        <a href="/integrations" style={{ display: "inline-block", marginTop: "1rem", padding: "0.5rem 1.25rem", background: "#111827", color: "#fff", borderRadius: 8, textDecoration: "none" }}>
          Back to Integrations
        </a>
      </section>
    );
  }

  const sessionUser = await getCurrentUser();
  const effectiveUserId = sessionUser?.user_id ?? userId;

  try {
    await exchangeAppleCodeForToken(code, codeVerifier, effectiveUserId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(
      JSON.stringify({ event: "apple_health_callback_error", userId: effectiveUserId, error: message }),
    );
    return (
      <section style={{ maxWidth: 480, margin: "4rem auto", padding: "2rem", textAlign: "center" }}>
        <h1>Connection Error</h1>
        <p style={{ opacity: 0.7 }}>Failed to connect Apple Health. Please try again.</p>
        <a href="/integrations" style={{ display: "inline-block", marginTop: "1rem", padding: "0.5rem 1.25rem", background: "#111827", color: "#fff", borderRadius: 8, textDecoration: "none" }}>
          Back to Integrations
        </a>
      </section>
    );
  }

  redirect("/integrations?connected=apple_health");
}
