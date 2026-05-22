/**
 * Wearable Integrations page (F1-003).
 *
 * Displays Apple Health and Garmin Connect integration status for the
 * current user and provides Connect/Disconnect actions. Used as the
 * entry point for training-load-aware meal planning setup.
 */

import type { JSX, CSSProperties } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { handleSession } from "@nexus/identity-and-access";
import { buildDb } from "@/lib/db";
import { buildEventBus } from "@/lib/events";
import { getAppleHealthConnection, generateCodeVerifier, generateCodeChallenge, buildAppleAuthorizationUrl, disconnectAppleHealth } from "@/lib/fueling/apple-health-client";
import { getGarminConnection, getGarminRequestToken, buildGarminAuthorizationUrl, disconnectGarmin } from "@/lib/fueling/garmin-client";
import crypto from "crypto";

async function getCurrentUser(): Promise<{ user_id: string; email: string } | null> {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;
  if (!token) return null;

  const result = await handleSession({
    authorizationHeader: "Bearer " + token,
    ctx: { db: buildDb(), events: buildEventBus() },
  });

  if (result.status !== 200) return null;
  return result.body as { user_id: string; email: string };
}

function buildOAuthState(userId: string): string {
  const secret = process.env.OAUTH_STATE_SECRET ?? "default-dev-secret";
  const hmac = crypto.createHmac("sha256", secret).update(userId).digest("base64url");
  return userId + "." + hmac;
}

export default async function IntegrationsPage(): Promise<JSX.Element> {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <section style={{ maxWidth: 960, margin: "0 auto", padding: "2rem 1.5rem" }}>
        <h1>Wearable Integrations</h1>
        <p>
          Please <a href="/api/auth/login">sign in</a> to manage your wearable integrations.
        </p>
      </section>
    );
  }

  const [appleConn, garminConn] = await Promise.all([
    getAppleHealthConnection(user.user_id).catch(() => null),
    getGarminConnection(user.user_id).catch(() => null),
  ]);

  async function connectAppleHealth(): Promise<void> {
    "use server";
    const innerUser = await getCurrentUser();
    if (!innerUser) redirect("/api/auth/login");

    const verifier = generateCodeVerifier();
    const challenge = generateCodeChallenge(verifier);
    const state = buildOAuthState(innerUser.user_id);

    const cookieStore = cookies();
    cookieStore.set("apple_cv", verifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 600,
      sameSite: "lax",
      path: "/",
    });

    const url = buildAppleAuthorizationUrl(state, challenge);
    redirect(url);
  }

  async function connectGarmin(): Promise<void> {
    "use server";
    const innerUser = await getCurrentUser();
    if (!innerUser) redirect("/api/auth/login");

    const { requestToken, requestTokenSecret } = await getGarminRequestToken();
    const state = buildOAuthState(innerUser.user_id);

    const cookieStore = cookies();
    cookieStore.set("garmin_rt", requestToken + ":" + requestTokenSecret + ":" + state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 600,
      sameSite: "lax",
      path: "/",
    });

    redirect(buildGarminAuthorizationUrl(requestToken));
  }

  async function disconnectAppleHealthAction(): Promise<void> {
    "use server";
    const innerUser = await getCurrentUser();
    if (!innerUser) return;
    await disconnectAppleHealth(innerUser.user_id);
    redirect("/integrations?disconnected=apple_health");
  }

  async function disconnectGarminAction(): Promise<void> {
    "use server";
    const innerUser = await getCurrentUser();
    if (!innerUser) return;
    await disconnectGarmin(innerUser.user_id);
    redirect("/integrations?disconnected=garmin");
  }

  const cardStyle: CSSProperties = {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: "1.5rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "1rem",
  };

  const connectBtnStyle: CSSProperties = {
    display: "inline-block",
    padding: "0.5rem 1.25rem",
    borderRadius: 8,
    background: "#111827",
    color: "#fff",
    border: "none",
    cursor: "pointer",
    fontSize: "0.9rem",
    fontWeight: 500,
    textDecoration: "none",
  };

  const disconnectBtnStyle: CSSProperties = {
    padding: "0.5rem 1rem",
    borderRadius: 8,
    border: "1px solid #dc2626",
    background: "transparent",
    color: "#dc2626",
    cursor: "pointer",
    fontSize: "0.85rem",
  };

  return (
    <section style={{ maxWidth: 960, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <h1 style={{ marginBottom: "0.5rem" }}>Wearable Integrations</h1>
      <p style={{ opacity: 0.65, marginBottom: "2rem", maxWidth: 560 }}>
        Connect your wearables to enable training-load-aware meal planning. Macro
        and calorie targets adjust automatically based on your scheduled and completed
        workouts.
      </p>

      <div style={{ display: "grid", gap: "1.25rem" }}>
        <div style={cardStyle}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Apple Health</h2>
            <p style={{ margin: "0.25rem 0 0", opacity: 0.6, fontSize: "0.875rem" }}>
              Sync completed workouts, sport type, and energy expenditure from Apple Health
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
            {appleConn ? (
              <>
                <span style={{ color: "#16a34a", fontSize: "0.85rem", fontWeight: 500 }}>
                  Connected
                </span>
                <form action={disconnectAppleHealthAction}>
                  <button type="submit" style={disconnectBtnStyle}>
                    Disconnect
                  </button>
                </form>
              </>
            ) : (
              <form action={connectAppleHealth}>
                <button type="submit" style={connectBtnStyle}>
                  Connect
                </button>
              </form>
            )}
          </div>
        </div>

        <div style={cardStyle}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Garmin Connect</h2>
            <p style={{ margin: "0.25rem 0 0", opacity: 0.6, fontSize: "0.875rem" }}>
              Sync activities and training load data from Garmin Connect IQ
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
            {garminConn ? (
              <>
                <span style={{ color: "#16a34a", fontSize: "0.85rem", fontWeight: 500 }}>
                  Connected
                </span>
                <form action={disconnectGarminAction}>
                  <button type="submit" style={disconnectBtnStyle}>
                    Disconnect
                  </button>
                </form>
              </>
            ) : (
              <form action={connectGarmin}>
                <button type="submit" style={connectBtnStyle}>
                  Connect
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
