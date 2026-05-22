/**
 * Garmin Connect OAuth 1.0a callback page (F1-003).
 *
 * Receives oauth_token and oauth_verifier from Garmin, reads the stored
 * request_token_secret from the httpOnly cookie, and exchanges for a
 * long-lived access token.
 */

import type { JSX } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";
import { exchangeGarminToken } from "@/lib/fueling/garmin-client";
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

export default async function GarminCallbackPage({
  searchParams,
}: PageProps): Promise<JSX.Element> {
  const oauthToken = getString(searchParams.oauth_token);
  const oauthVerifier = getString(searchParams.oauth_verifier);

  if (!oauthToken || !oauthVerifier) {
    return (
      <section style={{ maxWidth: 480, margin: "4rem auto", padding: "2rem", textAlign: "center" }}>
        <h1>Connection Failed</h1>
        <p style={{ opacity: 0.7 }}>
          Garmin authorization was declined or no verifier received. Please try again.
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

  const cookieStore = cookies();
  const garminRt = cookieStore.get("garmin_rt")?.value;

  if (!garminRt) {
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

  const rtParts = garminRt.split(":");
  if (rtParts.length < 3) {
    return (
      <section style={{ maxWidth: 480, margin: "4rem auto", padding: "2rem", textAlign: "center" }}>
        <h1>Invalid Session</h1>
        <p style={{ opacity: 0.7 }}>Authorization data is malformed. Please try connecting again.</p>
        <a href="/integrations" style={{ display: "inline-block", marginTop: "1rem", padding: "0.5rem 1.25rem", background: "#111827", color: "#fff", borderRadius: 8, textDecoration: "none" }}>
          Back to Integrations
        </a>
      </section>
    );
  }

  const storedRequestToken = rtParts[0];
  const requestTokenSecret = rtParts[1];
  const stateFromCookie = rtParts.slice(2).join(":");

  const userIdFromState = verifyOAuthState(stateFromCookie);

  const sessionUser = await getCurrentUser();
  const effectiveUserId = sessionUser?.user_id ?? userIdFromState;

  if (!effectiveUserId) {
    return (
      <section style={{ maxWidth: 480, margin: "4rem auto", padding: "2rem", textAlign: "center" }}>
        <h1>Not Authenticated</h1>
        <p style={{ opacity: 0.7 }}>Please sign in and try connecting Garmin again.</p>
        <a href="/integrations" style={{ display: "inline-block", marginTop: "1rem", padding: "0.5rem 1.25rem", background: "#111827", color: "#fff", borderRadius: 8, textDecoration: "none" }}>
          Back to Integrations
        </a>
      </section>
    );
  }

  if (storedRequestToken !== oauthToken) {
    return (
      <section style={{ maxWidth: 480, margin: "4rem auto", padding: "2rem", textAlign: "center" }}>
        <h1>Token Mismatch</h1>
        <p style={{ opacity: 0.7 }}>OAuth token does not match the expected request token. Please try again.</p>
        <a href="/integrations" style={{ display: "inline-block", marginTop: "1rem", padding: "0.5rem 1.25rem", background: "#111827", color: "#fff", borderRadius: 8, textDecoration: "none" }}>
          Back to Integrations
        </a>
      </section>
    );
  }

  try {
    await exchangeGarminToken(oauthToken, requestTokenSecret, oauthVerifier, effectiveUserId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(
      JSON.stringify({ event: "garmin_callback_error", userId: effectiveUserId, error: message }),
    );
    return (
      <section style={{ maxWidth: 480, margin: "4rem auto", padding: "2rem", textAlign: "center" }}>
        <h1>Connection Error</h1>
        <p style={{ opacity: 0.7 }}>Failed to connect Garmin. Please try again.</p>
        <a href="/integrations" style={{ display: "inline-block", marginTop: "1rem", padding: "0.5rem 1.25rem", background: "#111827", color: "#fff", borderRadius: 8, textDecoration: "none" }}>
          Back to Integrations
        </a>
      </section>
    );
  }

  redirect("/integrations?connected=garmin");
}
